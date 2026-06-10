// Point-in-polygon 판정 — Swift BaljachwiCore/PointInPolygon.swift 의 byte-faithful 포트.
//
// 순수 crossing-number(ray-casting) 알고리즘은 본질적으로 epsilon이 필요 없다
// (제수 (yj - yi)는 half-open 교차 판정이 참일 때만 도달하므로 0이 될 수 없음).
// 평면 매핑은 (x = lon, y = lat). 투영 없음. lat/lon ↔ x/y 변환은 planar() 한 곳에서만 한다.

import type { Coordinate, Polygon, MultiPolygon } from './geoTypes';

/** 경계 판정 규칙. 현재 단일 케이스(좌하단 포함). Swift enum BoundaryRule 대응. */
export type BoundaryRule = 'leftBottomInclusive';

/** Swift PointInPolygonConfig 대응. boundaryRule은 현재 알고리즘에서 분기하지 않음(API 형태 보존용). */
export interface PointInPolygonConfig {
  boundaryRule: BoundaryRule;
}

/** Swift PointInPolygonConfig.default 대응. */
export const defaultPointInPolygonConfig: PointInPolygonConfig = {
  boundaryRule: 'leftBottomInclusive',
};

/**
 * Coordinate → 평면 좌표 (x = lon, y = lat).
 * lat/lon ↔ x/y 매핑은 버그가 가장 잘 생기는 지점이라 여기 한 곳에서만 변환한다.
 */
function planar(coordinate: Coordinate): { x: number; y: number } {
  return { x: coordinate.lon, y: coordinate.lat };
}

/**
 * 단일 링(외곽 또는 홀)에 대한 crossing-number 판정 (+x 방향 광선).
 *
 * - half-open 비교 `(vi.y > p.y) !== (vj.y > p.y)`: 수평 변·py 높이 꼭짓점 중복카운트를 구조적으로 배제.
 * - 제수 `(vj.y - vi.y)`는 비교가 참일 때만 도달하므로 절대 0이 아니다(epsilon 불필요).
 * - strict `p.x < xIntersect` 비교가 "좌하단 포함" 경계 규칙을 구조적으로 만든다.
 *
 * 링 점이 3개 미만이면 면적이 없으므로 항상 false. private(미export).
 */
function ringContains(point: Coordinate, ring: Coordinate[]): boolean {
  const n = ring.length;
  if (!(n >= 3)) {
    return false;
  }

  const p = planar(point);
  let inside = false;

  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const vi = planar(ring[i]);
    const vj = planar(ring[j]);

    if ((vi.y > p.y) !== (vj.y > p.y)) {
      // 변 (vj → vi)이 수평선 y = p.y 를 가로지름. 교차점의 x 좌표 계산.
      // 연산 순서(곱→나눗셈→덧셈)와 결합을 그대로 유지 — float64 비트 동일.
      const xIntersect = ((vj.x - vi.x) * (p.y - vi.y)) / (vj.y - vi.y) + vi.x;
      if (p.x < xIntersect) {
        inside = !inside;
      }
    }
    j = i;
  }
  return inside;
}

/**
 * 점이 단일 Polygon 내부인지 판정 (crossing-number ray-cast, +x 방향 광선).
 * 외곽 링 안 && 어떤 홀에도 없음 → true. 경계 규칙: 좌하단(최소 lat/최소 lon 변) 포함.
 * Swift: pointInPolygon(_:in: Polygon, config:)
 */
export function pointInPolygon(
  point: Coordinate,
  polygon: Polygon,
  // config는 현재 단일 enum 케이스로 런타임 분기 없음 — API 형태 보존용(향후 규칙 확장 + 스모크 대상).
  config: PointInPolygonConfig = defaultPointInPolygonConfig,
): boolean {
  void config;
  if (!ringContains(point, polygon.outer)) {
    return false;
  }
  for (const hole of polygon.holes) {
    if (ringContains(point, hole)) {
      return false;
    }
  }
  return true;
}

/**
 * 점이 MultiPolygon 내부인지 판정. 구성 폴리곤 중 하나라도(각자 홀 규칙) 내부면 true.
 * Swift: pointInPolygon(_:in: MultiPolygon, config:) — TS는 타입 오버로드 불가하므로 별도 이름.
 */
export function pointInMultiPolygon(
  point: Coordinate,
  multiPolygon: MultiPolygon,
  config: PointInPolygonConfig = defaultPointInPolygonConfig,
): boolean {
  return multiPolygon.polygons.some((polygon) => pointInPolygon(point, polygon, config));
}
