'use client';

// src/components/trip/TripMapView.tsx — 여행 경로지도(MapLibre, 지연 로드).
// 핀(썸네일) + 경로선 + bbox 카메라. maplibre는 이 컴포넌트에서만 동적 import
// → 지역탭은 100% 오프라인 유지. 기본맵 타일이 유일한 외부 호출(무키, 프라이버시 고지).

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { TripRecord } from '@/data/models';
import { usePhotosForTrip } from '@/hooks/useTrips';
import { repo } from '@/data/repo';

const TILE_NOTICE_KEY = 'baljachwi-tile-notice-ack';
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const MIN_SPAN = 0.01; // ≈1km — 단일/근접 사진 과도 줌 방지(iOS minSpan)

export function TripMapView({ trip, onBack }: { trip: TripRecord; onBack: () => void }) {
  const photos = usePhotosForTrip(trip.id) ?? [];
  const mapEl = useRef<HTMLDivElement>(null);
  const [needNotice, setNeedNotice] = useState(false);
  const [ack, setAck] = useState(false);

  // 최초 진입 1회 타일 고지.
  useEffect(() => {
    const seen = typeof localStorage !== 'undefined' && localStorage.getItem(TILE_NOTICE_KEY);
    if (seen) setAck(true);
    else setNeedNotice(true);
  }, []);

  // maplibre 동적 로드 + 핀/경로선/카메라. ack 후에만 타일 fetch.
  useEffect(() => {
    if (!ack || !mapEl.current || photos.length === 0) return;
    let map: import('maplibre-gl').Map | null = null;
    const urls: string[] = [];
    let cancelled = false;

    (async () => {
      const maplibre = (await import('maplibre-gl')).default;
      if (cancelled || !mapEl.current) return;

      const b = {
        minLat: trip.minLat,
        minLon: trip.minLon,
        maxLat: trip.maxLat,
        maxLon: trip.maxLon,
      };
      const cLat = (b.minLat + b.maxLat) / 2;
      const cLon = (b.minLon + b.maxLon) / 2;

      map = new maplibre.Map({
        container: mapEl.current,
        style: STYLE_URL,
        center: [cLon, cLat],
        zoom: 9,
        attributionControl: { compact: true },
      });

      map.on('load', async () => {
        if (!map || cancelled) return;

        // 경로선(sortIndex 순, ≥2점).
        const coords = photos.map((p) => [p.lon, p.lat] as [number, number]);
        if (coords.length >= 2) {
          map.addSource('route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
          });
          const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2E7D5B';
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            paint: { 'line-color': accent, 'line-width': 3 },
            layout: { 'line-cap': 'round', 'line-join': 'round' },
          });
        }

        // 핀(썸네일 blob → objectURL Marker). 없으면 점.
        const r = repo();
        for (const p of photos) {
          const blob = await r.thumbFor(p.localIdentifier).catch(() => null);
          const elm = document.createElement('div');
          elm.className = 'trip-pin';
          if (blob) {
            const url = URL.createObjectURL(blob);
            urls.push(url);
            elm.style.backgroundImage = `url(${url})`;
          }
          if (!map || cancelled) break;
          new maplibre.Marker({ element: elm }).setLngLat([p.lon, p.lat]).addTo(map);
        }

        // bbox 카메라(최소 span 클램프).
        const latPad = Math.max((b.maxLat - b.minLat) * 0.2, MIN_SPAN / 2);
        const lonPad = Math.max((b.maxLon - b.minLon) * 0.2, MIN_SPAN / 2);
        map.fitBounds(
          [
            [b.minLon - lonPad, b.minLat - latPad],
            [b.maxLon + lonPad, b.maxLat + latPad],
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
  }, [ack, photos, trip]);

  const acceptNotice = () => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TILE_NOTICE_KEY, '1');
    setNeedNotice(false);
    setAck(true);
  };

  return (
    <div style={screen}>
      <div style={bar}>
        <button type="button" style={backBtn} onClick={onBack}>
          ← 목록
        </button>
        <span style={barTitle}>{trip.title ?? '여행'}</span>
      </div>

      {photos.length === 0 ? (
        <div style={empty}>이 여행의 사진을 찾을 수 없습니다</div>
      ) : (
        <div style={mapWrap}>
          <div ref={mapEl} style={mapBox} />
          {needNotice && (
            <div style={noticeOverlay} role="dialog" aria-label="외부 타일 고지">
              <div style={noticeCard}>
                <p style={noticeText}>
                  경로지도는 지도 타일을 외부에서 불러옵니다. 사진·위치 데이터는 전송되지 않습니다.
                </p>
                <button type="button" style={noticeBtn} onClick={acceptNotice}>
                  확인
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const screen: CSSProperties = { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 };
const bar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-3)',
  borderBottom: '1px solid var(--separator)',
  background: 'var(--surface)',
};
const backBtn: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--accent)',
  fontSize: 15,
  cursor: 'pointer',
};
const barTitle: CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--label)' };
const mapWrap: CSSProperties = { position: 'relative', flex: 1, minHeight: 0 };
const mapBox: CSSProperties = { position: 'absolute', inset: 0 };
const empty: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--label2)',
};
const noticeOverlay: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.35)',
  padding: 'var(--space-5)',
};
const noticeCard: CSSProperties = {
  maxWidth: 320,
  background: 'var(--surface)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
  textAlign: 'center',
};
const noticeText: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.5,
  color: 'var(--label)',
};
const noticeBtn: CSSProperties = {
  marginTop: 'var(--space-4)',
  padding: '8px 24px',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};
