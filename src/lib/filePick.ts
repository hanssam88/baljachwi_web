// src/lib/filePick.ts — 파일 선택/드롭에서 이미지 File[] 추출(순수 헬퍼).

const IMAGE_RE = /\.(jpe?g|png|heic|heif|webp|tiff?)$/i;

/** 이미지로 보이는 File만 통과(type 또는 확장자). */
export function isImageFile(f: File): boolean {
  return f.type.startsWith('image/') || IMAGE_RE.test(f.name);
}

/** FileList/배열 → 이미지 File[]. */
export function pickImages(files: FileList | File[] | null): File[] {
  if (!files) return [];
  return Array.from(files).filter(isImageFile);
}

/**
 * DataTransfer(드래그앤드롭) → 이미지 File[]. 폴더 항목은 평탄화하지 않고
 * 평면 파일만 취한다(프로토 단순화 — 폴더는 input[webkitdirectory]로).
 */
export function filesFromDrop(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  return pickImages(dt.files);
}
