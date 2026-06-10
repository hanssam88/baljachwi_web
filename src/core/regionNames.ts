// src/core/regionNames.ts
//
// Swift BaljachwiCore/RegionNames.swift 의 byte-faithful 포트.
//
// regionCode → 표시명 사전(순수). 시군구="시도약칭 시군구명"("부산 연제구"), 시도=nameKo 그대로.
// region_codes.json(작음)만으로 동작 — 11MB 매칭 폴리곤 없이 경로 탭 표시명을 만든다.
//
// IO 경계 분리: Swift init은 Bundle.module에서 region_codes.json 을 읽지만, TS는 파싱된 entries를 받는다.

import type { RegionCodeEntry } from './geoDataStore';

// ── 보존 상수 (constants) ──────────────────────────────────────────
// 배열 순서 보존 필수 — "특별자치도"가 "도"보다 먼저여야 "강원특별자치도"→"강원"(역순이면 "강원특별자치").
const SIDO_SUFFIXES = ['특별자치도', '특별자치시', '특별시', '광역시', '도'] as const;
const LEVEL_SIDO = 'sido';
const LEVEL_SIGUNGU = 'sigungu';

/**
 * 시도 약칭 — 행정 접미사 제거. Swift static func shorten 대응 (테스트가 직접 호출).
 * 접미사 검사 순서가 로직의 일부: "특별자치도"가 "도"보다 먼저.
 * 접미사는 전부 BMP 한글 → Swift Character 수 == JS UTF-16 length, slice가 안전.
 */
export function shorten(sido: string): string {
  for (const suffix of SIDO_SUFFIXES) {
    if (sido.endsWith(suffix)) {
      return sido.slice(0, sido.length - suffix.length);
    }
  }
  return sido;
}

/**
 * regionCode → 표시명 사전(순수). 시군구="시도약칭 시군구명", 시도=nameKo.
 */
export class RegionNames {
  /** regionCode → 표시명. 시군구="시도약칭 시군구명", 시도=nameKo. */
  readonly names: Map<string, string>;

  /** @param entries  JSON.parse(region_codes.json) 결과 */
  constructor(entries: RegionCodeEntry[]) {
    // 시도 regionCode → 약칭. Swift Dictionary(uniquingKeysWith: {first,_ in first}) → first-wins.
    const shortSido = new Map<string, string>();
    for (const e of entries) {
      if (e.level === LEVEL_SIDO) {
        if (!shortSido.has(e.regionCode)) {
          shortSido.set(e.regionCode, shorten(e.nameKo));
        }
      }
    }

    // entries 순서대로 순회 — 중복 regionCode는 나중 값이 덮어씀(Swift dict 대입과 동일, Map.set).
    const dict = new Map<string, string>();
    for (const e of entries) {
      const s = e.level === LEVEL_SIGUNGU ? shortSido.get(e.sidoCode) : undefined;
      if (e.level === LEVEL_SIGUNGU && s !== undefined) {
        dict.set(e.regionCode, `${s} ${e.nameKo}`);
      } else {
        // 시도이거나, sigungu인데 sidoCode가 shortSido에 없으면 bare nameKo 폴백(보존).
        dict.set(e.regionCode, e.nameKo);
      }
    }
    this.names = dict;
  }
}
