// src/core/displayGeoStore.ts
//
// Swift BaljachwiCore/DisplayGeoStore.swift 의 byte-faithful 포트.
//
// 표시용(단순화) 폴리곤 저장소 — choropleth 렌더 전용. 매칭에 절대 사용 금지(경계 변형 → 오분류).
//
// IO 경계 분리 + Level→파일 결합 해제:
//   Swift는 level이 리소스 파일(sigungu_display/sido_display)과 codeKey를 함께 선택했지만,
//   TS는 파싱된 geojson을 인자로 받고 level은 codeKey만 선택한다("sigungu"→"sgg", "sido"→"sido").
//   level과 geojson 파일의 불일치 방지는 로더 책임 — 로더가 (파일, level) 쌍을 고정해 노출한다.

import type { MultiPolygon, BBox } from './geoTypes';
import { polygonsFromGeoJSON, type CodeKey } from './geojsonDecode';

/** 표시 레벨 — Swift enum Level { sigungu, sido } 대응. */
export type DisplayLevel = 'sigungu' | 'sido';

// ── 보존 상수 (constants) ──────────────────────────────────────────
const LEVEL_SIGUNGU: DisplayLevel = 'sigungu';
const LEVEL_SIDO: DisplayLevel = 'sido';
const DEFAULT_LEVEL: DisplayLevel = LEVEL_SIGUNGU;
// codeKey 매핑: sigungu→"sgg", sido→"sido".
const CODE_KEY_BY_LEVEL: Record<DisplayLevel, CodeKey> = {
  sigungu: 'sgg',
  sido: 'sido',
};

/**
 * 모든 outer ring 좌표에서 bbox 누적(holes는 outer 안이라 outer만으로 충분).
 * 초기값은 ±Number.MAX_VALUE(= Swift Double.greatestFiniteMagnitude). Infinity로 바꾸지 말 것(byte-faithful).
 * min/max 누적이라 Map 순회 순서 무관. 빈 polygons 입력 시 Swift처럼 뒤집힌 bbox(MAX/-MAX) 반환 — 가드 추가 금지.
 */
function computeBBox(polygons: Map<string, MultiPolygon>): BBox {
  let minLat = Number.MAX_VALUE;
  let minLon = Number.MAX_VALUE;
  let maxLat = -Number.MAX_VALUE;
  let maxLon = -Number.MAX_VALUE;
  for (const mp of polygons.values()) {
    for (const poly of mp.polygons) {
      for (const c of poly.outer) {
        minLat = Math.min(minLat, c.lat);
        minLon = Math.min(minLon, c.lon);
        maxLat = Math.max(maxLat, c.lat);
        maxLon = Math.max(maxLon, c.lon);
      }
    }
  }
  return { minLat, minLon, maxLat, maxLon };
}

/**
 * 표시용(단순화) 폴리곤 저장소.
 *   level="sigungu" ↔ sigungu_display.geojson(codeKey "sgg"),
 *   level="sido"    ↔ sido_display.geojson(codeKey "sido").
 */
export class DisplayGeoStore {
  /** regionCode → 표시용 MultiPolygon. */
  readonly polygons: Map<string, MultiPolygon>;

  /** 전 폴리곤 outer ring 합집합 bbox (투영 fit용). */
  readonly bbox: BBox;

  /**
   * @param geojson  JSON.parse(sigungu_display.geojson 또는 sido_display.geojson) 결과
   * @param level    표시 레벨(codeKey 선택). 기본 "sigungu".
   */
  constructor(geojson: unknown, level: DisplayLevel = DEFAULT_LEVEL) {
    const codeKey = CODE_KEY_BY_LEVEL[level];
    this.polygons = polygonsFromGeoJSON(geojson, codeKey);
    this.bbox = computeBBox(this.polygons);
  }
}

export { LEVEL_SIGUNGU, LEVEL_SIDO };
