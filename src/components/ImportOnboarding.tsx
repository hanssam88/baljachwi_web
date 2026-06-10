'use client';

// src/components/ImportOnboarding.tsx — 사진 가져오기 CTA + 드롭존 + 진행률.
// iOS의 무음 자동 스캔을 웹의 명시적 가져오기로 대체. 업로드 없음(전부 기기 내).

import { useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { TYPE } from '@/lib/tokens';
import { pickImages, filesFromDrop } from '@/lib/filePick';
import { useScan } from '@/hooks/useScan';

export function ImportOnboarding() {
  const { state, importFiles } = useScan();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const busy = state.phase === 'reading-exif' || state.phase === 'scanning' || state.phase === 'saving';

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = filesFromDrop(e.dataTransfer);
    if (files.length) void importFiles(files);
  };

  return (
    <div style={wrap}>
      <div
        style={{ ...dropzone, ...(dragOver ? dropzoneActive : null) }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <p style={title}>아직 가져온 사진이 없습니다</p>
        <p style={sub}>지오태그가 있는 사진을 가져오면 지역지도와 경로지도가 채워집니다</p>
        <p style={privacy}>사진은 기기 밖으로 전송되지 않습니다</p>

        <button type="button" style={cta} disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? '처리 중…' : '사진 가져오기'}
        </button>
        <p style={hint}>또는 여기로 사진을 끌어다 놓으세요</p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          // @ts-expect-error 비표준 — 폴더 선택(모바일 폴백은 multiple)
          webkitdirectory=""
          hidden
          onChange={(e) => {
            const files = pickImages(e.target.files);
            if (files.length) void importFiles(files);
            e.target.value = '';
          }}
        />
      </div>

      {busy && (
        <div style={progressWrap} role="status" aria-live="polite">
          <div style={progressTrack}>
            <div style={{ ...progressBar, width: `${Math.round(state.progress * 100)}%` }} />
          </div>
          <p style={progressLabel}>{state.label}</p>
        </div>
      )}
      {state.phase === 'error' && (
        <p style={errorText} role="alert">
          가져오기 실패: {state.error}
        </p>
      )}
    </div>
  );
}

const wrap: CSSProperties = { width: '100%', maxWidth: 420, margin: '0 auto' };

const dropzone: CSSProperties = {
  border: '2px dashed var(--separator)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-6)',
  textAlign: 'center',
  background: 'var(--surface)',
  transition: 'border-color .15s, background .15s',
};
const dropzoneActive: CSSProperties = {
  borderColor: 'var(--accent)',
  background: 'var(--surface2)',
};

const title: CSSProperties = {
  margin: 0,
  fontSize: TYPE.headline.size,
  fontWeight: TYPE.headline.weight,
  color: 'var(--label)',
};
const sub: CSSProperties = {
  marginTop: 'var(--space-2)',
  fontSize: TYPE.subheadline.size,
  color: 'var(--label2)',
};
const privacy: CSSProperties = {
  marginTop: 'var(--space-1)',
  fontSize: TYPE.caption.size,
  color: 'var(--label3)',
};
const cta: CSSProperties = {
  marginTop: 'var(--space-5)',
  padding: '10px 20px',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: TYPE.headline.size,
  fontWeight: 600,
  cursor: 'pointer',
};
const hint: CSSProperties = {
  marginTop: 'var(--space-3)',
  marginBottom: 0,
  fontSize: TYPE.caption.size,
  color: 'var(--label3)',
};

const progressWrap: CSSProperties = { marginTop: 'var(--space-5)' };
const progressTrack: CSSProperties = {
  height: 6,
  borderRadius: 3,
  background: 'var(--fill)',
  overflow: 'hidden',
};
const progressBar: CSSProperties = {
  height: '100%',
  background: 'var(--accent)',
  transition: 'width .2s',
};
const progressLabel: CSSProperties = {
  marginTop: 'var(--space-2)',
  fontSize: TYPE.caption.size,
  color: 'var(--label2)',
  textAlign: 'center',
};
const errorText: CSSProperties = {
  marginTop: 'var(--space-4)',
  fontSize: TYPE.subheadline.size,
  color: '#C2453A',
  textAlign: 'center',
};
