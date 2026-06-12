'use client';
// src/components/common/Icon.tsx — 인라인 SVG stroke 아이콘 세트.
// design-mockups/mapviz.jsx 의 ICON_PATHS 를 실제 사용처가 있는 것만 이식.
// 모든 아이콘: viewBox 0 0 24 24, fill=none, stroke=currentColor(부모 색 상속), round cap/join.
import type { CSSProperties, ReactNode } from 'react';

// 사용처가 확정된 아이콘만 등록(데이터 정직성 — 가상 통계용 아이콘은 만들지 않는다).
const PATHS = {
  // 하단 탭
  region: (
    <>
      <path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M8.4 6.4H14a3 3 0 0 1 0 6H10a3 3 0 0 0 0 6h5.4" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>
  ),
  // 액션/헤더
  plus: <path d="M12 5v14M5 12h14" />,
  upload: (
    <>
      <path d="M12 16V5" />
      <path d="m7.5 9.5 4.5-5 4.5 5" />
      <path d="M5 19h14" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="11" width="13" height="9" rx="2" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  footprint: (
    <>
      <ellipse cx="9" cy="9" rx="3" ry="4" />
      <path d="M6.5 15c0 2 1 3 2.5 3s2.5-1 2.5-3-1-2-2.5-2-2.5 0-2.5 2z" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </>
  ),
  bookmark: <path d="M7 4h10v16l-5-3.5L7 20z" />,
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </>
  ),
  chevronLeft: <path d="m15 5-7 7 7 7" />,
  dots: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function Icon({
  name,
  size = 22,
  color = 'currentColor',
  strokeWidth = 1.8,
  label,
  style,
  className,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** 단독으로 의미를 전달할 때만 지정 — 있으면 role=img + aria-label, 없으면 장식용(aria-hidden). */
  label?: string;
  style?: CSSProperties;
  className?: string;
}) {
  const a11y = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...a11y}
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
