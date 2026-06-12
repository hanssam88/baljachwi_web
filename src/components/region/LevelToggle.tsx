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

// 헤더 한 행에 인라인 배치 — 가운데 정렬 margin 제거하고 내용 너비로 축소.
const seg: CSSProperties = {
  display: 'inline-flex',
  flexShrink: 0,
  background: 'var(--fill)',
  borderRadius: 'var(--radius-sm)',
  padding: 2,
};
const segBtn: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: '5px 12px',
  fontSize: TYPE.caption.size,
  color: 'var(--label2)',
  borderRadius: 6,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const segBtnOn: CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--label)',
  fontWeight: 600,
};
