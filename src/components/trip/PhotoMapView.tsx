'use client';

// src/components/trip/PhotoMapView.tsx — 사진 위치 지도(MapLibre, 지연 로드).
// 핀(썸네일) + 핀 클릭 시 같은-날 연결선 + 사진 bbox 카메라. 여행 경로지도와 빈 상태 사진맵이 공유.
// maplibre는 이 컴포넌트에서만 동적 import → 지역탭은 100% 오프라인 유지.
// 기본맵 타일이 유일한 외부 호출(무키, 프라이버시 고지).

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { PhotoRef } from '@/data/models';
import { repo } from '@/data/repo';
import { photosBBox } from '@/lib/photosBBox';
import { dayConnectorCoords, localDayOf } from '@/lib/sameDayConnector';
import { paddedBounds, connectedBounds } from '@/lib/mapCamera';
import { hasTileConsent, setTileConsent } from '@/components/map/tileConsent';
import { TileNotice } from '@/components/map/TileNotice';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const MIN_SPAN = 0.01; // ≈1km — 단일/근접 사진 과도 줌 방지(iOS minSpan)
const FOCUS_MAX_ZOOM = 15; // 같은 날 핀 포커스 최대 줌(초기/리셋은 14)
const FOCUS_BOTTOM_PAD = 96; // 하단 액션바(≈64px) 회피 패딩
const CAMERA_DURATION = 600; // 포커스/리셋 줌 애니메이션(ms). 초기 마운트 fit은 0 유지.

export interface PhotoMapViewProps {
  photos: PhotoRef[];
  /** 상단 바 back 버튼. 없으면 바 미표시(빈 상태용). */
  onBack?: () => void;
  title?: string;
  /** 핀 삭제 성공 후 호출(스냅샷 뷰는 닫아 라이브 복귀). 미전달 시 liveQuery 자동 갱신에 의존. */
  onAfterDelete?: () => void;
}

