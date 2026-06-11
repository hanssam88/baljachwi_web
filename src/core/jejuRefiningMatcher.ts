// src/core/jejuRefiningMatcher.ts — 1차 매처(byte-faithful, 불변) 위 제주 읍면동 2차 레이어.
// RegionMatcher subclass: 코어 미수정 + nominal type 만족. 제주(50110/50130)만 동 코드로 정제.
import type { Coordinate } from './geoTypes';
import { RegionMatcher } from './regionMatcher';
import type { GeoDataStore } from './geoDataStore';
import { refineJeju, type JejuDong } from './jejuRefiner';

const JEJU_SGG = new Set(['50110', '50130']);

export class JejuRefiningMatcher extends RegionMatcher {
  private readonly dongs: readonly JejuDong[];
  constructor(store: GeoDataStore, dongs: readonly JejuDong[]) {
    super(store);
    this.dongs = dongs;
  }
  override regionCode(coordinate: Coordinate): string | null {
    const base = super.regionCode(coordinate);
    if (base !== null && JEJU_SGG.has(base)) {
      return refineJeju(coordinate, this.dongs) ?? base; // 정제 실패해도 base 유지(안전망)
    }
    return base;
  }
}
