// src/components/region/LevelToggle.tsx — 시군구/시도 세그먼티드 토글.

import type { CSSProperties } from 'react';
import { TYPE } from '@/lib/tokens';

export type Level = 'sigungu' | 'sido';

export function LevelToggle({ level, onChange }: { level: Level; onChange: (l: Level) => void }) {
  return (
    <div style={seg} role="tablist" aria-label="지도 레벨">
      {(['sigungu', 'sido'] as Level[]).map((l) => {
        const on = l === level;
        return (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(l)}
            style={{ ...segBtn, ...(on ? segBtnOn : null) }}
          >
            {l === 'sigungu' ? '시군구' : '시도'}
          </button>
        );
      })}
    </div>
  );
}

const seg: CSSProperties = {
  display: 'flex',
  margin: 'var(--space-2) auto 0',
  maxWidth: 220,
  background: 'var(--fill)',
  borderRadius: 'var(--radius-sm)',
  padding: 2,
};
const segBtn: CSSProperties = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  padding: '6px 0',
  fontSize: TYPE.caption.size,
  color: 'var(--label2)',
  borderRadius: 6,
  cursor: 'pointer',
};
const segBtnOn: CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--label)',
  fontWeight: 600,
};
