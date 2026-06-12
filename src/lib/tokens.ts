// 디자인 토큰 — iOS repo design/tokens.js 의 byte-faithful 포트.
// 단일 출처: styles/tokens.css(확정 nature+semantic)와 resolveTokens 결과가 일치(테스트로 보장).
// 값은 해결된 sRGB hex(라이트/다크) — 그대로 CSS 변수에 주입.

export type Appearance = 'light' | 'dark';
export type AccentName = 'nature' | 'warm' | 'cool';
export type Palette = 'semantic' | 'mono';

// ---- Neutrals (iOS 정렬, appearance-aware) ----
export const NEUTRAL = {
  light: { bg: '#F2F2F7', surface: '#FFFFFF', surface2: '#F7F7FA', label: '#1C1C1E', label2: '#6E6E73', label3: '#B4B4BB', separator: '#D7D7DC', fill: '#ECECEF' },
  dark: { bg: '#000000', surface: '#1C1C1E', surface2: '#2C2C2E', label: '#F5F5F7', label2: '#9A9AA0', label3: '#5C5C61', separator: '#3A3A3C', fill: '#2C2C2E' },
} as const;

// ---- Accent (앱의 단일 personality 색) ----
export const ACCENT = {
  nature: { label: '딥 그린', light: '#2E7D5B', dark: '#5BC08A' },
  warm: { label: '테라코타', light: '#C25A3E', dark: '#E07856' },
  cool: { label: '딥 틸', light: '#0E7C86', dark: '#4FB3BF' },
} as const;

// ---- Status — Model A: 의미색(accent 독립) ----
export const STATUS_SEMANTIC = {
  light: { visited: '#3A9D6B', want: '#E0982E', unvisited: '#DDDDE3' },
  dark: { visited: '#4FB888', want: '#F0B84E', unvisited: '#38383E' },
} as const;

// ---- Danger — 삭제·오류 등 위험 액션 의미색(accent·palette 독립, appearance-aware) ----
export const DANGER = {
  light: '#C2453A',
  dark: '#E0695E',
} as const;

// ---- Status — Model B: 단일 액센트 3단 계조 ----
export const STATUS_MONO = {
  nature: { light: { visited: '#2E7D5B', want: '#8FC3AB', unvisited: '#DEEAE3' }, dark: { visited: '#5BC08A', want: '#357056', unvisited: '#1F2A24' } },
  warm: { light: { visited: '#C25A3E', want: '#DD9B86', unvisited: '#F0E2DC' }, dark: { visited: '#E07856', want: '#A65C44', unvisited: '#332823' } },
  cool: { light: { visited: '#0E7C86', want: '#7FBEC6', unvisited: '#DCEAEC' }, dark: { visited: '#4FB3BF', want: '#2F7079', unvisited: '#1E2A2C' } },
} as const;

export const SPACE = [4, 8, 12, 16, 20, 24] as const;
// xl(20): Direction A 이식 — 큰 카드·바텀시트·지도 컨테이너의 부드러운 코너 위계.
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20 } as const;

// ---- Type scale (iOS text styles → 웹 px/weight) ----
// design/tokens.js TYPE 의 의도(token·weight)를 웹 수치로 이식. weight: bold=700/semibold=600/regular=400.
// 단일 출처 — 컴포넌트는 하드코딩 대신 이 스케일을 참조한다.
export interface TypeStyle {
  size: number;
  weight: number;
  lineHeight: number;
}
export const TYPE = {
  largeTitle: { size: 34, weight: 700, lineHeight: 1.2 }, // 지역상세 지역명
  title2: { size: 22, weight: 700, lineHeight: 1.25 }, // 방문 N곳 폴백
  title3: { size: 20, weight: 400, lineHeight: 1.3 }, // 지역상세 사진수
  headline: { size: 17, weight: 600, lineHeight: 1.35 }, // 여행 행 지역 요약
  subheadline: { size: 15, weight: 400, lineHeight: 1.45 }, // 정복률·날짜·보조 텍스트
  caption: { size: 12, weight: 400, lineHeight: 1.4 }, // 범례·상태 캡션
} as const satisfies Record<string, TypeStyle>;

/** (accent, appearance, palette) 조합 → flat CSS 변수 맵. 앱 확정값은 nature+semantic. */
export function resolveTokens(
  accent: AccentName,
  appearance: Appearance,
  palette: Palette,
): Record<string, string> {
  const n = NEUTRAL[appearance];
  const acc = ACCENT[accent][appearance];
  const st = palette === 'semantic' ? STATUS_SEMANTIC[appearance] : STATUS_MONO[accent][appearance];
  return {
    '--bg': n.bg,
    '--surface': n.surface,
    '--surface2': n.surface2,
    '--label': n.label,
    '--label2': n.label2,
    '--label3': n.label3,
    '--separator': n.separator,
    '--fill': n.fill,
    '--accent': acc,
    '--st-visited': st.visited,
    '--st-want': st.want,
    '--st-unvisited': st.unvisited,
    '--danger': DANGER[appearance],
  };
}

/** 런타임에 엘리먼트(보통 <html>)에 토큰을 적용 + data-appearance 설정. */
export function applyTokens(
  el: HTMLElement,
  accent: AccentName,
  appearance: Appearance,
  palette: Palette,
): void {
  const t = resolveTokens(accent, appearance, palette);
  for (const k in t) el.style.setProperty(k, t[k]);
  el.dataset.appearance = appearance;
}
