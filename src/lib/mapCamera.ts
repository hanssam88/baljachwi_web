// src/lib/mapCamera.ts — 지도 fitBounds용 순수 카메라 헬퍼.
// paddedBounds: BBox에 비율 패딩+최소 span 클램프(기존 PhotoMapView 인라인 수식 추출).
// connectedBounds: "줄로 연결된(같은 날)" 핀들의 패딩 bounds. 둘 다 순수(maplibre 비의존).
import type { BBox } from '@/core/geoTypes';
import type { PhotoRef } from '@/data/models';
import { photosBBox } from '@/lib/photosBBox';
import { sameDayPhotos } from '@/lib/sameDayConnector';

/** maplibre fitBounds 입력: [[minLon,minLat],[maxLon,maxLat]] (SW, NE). */
export type LngLatBoundsTuple = [[number, number], [number, number]];

/** BBox → 각 변 비율 패딩(최소 minSpan/2 클램프) 적용한 SW→NE 튜플. */
export function paddedBounds(bbox: BBox, minSpan: number, ratio = 0.2): LngLatBoundsTuple {
  const latPad = Math.max((bbox.maxLat - bbox.minLat) * ratio, minSpan / 2);
  const lonPad = Math.max((bbox.maxLon - bbox.minLon) * ratio, minSpan / 2);
  return [
    [bbox.minLon - lonPad, bbox.minLat - latPad],
    [bbox.maxLon + lonPad, bbox.maxLat + latPad],
  ];
}

/** anchor와 같은 현지 날짜 핀들의 패딩 bounds. 대상 없으면(빈 집합) null. */
export function connectedBounds(
  photos: ReadonlyArray<PhotoRef>,
  anchor: PhotoRef,
  minSpan: number,
): LngLatBoundsTuple | null {
  const bbox = photosBBox(sameDayPhotos(photos, anchor));
  return bbox ? paddedBounds(bbox, minSpan) : null;
}
