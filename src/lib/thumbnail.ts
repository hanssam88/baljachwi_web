// src/lib/thumbnail.ts — 사진 → 256px 썸네일 Blob(jpeg q0.7). 원본은 저장 안 함(프라이버시).
// HEIC 등 디코드 실패 시 null(placeholder). 동시 디코드 4개 제한(메모리 보호).

const MAX_DIM = 256;
const QUALITY = 0.7;
const MAX_CONCURRENT = 4;

let active = 0;
const queue: (() => void)[] = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise((res) => queue.push(res));
}

function release() {
  active--;
  const next = queue.shift();
  if (next) {
    active++;
    next();
  }
}

/**
 * File → ≤256px jpeg Blob. 실패(HEIC 등 디코드 불가, OffscreenCanvas 부재) 시 null.
 * createImageBitmap/OffscreenCanvas는 브라우저 전용 — 테스트(jsdom/node)에서는 호출 안 함.
 */
export async function makeThumbnail(file: Blob): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    return null;
  }
  await acquire();
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const g = canvas.getContext('2d');
    if (!g) return null;
    g.drawImage(bitmap, 0, 0, w, h);
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
  } catch {
    return null;
  } finally {
    bitmap?.close();
    release();
  }
}