export function PhotoMapView({ photos, onBack, title, onAfterDelete }: PhotoMapViewProps) {
  const mapEl = useRef<HTMLDivElement>(null);
  const [needNotice, setNeedNotice] = useState(false);
  const [ack, setAck] = useState(false);
  const [selected, setSelected] = useState<PhotoRef | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // liveQuery는 매 발화마다 새 배열 참조를 emit → 사진 '집합'이 실제로 바뀔 때만 effect 재생성.
  const photosKey = useMemo(() => photos.map((p) => p.localIdentifier).join(','), [photos]);

  useEffect(() => {
    if (hasTileConsent()) setAck(true);
    else setNeedNotice(true);
  }, []);

  // 사진 집합이 바뀌면(삭제·탭 전환 등) 선택/확인/에러 상태 리셋.
  useEffect(() => {
    setSelected(null);
    setConfirming(false);
    setError(null);
  }, [photosKey]);

  useEffect(() => {
    if (!ack || !mapEl.current || photos.length === 0) return;
    const bbox = photosBBox(photos);
    if (bbox === null) return;
    let map: import('maplibre-gl').Map | null = null;
    // objectURL은 ref에 누적 — cleanup이 비동기 루프가 만든 URL까지 모두 revoke하게 한다.
    const urls: string[] = [];
    let cancelled = false;

    (async () => {
      const maplibre = (await import('maplibre-gl')).default;
      if (cancelled || !mapEl.current) return;

      const cLat = (bbox.minLat + bbox.maxLat) / 2;
      const cLon = (bbox.minLon + bbox.maxLon) / 2;

      map = new maplibre.Map({
        container: mapEl.current,
        style: STYLE_URL,
        center: [cLon, cLat],
        zoom: 9,
        attributionControl: { compact: true },
      });

      map.on('load', async () => {
        if (!map || cancelled) return;

        // 같은-날 연결선(핀 클릭 시에만). 빈 소스+라인 레이어 선등록 → setData로 갱신.
        map.addSource('day-connector', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2E7D5B';
        map.addLayer({
          id: 'day-connector-line',
          type: 'line',
          source: 'day-connector',
          paint: { 'line-color': accent, 'line-width': 3 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        });

        // 선택 토글: 다른 날 핀 클릭→그 날 연결, 같은 날 핀 재클릭/빈영역 클릭→해제.
        let selectedDay: number | null = null;
        const empty: import('geojson').FeatureCollection = { type: 'FeatureCollection', features: [] };
        // 반환값 = "그 날이 앵커됨"(true, 줌인) vs "해제됨"(false, 줌아웃). 단일 핀(선 없음)도 앵커로 간주.
        const setConnector = (anchor: PhotoRef | null): boolean => {
          if (!map || cancelled) return false;
          const src = map.getSource('day-connector') as import('maplibre-gl').GeoJSONSource | undefined;
          if (!src) return false;
          if (!anchor) { selectedDay = null; src.setData(empty); return false; }
          const day = localDayOf(anchor);
          if (selectedDay === day) { selectedDay = null; src.setData(empty); return false; } // 같은 날 재클릭 → 해제
          selectedDay = day;
          const coords = dayConnectorCoords(photos, anchor);
          if (coords.length >= 2) {
            const line: import('geojson').Feature = {
              type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords },
            };
            src.setData(line);
          } else {
            src.setData(empty); // 같은 날 1장 → 선 없음(그래도 앵커=줌인)
          }
          return true;
        };
        // 같은 날 핀 그룹을 한 화면에(하단 액션바 회피 패딩 + 컨테이너 높이 클램프).
        const focusOnDay = (anchor: PhotoRef) => {
          if (!map || cancelled) return;
          const b = connectedBounds(photos, anchor, MIN_SPAN);
          if (!b) return;
          const h = map.getContainer().clientHeight;
          const bottom = Math.min(FOCUS_BOTTOM_PAD, Math.max(40, h * 0.4)); // 짧은 임베드에서 과패딩 방지
          map.fitBounds(b, {
            padding: { top: 40, right: 40, bottom, left: 40 },
            duration: CAMERA_DURATION, maxZoom: FOCUS_MAX_ZOOM,
          });
        };
        // 전체 사진 bbox로 줌아웃(초기 framing과 동일, 애니메이션만 적용).
        const resetCamera = () => {
          if (!map || cancelled) return;
          map.fitBounds(paddedBounds(bbox, MIN_SPAN), { padding: 40, duration: CAMERA_DURATION, maxZoom: 14 });
        };
        map.on('click', () => { setConnector(null); setSelected(null); resetCamera(); }); // 빈 영역 → 해제+줌아웃

        // 핀(썸네일 blob → objectURL Marker). 없으면 점.
        const r = repo();
        for (const p of photos) {
          // cancelled 체크를 createObjectURL '이전'에 둔다 — 정리 이후 URL이 새지 않게.
          if (!map || cancelled) break;
          const blob = await r.thumbFor(p.localIdentifier).catch(() => null);
          if (!map || cancelled) break;
          try {
            const elm = document.createElement('div');
            elm.className = 'trip-pin';
            if (blob) {
              const url = URL.createObjectURL(blob);
              urls.push(url);
              elm.style.backgroundImage = `url(${url})`;
            }
            elm.style.cursor = 'pointer';
            elm.addEventListener('click', (ev) => {
              ev.stopPropagation();
              const anchored = setConnector(p);
              setSelected(p);
              if (anchored) focusOnDay(p); else resetCamera(); // 앵커=줌인 / 같은날 재클릭=줌아웃(선 상태 미러)
            });
            new maplibre.Marker({ element: elm }).setLngLat([p.lon, p.lat]).addTo(map);
          } catch {
            // 개별 핀 실패(이상 좌표 등)는 건너뜀.
          }
        }

        // 초기 bbox 카메라(전체 사진). 즉시(애니메이션 0).
        map.fitBounds(paddedBounds(bbox, MIN_SPAN), { padding: 40, duration: 0, maxZoom: 14 });
      });
    })();

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
      map?.remove();
    };
    // photosKey로 좁혀 liveQuery 재발화마다 지도가 재생성되지 않게 한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ack, photosKey]);

  const acceptNotice = () => {
    setTileConsent();
    setNeedNotice(false);
    setAck(true);
  };

  const doDelete = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      await repo().deletePhotos([selected.localIdentifier]);
      setSelected(null);
      setConfirming(false);
      onAfterDelete?.(); // 스냅샷 뷰(여행목록)는 닫힘. 라이브 뷰(경로지도)는 liveQuery가 갱신.
    } catch {
      // 비가역 작업 실패 → 무음 무시 금지. 확인창 닫고 선택 유지(재시도 가능) + 에러 노출(M-2).
      setConfirming(false);
      setError('삭제에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={screen}>
      {onBack && (
        <div style={bar}>
          <button type="button" style={backBtn} onClick={onBack}>← 목록</button>
          <span style={barTitle}>{title ?? '여행'}</span>
        </div>
      )}
      {photos.length === 0 ? (
        <div style={empty}>표시할 사진이 없습니다</div>
      ) : (
        <div style={mapWrap}>
          <div ref={mapEl} style={mapBox} />
          {needNotice && <TileNotice onAccept={acceptNotice} />}
          {error && <div style={errorBanner} role="alert">{error}</div>}
          {selected && !confirming && (
            <div style={actionBar}>
              {/* disabled={busy}: 삭제 진행 중 stale 핀 재클릭 방지(H-1). 빠른 재클릭은 Task 10 실측 확인. */}
              <button type="button" style={delPinBtn} disabled={busy} onClick={() => setConfirming(true)}>이 사진 삭제</button>
              <button type="button" style={cancelPinBtn} onClick={() => setSelected(null)}>취소</button>
            </div>
          )}
          {confirming && (
            <ConfirmDialog
              message="이 사진을 삭제할까요? 되돌릴 수 없습니다."
              onConfirm={doDelete}
              onCancel={() => setConfirming(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

const screen: CSSProperties = { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 };
const bar: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--separator)',
  background: 'var(--surface)',
};
const backBtn: CSSProperties = {
  border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 15, cursor: 'pointer',
};
const barTitle: CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--label)' };
const mapWrap: CSSProperties = { position: 'relative', flex: 1, minHeight: 0 };
const mapBox: CSSProperties = { position: 'absolute', inset: 0 };
const empty: CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)',
};
// actionBar(bottom:0)는 selected일 때만 잠깐 노출 — maplibre attribution(우하단) 상시 가림 아님(M-1, Task 10 육안 확인).
const actionBar: CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', gap: 'var(--space-3)',
  padding: 'var(--space-3)', background: 'var(--surface)', borderTop: '1px solid var(--separator)', zIndex: 10,
};
// 삭제 실패 시 상단 토스트. 액션바(하단)와 겹치지 않게 위쪽 배치. 다음 photosKey 변동/재시도 시 해제.
const errorBanner: CSSProperties = {
  position: 'absolute', left: 'var(--space-3)', right: 'var(--space-3)', top: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-3)', background: '#C2453A', color: '#fff',
  fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius-md)', textAlign: 'center', zIndex: 15,
};
const delPinBtn: CSSProperties = {
  flex: 1, padding: '12px 0', border: 'none', borderRadius: 'var(--radius-md)',
  background: '#C2453A', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
};
const cancelPinBtn: CSSProperties = {
  flex: 1, padding: '12px 0', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)',
  background: 'var(--surface)', color: 'var(--label)', fontSize: 16, fontWeight: 600, cursor: 'pointer',
};
