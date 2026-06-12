'use client';

// src/components/ImportOnboarding.tsx — 사진 가져오기 CTA + 드롭존 + 진행률.
// iOS의 무음 자동 스캔을 웹의 명시적 가져오기로 대체. 업로드 없음(전부 기기 내).

import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { TYPE } from '@/lib/tokens';
import { pickImages, filesFromDrop } from '@/lib/filePick';
import { useScan } from '@/hooks/useScan';
import { Icon } from '@/components/common/Icon';

export function ImportOnboarding({
  mode = 'reconcile',
  onImported,
}: { mode?: 'reconcile' | 'apply'; onImported?: () => void } = {}) {
  const { state, importFiles } = useScan();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const busy = state.phase === 'reading-exif' || state.phase === 'scanning' || state.phase === 'saving';

  // 가져오기 완료 시 1회 콜백(재업로드 뷰 닫기용). ref 가드로 재발화 방지.
  const firedRef = useRef(false);
  useEffect(() => {
    if (state.phase === 'done' && onImported && !firedRef.current) {
      firedRef.current = true;
      onImported();
    }
  }, [state.phase, onImported]);

  // 데스크톱(정밀 포인터)만 폴더 선택(webkitdirectory). iOS 등 coarse 포인터는 plain input →
  // "사진 가져오기" 탭 시 사진 라이브러리(사진 앱)가 열린다. (iOS Safari는 webkitdirectory 미지원.)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const fine =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: fine)').matches;
    if (fine) el.setAttribute('webkitdirectory', '');
    else el.removeAttribute('webkitdirectory');
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = filesFromDrop(e.dataTransfer);
    if (files.length) void importFiles(files, mode);
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
        <div style={hero}>
          <Icon name="footprint" size={32} color="var(--accent)" label="발자취" />
        </div>
        <p style={title}>아직 가져온 사진이 없습니다</p>
        <p style={sub}>지오태그가 있는 사진을 가져오면 지역지도와 경로지도가 채워집니다</p>
        <p style={privacy}>
          <Icon name="lock" size={13} color="var(--label3)" />
          사진은 기기 밖으로 전송되지 않습니다
        </p>

        <button type="button" style={cta} disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? '처리 중…' : '사진 가져오기'}
        </button>
        <p style={hint}>또는 여기로 사진을 끌어다 놓으세요</p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = pickImages(e.target.files);
            if (files.length) void importFiles(files, mode);
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

const hero: CSSProperties = {
  width: 64,
  height: 64,
  margin: '0 auto var(--space-4)',
  display: 'grid',
  placeItems: 'center',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--fill)',
};

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
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
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
  color: 'var(--danger)',
  textAlign: 'center',
};
