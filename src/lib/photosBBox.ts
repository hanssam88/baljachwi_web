// src/lib/photosBBox.ts — 사진 좌표 배열 → 경계 박스(BBox). 빈 배열이면 null.
// 지도 카메라 fitBounds 입력용. lat/lon만 읽는 구조적 의존(코어 BBox 타입 재사용).
import type { BBox } from '@/core/geoTypes';

export function photosBBox(photos: ReadonlyArray<{ lat: number; lon: number }>): BBox | null {
  if (photos.length === 0) return null;
  let minLat = photos[0].lat, maxLat = photos[0].lat;
  let minLon = photos[0].lon, maxLon = photos[0].lon;
  for (const p of photos) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, minLon, maxLat, maxLon };
}
