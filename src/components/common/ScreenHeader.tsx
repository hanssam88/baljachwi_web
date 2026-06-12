'use client';
// src/components/common/ScreenHeader.tsx — 화면 상단 큰 타이틀 + 선택적 우측 아이콘 액션(Direction A).
import type { CSSProperties } from 'react';
import { Icon, type IconName } from '@/components/common/Icon';
import { TYPE } from '@/lib/tokens';

export function ScreenHeader({
  title,
  action,
}: {
  title: string;
  action?: { icon: IconName; label: string; onClick: () => void };
}) {
  return (
    <header style={wrap}>
      <h1 style={titleText}>{title}</h1>
      {action && (
        <button type="button" onClick={action.onClick} aria-label={action.label} style={actionBtn}>
          <Icon name={action.icon} size={22} color="var(--accent)" />
        </button>
      )}
    </header>
  );
}

const wrap: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4) var(--space-2)',
};
const titleText: CSSProperties = {
  margin: 0,
  fontSize: TYPE.largeTitle.size,
  fontWeight: TYPE.largeTitle.weight,
  lineHeight: TYPE.largeTitle.lineHeight,
  letterSpacing: '-0.5px',
  color: 'var(--label)',
};
const actionBtn: CSSProperties = {
  flex: '0 0 auto',
  width: 40,
  height: 40,
  display: 'grid',
  placeItems: 'center',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  background: 'var(--fill)',
  color: 'var(--accent)',
  cursor: 'pointer',
};
