'use client';
// src/components/common/ConfirmDialog.tsx — 파괴적 작업 확인 모달. TileNotice 레이아웃 클론 + 취소/삭제 2버튼.
import type { CSSProperties } from 'react';

export function ConfirmDialog({
  message,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label="삭제 확인">
      <div style={card}>
        <p style={text}>{message}</p>
        <div style={btnRow}>
          <button type="button" style={cancelBtn} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" style={confirmBtn} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.35)', padding: 'var(--space-5)', zIndex: 20,
};
const card: CSSProperties = {
  maxWidth: 320, width: '100%', background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)', textAlign: 'center',
};
const text: CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--label)' };
const btnRow: CSSProperties = { display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' };
const cancelBtn: CSSProperties = {
  flex: 1, padding: '8px 0', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)',
  background: 'var(--surface)', color: 'var(--label)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
};
const confirmBtn: CSSProperties = {
  flex: 1, padding: '8px 0', border: 'none', borderRadius: 'var(--radius-md)',
  background: '#C2453A', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
};
