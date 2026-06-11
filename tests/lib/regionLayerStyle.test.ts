// tests/lib/regionLayerStyle.test.ts
import { describe, it, expect } from 'vitest';
import { levelLayerConfig, sanitizeColor, buildFillColorExpression } from '@/lib/regionLayerStyle';

describe('levelLayerConfig', () => {
  it('시군구 설정', () => {
    expect(levelLayerConfig('sigungu')).toEqual({
      url: '/geo/sigungu_display.geojson', codeProp: 'sgg', nameProp: 'sggnm', total: 255,
    });
  });
  it('시도 설정', () => {
    expect(levelLayerConfig('sido')).toEqual({
      url: '/geo/sido_display.geojson', codeProp: 'sido', nameProp: 'sidonm', total: 17,
    });
  });
});

describe('sanitizeColor', () => {
  it('정상 hex 통과', () => {
    expect(sanitizeColor('#3A9D6B')).toBe('#3A9D6B');
    expect(sanitizeColor('  #fff ')).toBe('#fff');
  });
  it('비정상 값 → fallback(주입 방지)', () => {
    expect(sanitizeColor('red')).toBe('#DDDDE3');
    expect(sanitizeColor('')).toBe('#DDDDE3');
    expect(sanitizeColor('#fff; }')).toBe('#DDDDE3');
    expect(sanitizeColor('', '#000')).toBe('#000');
  });
});

describe('buildFillColorExpression', () => {
  const colors = {
    visited: '#3A9D6B', want: '#E0982E', unvisited: '#DDDDE3',
    separator: '#D7D7DC', label: '#111', surface: '#fff',
  };
  it('feature-state state → 색 match 식, 기본=미방문', () => {
    expect(buildFillColorExpression(colors)).toEqual([
      'match', ['feature-state', 'state'],
      'visited', '#3A9D6B',
      'wantToGo', '#E0982E',
      '#DDDDE3',
    ]);
  });
  it('비정상 색은 fill 식에서도 무력화', () => {
    const e = buildFillColorExpression({ ...colors, visited: 'url(x)' }) as string[];
    expect(e[3]).toBe('#DDDDE3'); // visited 자리 sanitize
  });
});
