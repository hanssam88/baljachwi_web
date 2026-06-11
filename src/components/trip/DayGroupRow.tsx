'use client';
// src/components/trip/DayGroupRow.tsx — 날짜별 일자 카드 한 행. 본문(onOpen) + 우측 ⋯(onManage, 사진 삭제 진입).
import type { CSSProperties } from 'react';
import { TYPE } from '@/lib/tokens';
import { tripDisplayName } from '@/components/trip/tripLabel';
import { dayLabel, type DayGroup } from '@/lib/dayGroups';

export function DayGroupRow({
  group,
  names,
  onOpen,
  onManage,
}: {
  group: DayGroup;
  names: Record<string, string>;
  onOpen: (group: DayGroup) => void;
  onManage: (group: DayGroup) => void;
}) {
  // group.photos는 takenAt 오름차순(groupPhotosByDay 보장) → 지역 노출 순서 = 촬영 순서(의도).
  const region = tripDisplayName(null, group.photos, names);
  return (
    <div style={row}>
      <button type="button" style={main} onClick={() => onOpen(group)}>
        <span style={dateText}>{dayLabel(group.localDay)}</span>
        <span style={meta}>{region} · {group.photos.length}장</span>
      </button>
      <button type="button" style={kebab} aria-label="더보기" onClick={() => onManage(group)}>⋯</button>
    </div>
  );
}

const row: CSSProperties = {
  display: 'flex', alignItems: 'stretch', width: '100%',
  borderBottom: '1px solid var(--separator)', background: 'var(--surface)',
};
const main: CSSProperties = {
  flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
  padding: 'var(--space-3) var(--space-4)', border: 'none', background: 'transparent',
  textAlign: 'left', cursor: 'pointer',
};
const dateText: CSSProperties = { fontSize: TYPE.headline.size, fontWeight: TYPE.headline.weight, color: 'var(--label)' };
const meta: CSSProperties = { fontSize: TYPE.subheadline.size, color: 'var(--label2)' };
const kebab: CSSProperties = {
  flexShrink: 0, width: 48, minHeight: 44, border: 'none', background: 'transparent',
  color: 'var(--label2)', fontSize: 22, lineHeight: 1, cursor: 'pointer', // minHeight 44: 터치 타깃(L-1)
};
