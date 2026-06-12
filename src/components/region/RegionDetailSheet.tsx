'use client';
// src/components/region/RegionDetailSheet.tsx — 지역 클릭 시 하단 상세 시트(순수 props).
// 결정1: visited 지역은 가고싶음 영역 미노출. 결정6: 사진 있으면 "사진 보기".
import type { CSSProperties } from 'react';
import type { VisitState } from '@/core/visitState';
import { TYPE } from '@/lib/tokens';
import { formatVisitDate } from '@/lib/regionDetail';

const STATE_LABEL: Record<VisitState, string> = { visited: '방문', wantToGo: '가고싶음', notVisited: '미방문' };
const STATE_COLOR: Record<VisitState, string> = {
  visited: 'var(--st-visited)', wantToGo: 'var(--st-want)', notVisited: 'var(--st-unvisited)',
};

export function RegionDetailSheet({
  regionName,
  state,
  photoCount,
  firstVisit,
  lastVisit,
  onToggleWantToGo,
  onViewPhotos,
  onClose,
}: {
  regionName: string;
  state: VisitState;
  photoCount: number;
  firstVisit: number | null;
  lastVisit: number | null;
  onToggleWantToGo: () => void;
  onViewPhotos: () => void;
  onClose: () => void;
}) {
  const showWant = state !== 'visited'; // 결정1
  const hasPhotos = photoCount > 0;
  const range = visitRange(firstVisit, lastVisit);

  return (
    <div style={sheet} role="dialog" aria-label={`${regionName} 상세`}>
      <button type="button" style={closeBtn} aria-label="닫기" onClick={onClose}>×</button>
      <div style={nameRow}>
        <span style={name}>{regionName}</span>
        <span style={{ ...badge, background: STATE_COLOR[state] }}>{STATE_LABEL[state]}</span>
      </div>
      {hasPhotos && <p style={photoLine}>사진 {photoCount}장</p>}
      {range && <p style={dateLine}>{range}</p>}
      <div style={actions}>
        {showWant && (
          <button type="button" style={primaryBtn} onClick={onToggleWantToGo}>
            {state === 'wantToGo' ? '가고싶음 해제' : '가고싶음 저장'}
          </button>
        )}
        {hasPhotos && (
          <button type="button" style={showWant ? secondaryBtn : primaryBtn} onClick={onViewPhotos}>
            사진 보기
          </button>
        )}
      </div>
    </div>
  );
}

/** 첫·마지막 방문일 → 표시 문자열. 둘 다 있고 다르면 범위, 같거나 하나면 단일, 없으면 ''. */
function visitRange(first: number | null, last: number | null): string {
  const f = formatVisitDate(first);
  const l = formatVisitDate(last);
  if (f && l && f !== l) return `${f} ~ ${l}`;
  return f || l;
}

const sheet: CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 15,
  background: 'var(--surface)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
};
const closeBtn: CSSProperties = {
  position: 'absolute', top: 8, right: 8, width: 36, height: 36, border: 'none', background: 'transparent',
  color: 'var(--label2)', fontSize: 24, lineHeight: 1, cursor: 'pointer',
};
const nameRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingRight: 40 };
const name: CSSProperties = { fontSize: TYPE.largeTitle.size, fontWeight: TYPE.largeTitle.weight, color: 'var(--label)' };
const badge: CSSProperties = {
  flexShrink: 0, padding: '2px 10px', borderRadius: 999, color: '#fff',
  fontSize: TYPE.caption.size, fontWeight: 600,
};
const photoLine: CSSProperties = { margin: '12px 0 0', fontSize: TYPE.title3.size, color: 'var(--label)' };
const dateLine: CSSProperties = { margin: '4px 0 0', fontSize: TYPE.subheadline.size, color: 'var(--label2)' };
const actions: CSSProperties = { display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' };
const primaryBtn: CSSProperties = {
  flex: 1, padding: '12px 0', border: 'none', borderRadius: 'var(--radius-md)',
  background: 'var(--accent)', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
};
const secondaryBtn: CSSProperties = {
  flex: 1, padding: '12px 0', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)',
  background: 'var(--surface)', color: 'var(--label)', fontSize: 16, fontWeight: 600, cursor: 'pointer',
};
