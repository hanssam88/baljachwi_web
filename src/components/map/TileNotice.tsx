'use client';
// src/components/map/TileNotice.tsx — 외부 타일 동의 고지 모달(경로/지역지도 공용).

import type { CSSProperties } from 'react';

export function TileNotice({ onAccept }: { onAccept: () => void }) {
  return (
    <div style={overlay} role="dialog" aria-label="외부 타일 고지">
      <div style={card}>
        <p style={text}>
          지도 타일을 외부 서버(OpenFreeMap)에서 불러오므로, 보고 있는 지역의 대략적
          위치가 타일 서버에 전달될 수 있습니다. 사진 파일·정확한 GPS 좌표·식별자는
          전송되지 않습니다.
        </p>
        <button type="button" style={btn} onClick={onAccept}>
          확인
        </button>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.35)',
  padding: 'var(--space-5)',
};
const card: CSSProperties = {
  maxWidth: 320,
  background: 'var(--surface)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
  textAlign: 'center',
};
const text: CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--label)' };
const btn: CSSProperties = {
  marginTop: 'var(--space-4)',
  padding: '8px 24px',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};
