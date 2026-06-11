'use client';

// src/components/trip/DayGroupRow.tsx — 날짜별 일자 카드 한 행(날짜 + 지역요약 + 사진수).
import type { CSSProperties } from 'react';
import { TYPE } from '@/lib/tokens';
import { tripDisplayName } from '@/components/trip/tripLabel';
import { dayLabel, type DayGroup } from '@/lib/dayGroups';

export function DayGroupRow({
  group,
  names,
  onOpen,
}: {
  group: DayGroup;
  names: Record<string, string>;
  onOpen: (group: DayGroup) => void;
}) {
  // 그날 방문 지역 요약("부산 연제구 · 해운대구 외 N곳", 모두 미상이면 "위치 미상").
  // group.photos는 takenAt 오름차순(groupPhotosByDay 보장) → 지역 노출 순서 = 촬영 순서(의도).
  const region = tripDisplayName(null, group.photos, names);
  return (
    <button type="button" style={row} onClick={() => onOpen(group)}>
      <span style={dateText}>{dayLabel(group.localDay)}</span>
      <span style={meta}>
        {region} · {group.photos.length}장
      </span>
    </button>
  );
}

const row: CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%',
  padding: 'var(--space-3) var(--space-4)', border: 'none',
  borderBottom: '1px solid var(--separator)', background: 'var(--surface)',
  textAlign: 'left', cursor: 'pointer',
};
const dateText: CSSProperties = {
  fontSize: TYPE.headline.size, fontWeight: TYPE.headline.weight, color: 'var(--label)',
};
const meta: CSSProperties = { fontSize: TYPE.subheadline.size, color: 'var(--label2)' };
