'use client';
// src/components/trip/PhotoSelectScreen.tsx — 사진 다중선택 그리드 + 일괄 삭제(확인 다이얼로그).
import { useMemo, useState, type CSSProperties } from 'react';
import type { PhotoRef } from '@/data/models';
import { repo } from '@/data/repo';
import { useThumbUrls } from '@/hooks/useThumbUrls';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

export function PhotoSelectScreen({
  title,
  photos,
  onDeleted,
  onBack,
}: {
  title: string;
  photos: PhotoRef[];
  onDeleted: () => void;
  onBack: () => void;
}) {
  const ids = useMemo(() => photos.map((p) => p.localIdentifier), [photos]);
  const urls = useThumbUrls(ids);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doDelete = async () => {
    if (busy || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      await repo().deletePhotos([...selected]);
      onDeleted();
    } catch {
      // 비가역 작업 실패 → 무음 무시 금지. 선택 유지(재시도 가능) + 에러 노출(M-2).
      setError('삭제에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div style={screen}>
      <div style={bar}>
        <button type="button" style={backBtn} onClick={onBack}>← 목록</button>
        <span style={barTitle}>{title}</span>
      </div>
      <div style={grid}>
        {photos.map((p) => {
          const on = selected.has(p.localIdentifier);
          const url = urls[p.localIdentifier];
          return (
            <button
              key={p.localIdentifier}
              type="button"
              aria-label={`사진 선택 ${p.localIdentifier}`}
              aria-pressed={on}
              onClick={() => toggle(p.localIdentifier)}
              style={{ ...cell, ...(url ? { backgroundImage: `url(${url})` } : {}), ...(on ? cellOn : null) }}
            >
              {on && <span style={check}>✓</span>}
            </button>
          );
        })}
      </div>
      <div style={footer}>
        {error && <div style={errorText} role="alert">{error}</div>}
        <button
          type="button"
          style={selected.size > 0 ? delBtn : delBtnOff}
          disabled={selected.size === 0 || busy}
          onClick={() => setConfirming(true)}
        >
          삭제 ({selected.size})
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          message={`선택한 사진 ${selected.size}장을 삭제할까요? 되돌릴 수 없습니다.`}
          onConfirm={doDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

const screen: CSSProperties = { position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 };
const bar: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
  borderBottom: '1px solid var(--separator)', background: 'var(--surface)',
};
const backBtn: CSSProperties = { border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 15, cursor: 'pointer' };
const barTitle: CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--label)' };
const grid: CSSProperties = {
  flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: 2,
};
const cell: CSSProperties = {
  position: 'relative', aspectRatio: '1 / 1', border: 'none', borderRadius: 'var(--radius-sm)',
  background: 'var(--fill)', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer',
};
const cellOn: CSSProperties = { outline: '3px solid var(--accent)', outlineOffset: '-3px' };
const check: CSSProperties = {
  position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
  background: 'var(--accent)', color: '#fff', fontSize: 13, lineHeight: '22px', textAlign: 'center',
};
const footer: CSSProperties = { padding: 'var(--space-3)', borderTop: '1px solid var(--separator)', background: 'var(--surface)' };
const errorText: CSSProperties = { margin: '0 0 var(--space-2)', fontSize: 13, color: '#C2453A', textAlign: 'center' };
const delBtn: CSSProperties = {
  width: '100%', padding: '12px 0', border: 'none', borderRadius: 'var(--radius-md)',
  background: '#C2453A', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
};
const delBtnOff: CSSProperties = { ...delBtn, background: 'var(--fill)', color: 'var(--label3)', cursor: 'default' };
