'use client';
// src/components/region/RegionDetailSheet.tsx — 지역 클릭 시 하단 상세 시트(순수 props).
// 결정1: visited 지역은 가고싶음 영역 미노출. 결정6: 사진 있으면 "사진 보기".
// Direction A 정제: grabber + scrim + 아이콘. 데이터 정직성 — 방문횟수·세부지역 등 모델에 없는 통계는 표시하지 않는다.
import type { CSSProperties } from 'react';
import type { VisitState } from '@/core/visitState';
import { TYPE } from '@/lib/tokens';
import { formatVisitDate } from '@/lib/regionDetail';
import { Icon } from '@/components/common/Icon';

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
    <>
      {/* scrim 은 시트의 형제(부모 아님) — 시트 내부 클릭이 onClose 로 버블되지 않도록 분리 */}
      <div style={scrim} aria-hidden="true" data-testid="sheet-scrim" onClick={onClose} />
      <div style={sheet} role="dialog" aria-label={`${regionName} 상세`}>
        <div style={grabber} aria-hidden="true" />
        <button type="button" style={closeBtn} aria-label="닫기" onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
        <div style={nameRow}>
          <span style={name}>{regionName}</span>
          <span style={{ ...badge, background: STATE_COLOR[state] }}>{STATE_LABEL[state]}</span>
        </div>
        {hasPhotos && <p style={photoLine}>사진 {photoCount}장</p>}
        {range && (
          <p style={dateLine}>
            <Icon name="calendar" size={15} color="var(--label2)" /> {range}
          </p>
        )}
        <div style={actions}>
          {showWant && (
            <button type="button" style={primaryBtn} onClick={onToggleWantToGo}>
              <Icon name="bookmark" size={18} />
              {state === 'wantToGo' ? '가고싶음 해제' : '가고싶음 저장'}
            </button>
          )}
          {hasPhotos && (
            <button type="button" style={showWant ? secondaryBtn : primaryBtn} onClick={onViewPhotos}>
              <Icon name="camera" size={18} />
              사진 보기
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/** 첫·마지막 방문일 → 표시 문자열. 둘 다 있고 다르면 범위, 같거나 하나면 단일, 없으면 ''. */
function visitRange(first: number | null, last: number | null): string {
  const f = formatVisitDate(first);
  const l = formatVisitDate(last);
  if (f && l && f !== l) return `${f} ~ ${l}`;
  return f || l;
}

const scrim: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 14, background: 'rgba(0,0,0,0.18)', border: 'none', cursor: 'pointer',
};
const sheet: CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 15,
  background: 'var(--surface)', borderTopLeftRadius: 'var(--radius-xl)', borderTopRightRadius: 'var(--radius-xl)',
  padding: 'var(--space-5)', paddingTop: 'var(--space-3)', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
};
const grabber: CSSProperties = {
  width: 36, height: 5, borderRadius: 999, background: 'var(--separator)', margin: '0 auto var(--space-3)',
};
const closeBtn: CSSProperties = {
  position: 'absolute', top: 10, right: 10, width: 36, height: 36, display: 'grid', placeItems: 'center',
  border: 'none', background: 'transparent', color: 'var(--label2)', cursor: 'pointer',
};
const nameRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingRight: 40 };
const name: CSSProperties = { fontSize: TYPE.largeTitle.size, fontWeight: TYPE.largeTitle.weight, color: 'var(--label)' };
const badge: CSSProperties = {
  flexShrink: 0, padding: '2px 10px', borderRadius: 999, color: '#fff',
  fontSize: TYPE.caption.size, fontWeight: 600,
};
const photoLine: CSSProperties = { margin: '12px 0 0', fontSize: TYPE.title3.size, color: 'var(--label)' };
const dateLine: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
  margin: '4px 0 0', fontSize: TYPE.subheadline.size, color: 'var(--label2)',
};
const actions: CSSProperties = { display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' };
const primaryBtn: CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
  padding: '12px 0', border: 'none', borderRadius: 'var(--radius-md)',
  background: 'var(--accent)', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
};
const secondaryBtn: CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
  padding: '12px 0', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)',
  background: 'var(--surface)', color: 'var(--label)', fontSize: 16, fontWeight: 600, cursor: 'pointer',
};
