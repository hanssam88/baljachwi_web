// src/components/region/Legend.tsx — 방문/가고싶음/미방문 색 범례.

import type { CSSProperties } from 'react';
import { TYPE } from '@/lib/tokens';

const ITEMS: { label: string; varName: string }[] = [
  { label: '방문', varName: '--st-visited' },
  { label: '가고싶음', varName: '--st-want' },
  { label: '미방문', varName: '--st-unvisited' },
];

export function Legend() {
  return (
    <div style={legend} aria-label="범례">
      {ITEMS.map((it) => (
        <span key={it.label} style={item}>
          <span style={{ ...swatch, background: `var(${it.varName})` }} aria-hidden />
          {it.label}
        </span>
      ))}
    </div>
  );
}

const legend: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 'var(--space-4)',
  padding: 'var(--space-2) 0',
};
const item: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  fontSize: TYPE.caption.size,
  color: 'var(--label2)',
};
const swatch: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 3,
  border: '1px solid var(--separator)',
};
