// src/lib/regionLayerStyle.ts — 지역 MapLibre 레이어 스타일 빌더.
// 순수 부분(설정·색 식·검증)은 테스트 대상. resolveStateColors만 DOM 의존(테스트 제외).

import type { Level } from '@/components/region/LevelToggle';

export interface LevelLayerConfig {
  url: string;
  codeProp: string;
  nameProp: string;
  total: number;
}

/** 레벨별 표시용 geojson URL·코드/이름 속성·총 지역수. (시도는 sido_display, 시군구는 sigungu_display) */
export function levelLayerConfig(level: Level): LevelLayerConfig {
  return level === 'sigungu'
    ? { url: '/geo/sigungu_display.geojson', codeProp: 'sgg', nameProp: 'sggnm', total: 255 }
    : { url: '/geo/sido_display.geojson', codeProp: 'sido', nameProp: 'sidonm', total: 17 };
}

export interface StateColors {
  visited: string;
  want: string;
  unvisited: string;
  separator: string;
  label: string;
  surface: string;
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const SAFE_UNVISITED = '#DDDDE3';

/** maplibre paint 주입 전 색 검증(다크/사용자 테마 대비). 비정상 값은 안전 기본색. */
export function sanitizeColor(c: string, fallback = SAFE_UNVISITED): string {
  const v = (c ?? '').trim();
  return HEX.test(v) ? v : fallback;
}

/** feature-state 'state'(방문상태) → fill-color match 식. 미설정(null)=미방문 기본색(마지막 인자). */
export function buildFillColorExpression(colors: StateColors): unknown[] {
  return [
    'match',
    ['feature-state', 'state'],
    'visited', sanitizeColor(colors.visited),
    'wantToGo', sanitizeColor(colors.want),
    sanitizeColor(colors.unvisited),
  ];
}

/** runtime CSS 토큰 → 색. DOM 의존(테스트 제외, 얇은 어댑터). */
export function resolveStateColors(): StateColors {
  const cs = getComputedStyle(document.documentElement);
  const get = (n: string) => cs.getPropertyValue(n).trim();
  return {
    visited: get('--st-visited'),
    want: get('--st-want'),
    unvisited: get('--st-unvisited'),
    separator: get('--separator'),
    label: get('--label'),
    surface: get('--surface'),
  };
}
