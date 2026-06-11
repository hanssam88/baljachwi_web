// src/components/map/tileConsent.ts — 외부 타일 동의(경로/지역지도 공유). 순수 로직(테스트 대상).
// 두 지도 모두 같은 키를 공유 → 한 번 동의하면 양쪽에 적용.

export const TILE_NOTICE_KEY = 'baljachwi-tile-notice-ack';

export function hasTileConsent(): boolean {
  return typeof localStorage !== 'undefined' && !!localStorage.getItem(TILE_NOTICE_KEY);
}

export function setTileConsent(): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(TILE_NOTICE_KEY, '1');
}
