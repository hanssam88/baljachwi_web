// src/core/tripMetrics.ts
// TripMetrics — 사진 집합에서 여행 메타(bbox·startAt·endAt·대표 지역코드)를 산출하는 순수 헬퍼.
// Swift BaljachwiCore/TripMetrics.swift 의 byte-faithful 포트.
//
// 존재 이유: 대표코드 산출·병합(merge) 재계산이 재사용 불가하면 tie-break가 갈라질(drift) 위험 →
// 단일 진실(canonical)로 이 파일에 추출하고 ScanPipeline·TripSegmenter가 위임한다.
// 순수·결정적(시스템시계/난수/IO 없음). 시간은 epoch 초(number) 정수 산술만 — JS Date 객체 금지.
import type { BBox } from './geoTypes';

/**
 * 메트릭 산출 입력 1건 (Swift TripMetrics.Input).
 * @Model(PhotoRef) 비전달 — 호출부가 값만 추출해 전달.
 */
export interface TripMetricsInput {
  lat: number;
  lon: number;
  /** epoch 초 (Swift Date(timeIntervalSince1970:) 대응 — JS Date 객체 금지) */
  takenAt: number;
  regionCode: string | null;
}

/** 산출된 여행 메트릭 (Swift TripMetrics.Metrics). */
export interface TripMetricsResult {
  /** epoch 초, min(takenAt) */
  startAt: number;
  /** epoch 초, max(takenAt) */
  endAt: number;
  bbox: BBox; // { minLat, minLon, maxLat, maxLon }
  representativeRegionCode: string | null;
}

/**
 * 최빈 regionCode. 동률은 regionCode 오름차순(가장 작은 코드) — canonical tie-break.
 * ScanPipeline·TripSegmenter(병합 재계산)가 이 함수에 위임한다 (drift 방지).
 * 빈 입력이면 null. (호출부가 null 제외를 이미 수행한 string[]을 전달)
 */
export function representativeRegionCode(codes: string[]): string | null {
  if (codes.length === 0) return null;

  // counts는 Map<string,number> — plain object의 '__proto__' 등 프로토타입 키 오염 방지.
  const counts = new Map<string, number>();
  for (const c of codes) {
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }

  // 빈도 내림차순, 동률은 regionCode 오름차순(가장 작은 코드).
  // Swift Dictionary.max(by:) 비교 반전 트릭을 복제하지 않고 reduce로 직접 구현:
  //   (count > best.count) || (count === best.count && code < best.code) 일 때 교체.
  // 문자열 비교는 < 연산자(UTF-16 코드유닛). 지역코드는 ASCII 숫자라 Swift 유니코드 스칼라 비교와 동일.
  let best: { code: string; count: number } | null = null;
  for (const [code, count] of counts) {
    if (
      best === null ||
      count > best.count ||
      (count === best.count && code < best.code)
    ) {
      best = { code, count };
    }
  }
  return best!.code;
}

/**
 * 사진 집합 → 메트릭. 빈 입력이면 null (호출부 가드 후 사용 계약).
 * 입력 순서 무관 (min/max·최빈). regionCode가 null인 항목은 대표코드 집계에서만 제외.
 */
export function computeTripMetrics(
  photos: TripMetricsInput[],
): TripMetricsResult | null {
  if (photos.length === 0) return null;

  let startAt = photos[0].takenAt;
  let endAt = photos[0].takenAt;
  let minLat = photos[0].lat;
  let maxLat = photos[0].lat;
  let minLon = photos[0].lon;
  let maxLon = photos[0].lon;

  for (const p of photos) {
    if (p.takenAt < startAt) startAt = p.takenAt;
    if (p.takenAt > endAt) endAt = p.takenAt;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }

  // regionCode가 null인 항목 제외 후 최빈 산출 (Swift compactMap 대응).
  const codes = photos
    .map((p) => p.regionCode)
    .filter((c): c is string => c !== null);
  const rep = representativeRegionCode(codes);

  return {
    startAt,
    endAt,
    bbox: { minLat, minLon, maxLat, maxLon },
    representativeRegionCode: rep,
  };
}
