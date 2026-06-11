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
import { hasTileConsent, setTileConsent } from '@/components/map/tileConsent';
import { TileNotice } from '@/components/map/TileNotice';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const MIN_SPAN = 0.01; // ≈1km — 단일/근접 사진 과도 줌 방지(iOS minSpan)

export interface PhotoMapViewProps {
  photos: PhotoRef[];
  /** 상단 바 back 버튼. 없으면 바 미표시(빈 상태용). */
  onBack?: () => void;
  title?: string;
}

export function PhotoMapView({ photos, onBack, title }: PhotoMapViewProps) {
  const mapEl = useRef<HTMLDivElement>(null);
  const [needNotice, setNeedNotice] = useState(false);
  const [ack, setAck] = useState(false);

  // liveQuery는 매 발화마다 새 배열 참조를 emit → 사진 '집합'이 실제로 바뀔 때만 effect 재생성.
  const photosKey = useMemo(() => photos.map((p) => p.localIdentifier).join(','), [photos]);

  useEffect(() => {
    if (hasTileConsent()) setAck(true);
    else setNeedNotice(true);
  }, []);

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
        const setConnector = (anchor: PhotoRef | null) => {
          if (!map || cancelled) return;
          const src = map.getSource('day-connector') as import('maplibre-gl').GeoJSONSource | undefined;
          if (!src) return;
          if (!anchor) { selectedDay = null; src.setData(empty); return; }
          const day = localDayOf(anchor);
          if (selectedDay === day) { selectedDay = null; src.setData(empty); return; }
          selectedDay = day;
          const coords = dayConnectorCoords(photos, anchor);
          if (coords.length >= 2) {
            const line: import('geojson').Feature = {
              type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords },
            };
            src.setData(line);
          } else {
            src.setData(empty);
          }
        };
        map.on('click', () => setConnector(null)); // 캔버스(빈 영역) 클릭 → 해제

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
            elm.addEventListener('click', (ev) => { ev.stopPropagation(); setConnector(p); });
            new maplibre.Marker({ element: elm }).setLngLat([p.lon, p.lat]).addTo(map);
          } catch {
            // 개별 핀 실패(이상 좌표 등)는 건너뜀.
          }
        }

        // bbox 카메라(최소 span 클램프).
        const latPad = Math.max((bbox.maxLat - bbox.minLat) * 0.2, MIN_SPAN / 2);
        const lonPad = Math.max((bbox.maxLon - bbox.minLon) * 0.2, MIN_SPAN / 2);
        map.fitBounds(
          [
            [bbox.minLon - lonPad, bbox.minLat - latPad],
            [bbox.maxLon + lonPad, bbox.maxLat + latPad],
          ],
          { padding: 40, duration: 0, maxZoom: 14 },
        );
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
