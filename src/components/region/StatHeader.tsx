// src/components/region/StatHeader.tsx — "시군구 n/total 정복 · pct%".
// 정복률 = round(visited/total*100) — iOS RegionMapScreen.percent 와 동일(.rounded()).

import type { CSSProperties } from 'react';
import { TYPE } from '@/lib/tokens';

export function StatHeader({
  level,
  visitedCount,
  total,
}: {
  level: 'sigungu' | 'sido';
  visitedCount: number;
  total: number;
}) {
  const label = level === 'sigungu' ? '시군구' : '시도';
  const pct = total > 0 ? Math.round((visitedCount / total) * 100) : 0;
  return (
    <p style={header}>
      {label} {visitedCount}/{total} 정복 · {pct}%
    </p>
  );
}

const header: CSSProperties = {
  margin: 0,
  padding: 'var(--space-2) 0',
  textAlign: 'center',
  fontSize: TYPE.subheadline.size,
  color: 'var(--label2)',
};
