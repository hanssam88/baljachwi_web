import { describe, it, expect } from 'vitest';
import { resolveTokens, TYPE } from '@/lib/tokens';

// design/tokens.js 포트의 골든 — 확정 조합 nature + semantic 이 styles/tokens.css 와
// 정확히 일치하는지 보장(단일 출처화). 드리프트 시 실패.
describe('resolveTokens', () => {
  it('nature · light · semantic = 확정 앱 팔레트', () => {
    const t = resolveTokens('nature', 'light', 'semantic');
    expect(t['--accent']).toBe('#2E7D5B');
    expect(t['--st-visited']).toBe('#3A9D6B');
    expect(t['--st-want']).toBe('#E0982E');
    expect(t['--st-unvisited']).toBe('#DDDDE3');
    expect(t['--bg']).toBe('#F2F2F7');
    expect(t['--surface']).toBe('#FFFFFF');
    expect(t['--label']).toBe('#1C1C1E');
    expect(t['--separator']).toBe('#D7D7DC');
  });

  it('nature · dark · semantic', () => {
    const t = resolveTokens('nature', 'dark', 'semantic');
    expect(t['--accent']).toBe('#5BC08A');
    expect(t['--st-visited']).toBe('#4FB888');
    expect(t['--st-want']).toBe('#F0B84E');
    expect(t['--st-unvisited']).toBe('#38383E');
    expect(t['--bg']).toBe('#000000');
    expect(t['--label']).toBe('#F5F5F7');
  });

  it('mono 팔레트는 accent 파생 3단 계조를 사용', () => {
    const t = resolveTokens('nature', 'light', 'mono');
    expect(t['--st-visited']).toBe('#2E7D5B');
    expect(t['--st-want']).toBe('#8FC3AB');
    expect(t['--st-unvisited']).toBe('#DEEAE3');
  });

  it('모든 필수 CSS 변수 키를 포함', () => {
    const t = resolveTokens('nature', 'light', 'semantic');
    for (const key of [
      '--bg', '--surface', '--surface2', '--label', '--label2', '--label3',
      '--separator', '--fill', '--accent', '--st-visited', '--st-want', '--st-unvisited',
    ]) {
      expect(t[key], `누락된 토큰 키: ${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// 타입스케일 — 스펙 "타입스케일 이식" 항목. 컴포넌트가 참조하는 단일 출처이므로
// 값 드리프트를 골든으로 고정한다.
describe('TYPE 스케일', () => {
  it('iOS text style → 웹 px/weight/lineHeight 골든', () => {
    expect(TYPE.largeTitle).toEqual({ size: 34, weight: 700, lineHeight: 1.2 });
    expect(TYPE.title2).toEqual({ size: 22, weight: 700, lineHeight: 1.25 });
    expect(TYPE.title3).toEqual({ size: 20, weight: 400, lineHeight: 1.3 });
    expect(TYPE.headline).toEqual({ size: 17, weight: 600, lineHeight: 1.35 });
    expect(TYPE.subheadline).toEqual({ size: 15, weight: 400, lineHeight: 1.45 });
    expect(TYPE.caption).toEqual({ size: 12, weight: 400, lineHeight: 1.4 });
  });

  it('weight 는 bold/semibold/regular 만 사용', () => {
    for (const s of Object.values(TYPE)) {
      expect([400, 600, 700]).toContain(s.weight);
    }
  });
});
