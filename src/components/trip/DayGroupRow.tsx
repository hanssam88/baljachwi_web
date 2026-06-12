'use client';
// src/components/trip/DayGroupRow.tsx — 날짜별 일자 카드 한 행. 커버 썸네일 + 본문(onOpen) + 우측 ⋯(onManage, 사진 삭제 진입).
import type { CSSProperties } from 'react';
import { TYPE } from '@/lib/tokens';
import { tripDisplayName } from '@/components/trip/tripLabel';
import { dayLabel, type DayGroup } from '@/lib/dayGroups';
import { Icon } from '@/components/common/Icon';

export function DayGroupRow({
  group,
  names,
  coverUrl,
  onOpen,
  onManage,
}: {
  group: DayGroup;
  names: Record<string, string>;
  /** 그룹 대표(첫) 사진 썸네일 objectURL. 없으면 플레이스홀더. */
  coverUrl?: string;
  onOpen: (group: DayGroup) => void;
  onManage: (group: DayGroup) => void;
}) {
  // group.photos는 takenAt 오름차순(groupPhotosByDay 보장) → 지역 노출 순서 = 촬영 순서(의도).
  const region = tripDisplayName(null, group.photos, names);
  return (
    <div style={row}>
      <button type="button" style={main} onClick={() => onOpen(group)}>
        <span style={cover}>
          {coverUrl ? (
            <img src={coverUrl} alt="" style={coverImg} />
          ) : (
            <Icon name="camera" size={20} color="var(--label3)" />
          )}
        </span>
        <span style={textCol}>
          <span style={dateText}>{dayLabel(group.localDay)}</span>
          <span style={meta}>{region} · {group.photos.length}장</span>
        </span>
      </button>
      <button type="button" style={kebab} aria-label="더보기" onClick={() => onManage(group)}>
        <Icon name="dots" size={20} />
      </button>
    </div>
  );
}

const row: CSSProperties = {
  display: 'flex', alignItems: 'stretch', width: '100%',
  margin: '0 var(--space-3) var(--space-2)',
  borderRadius: 'var(--radius-lg)', background: 'var(--surface)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden',
};
const main: CSSProperties = {
  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-3)', border: 'none', background: 'transparent',
  textAlign: 'left', cursor: 'pointer',
};
const cover: CSSProperties = {
  flexShrink: 0, width: 52, height: 52, borderRadius: 'var(--radius-md)',
  background: 'var(--fill)', display: 'grid', placeItems: 'center', overflow: 'hidden',
};
const coverImg: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const textCol: CSSProperties = { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 };
const dateText: CSSProperties = { fontSize: TYPE.headline.size, fontWeight: TYPE.headline.weight, color: 'var(--label)' };
const meta: CSSProperties = { fontSize: TYPE.subheadline.size, color: 'var(--label2)' };
const kebab: CSSProperties = {
  flexShrink: 0, width: 48, minHeight: 44, display: 'grid', placeItems: 'center',
  border: 'none', background: 'transparent', color: 'var(--label2)', cursor: 'pointer', // minHeight 44: 터치 타깃(L-1)
};
