'use client';

// src/components/region/RegionMapView.tsx — 지역지도(MapLibre). 실제 basemap 위 시군구/시도 반투명 색칠.
// 경로지도(TripMapView)와 동일 포맷: OpenFreeMap positron 타일 + 네이티브 줌/팬 + 동일 동의 고지.
//   - 색칠: promoteId(지역코드)+feature-state(방문상태) → data-driven fill-color match.
//   - 라벨: symbol 레이어(네이티브 declutter=줌인 시 점진 노출). 한글은 localIdeographFontFamily로 로컬 렌더.
//   - ack 후에만 maplibre/타일 로드. 레벨 변경 시 재생성, 방문상태 변경은 feature-state만 갱신(재생성 X).

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { VisitState } from '@/core/visitState';
import type { Level } from '@/components/region/LevelToggle';
import { hasTileConsent, setTileConsent } from '@/components/map/tileConsent';
import { TileNotice } from '@/components/map/TileNotice';
import { levelLayerConfig, buildFillColorExpression, resolveStateColors } from '@/lib/regionLayerStyle';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
// 대한민국 본토 bounds(gen-choropleth FIT과 동일 — 울릉/독도 제외 프레이밍).
const KOREA_BOUNDS: [[number, number], [number, number]] = [
  [124.6, 33.0],
  [130.0, 38.65],
];
const HANGUL_FONT = "'Apple SD Gothic Neo','Noto Sans KR',sans-serif";
const HIGHLIGHT_NONE = '__none__'; // 선택 없음 sentinel(어느 feature.id와도 불일치)

export function RegionMapView({
  level,
  stateByCode,
  selectedCode,
  onSelectRegion,
}: {
  level: Level;
  stateByCode: Record<string, VisitState>;
  selectedCode?: string | null;
  onSelectRegion?: (code: string | null) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const [needNotice, setNeedNotice] = useState(false);
  const [ack, setAck] = useState(false);

  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const loadedRef = useRef(false);
  // feature-state 갱신이 최신 상태를 읽도록 ref 미러(effect 재생성 없이 갱신).
  const stateRef = useRef(stateByCode);
  stateRef.current = stateByCode;
  // 선택/콜백도 ref 미러(맵 생성 effect 재실행 없이 최신값 참조).
  const onSelectRef = useRef(onSelectRegion);
  onSelectRef.current = onSelectRegion;
  const selectedRef = useRef<string | null>(selectedCode ?? null);
  selectedRef.current = selectedCode ?? null;
  const stateKey = useMemo(
    () =>
      Object.keys(stateByCode)
        .sort()
        .map((k) => `${k}:${stateByCode[k]}`)
        .join(','),
    [stateByCode],
  );

  // 방문상태를 모든 feature-state로 재적용(미설정 코드는 fill 식 기본=미방문).
  const applyStates = (map: import('maplibre-gl').Map) => {
    map.removeFeatureState({ source: 'regions' });
    for (const [code, state] of Object.entries(stateRef.current)) {
      map.setFeatureState({ source: 'regions', id: code }, { state });
    }
  };

  // 선택 지역 강조: region-highlight 라인 레이어 필터를 선택 코드로. 미선택이면 어느 것도 불일치.
  const applyHighlight = (map: import('maplibre-gl').Map) => {
    if (!map.getLayer('region-highlight')) return;
    map.setFilter('region-highlight', ['==', ['to-string', ['id']], selectedRef.current ?? HIGHLIGHT_NONE]);
  };

  // 최초 진입 1회 타일 고지(경로지도와 키 공유 → 한쪽에서 동의했으면 통과).
  useEffect(() => {
    if (hasTileConsent()) setAck(true);
    else setNeedNotice(true);
  }, []);

  // 지도 생성 + 레벨별 레이어. ack 후에만 maplibre/타일 로드. 레벨 변경 시 재생성.
  useEffect(() => {
    if (!ack || !mapEl.current) return;
    let cancelled = false;
    loadedRef.current = false;
    const cfg = levelLayerConfig(level);

    (async () => {
      const maplibre = (await import('maplibre-gl')).default;
      if (cancelled || !mapEl.current) return;

      const map = new maplibre.Map({
        container: mapEl.current,
        style: STYLE_URL,
        bounds: KOREA_BOUNDS,
        fitBoundsOptions: { padding: 20 },
        attributionControl: { compact: true },
        localIdeographFontFamily: HANGUL_FONT,
      });
      mapRef.current = map;

      map.on('load', async () => {
        if (cancelled || !mapRef.current) return;
        const geo = await fetch(cfg.url)
          .then((r) => r.json())
          .catch(() => null);
        if (cancelled || !geo || !mapRef.current) return;

        const colors = resolveStateColors();
        map.addSource('regions', { type: 'geojson', data: geo, promoteId: cfg.codeProp });
        map.addLayer({
          id: 'region-fill',
          type: 'fill',
          source: 'regions',
          paint: { 'fill-color': buildFillColorExpression(colors) as never, 'fill-opacity': 0.55 },
        });
        map.addLayer({
          id: 'region-line',
          type: 'line',
          source: 'regions',
          paint: { 'line-color': colors.separator || '#D7D7DC', 'line-width': 0.8 },
        });
        map.addLayer({
          id: 'region-label',
          type: 'symbol',
          source: 'regions',
          layout: {
            'text-field': ['get', cfg.nameProp],
            'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9, 9, 12, 12, 15],
            'text-font': ['Noto Sans Regular'],
          },
          paint: {
            'text-color': colors.label || '#111',
            'text-halo-color': colors.surface || '#fff',
            'text-halo-width': 1.2,
          },
        });

        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2E7D5B';
        map.addLayer({
          id: 'region-highlight',
          type: 'line',
          source: 'regions',
          paint: { 'line-color': accent, 'line-width': 3 },
          filter: ['==', ['to-string', ['id']], HIGHLIGHT_NONE],
        });

        // 시군구 채움 클릭 → 선택 콜백(feature.id=promoteId 지역코드).
        map.on('click', 'region-fill', (e) => {
          const f = e.features?.[0];
          if (f) onSelectRef.current?.(String(f.id));
        });
        // 빈 영역(지역 밖) 클릭 → 선택 해제. region-fill 히트가 없을 때만.
        map.on('click', (e) => {
          const hits = map.queryRenderedFeatures(e.point, { layers: ['region-fill'] });
          if (hits.length === 0) onSelectRef.current?.(null);
        });
        map.on('mouseenter', 'region-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'region-fill', () => { map.getCanvas().style.cursor = ''; });

        loadedRef.current = true;
        applyStates(map);
        applyHighlight(map);
      });
    })();

    return () => {
      cancelled = true;
      loadedRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // level/ack 변경 시에만 재생성. stateByCode는 아래 effect에서 feature-state로 갱신.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ack, level]);

  // 방문상태 변경(라이브 import) 시 재생성 없이 feature-state만 갱신.
  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyStates(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);

  // 선택 변경 시 재생성 없이 강조 필터만 갱신(applyStates/stateKey와 동일 패턴).
  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyHighlight(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode]);

  const accept = () => {
    setTileConsent();
    setNeedNotice(false);
    setAck(true);
  };

  return (
    <div style={wrap}>
      <div ref={mapEl} style={mapBox} />
      {needNotice && <TileNotice onAccept={accept} />}
    </div>
  );
}

const wrap: CSSProperties = { position: 'relative', flex: 1, minHeight: 0 };
const mapBox: CSSProperties = { position: 'absolute', inset: 0 };
