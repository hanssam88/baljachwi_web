// tests/components/tileConsent.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { hasTileConsent, setTileConsent, TILE_NOTICE_KEY } from '@/components/map/tileConsent';

describe('tileConsent', () => {
  beforeEach(() => localStorage.clear());

  it('미동의 기본은 false', () => {
    expect(hasTileConsent()).toBe(false);
  });
  it('setTileConsent 후 true + 키에 값 저장', () => {
    setTileConsent();
    expect(localStorage.getItem(TILE_NOTICE_KEY)).toBeTruthy();
    expect(hasTileConsent()).toBe(true);
  });
  it('기존 값(임의 truthy)도 동의로 인정(하위호환)', () => {
    localStorage.setItem(TILE_NOTICE_KEY, '1');
    expect(hasTileConsent()).toBe(true);
  });
});
