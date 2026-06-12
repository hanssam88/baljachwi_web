'use client';
// src/components/common/StatCard.tsx — 큰 숫자 + 라벨 + 선택적 진행바 카드(Direction A 통계 헤더).
// progress 는 반드시 실데이터(예: 방문 시군구/전체 시군구)로만 전달한다 — 없으면 바를 그리지 않는다.
import type { CSSProperties } from 'react';
import { TYPE } from '@/lib/tokens';

export function StatCard({
  value,
  unit,
  label,
  progress,
}: {
  value: number | string;
  unit?: string;
  label: string;
  progress?: { current: number; total: number };
}) {
  // total>0 인 실데이터일 때만 진행률 계산 — 그 외에는 바 미표시(가상 통계 방지).
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : null;

  return (
    <div style={card}>
      <div style={numberRow}>
        <span style={big}>{value}</span>
        {unit && <span style={unitText}>{unit}</span>}
      </div>
      <p style={labelText}>{label}</p>
      {pct !== null && (
        <div
          style={track}
          role="progressbar"
          aria-label={label}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div style={{ ...fill, width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

const card: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius-xl)',
  padding: 'var(--space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};
const numberRow: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 'var(--space-1)' };
const big: CSSProperties = {
  fontSize: TYPE.largeTitle.size,
  fontWeight: TYPE.largeTitle.weight,
  lineHeight: 1,
  color: 'var(--label)',
  letterSpacing: '-0.5px',
};
const unitText: CSSProperties = {
  fontSize: TYPE.headline.size,
  fontWeight: 600,
  color: 'var(--label2)',
};
const labelText: CSSProperties = {
  margin: 0,
  fontSize: TYPE.subheadline.size,
  color: 'var(--label2)',
};
const track: CSSProperties = {
  height: 6,
  borderRadius: 999,
  background: 'var(--fill)',
  overflow: 'hidden',
  marginTop: 'var(--space-1)',
};
const fill: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'var(--accent)',
  transition: 'width .3s ease',
};
