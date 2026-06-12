// src/lib/regionDetail.ts — 지역 상세용 순수 헬퍼(날짜 표시 + 지역 사진 필터).
// 날짜는 코드베이스 규약대로 localComponents(JS Date 금지)만 사용. KST 고정.
import { localComponents } from '@/core/photoTime';
import type { PhotoRef } from '@/data/models';

const KST_OFFSET_SECONDS = 32400; // +09:00

/** epoch 초(또는 null) → "YYYY. M. D." (KST). null이면 빈 문자열. */
export function formatVisitDate(epochSeconds: number | null): string {
  if (epochSeconds === null) return '';
  const { year, month, day } = localComponents(epochSeconds, KST_OFFSET_SECONDS);
  return `${year}. ${month}. ${day}.`;
}

/** code에 속한 사진만 촬영순(takenAt 오름차순)으로. code=null이면 빈 배열. 입력 비변형. */
export function photosInRegion(photos: ReadonlyArray<PhotoRef>, code: string | null): PhotoRef[] {
  if (code === null) return [];
  return photos.filter((p) => p.regionCode === code).slice().sort((a, b) => a.takenAt - b.takenAt);
}
