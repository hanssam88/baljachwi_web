// src/components/trip/tripLabel.ts — 여행 표시명 규칙(iOS TripRow.displayName 1:1).
// title 있으면 title, 없으면 사진의 regionCode를 첫 등장 순서로 모아 최대 2개 + "외 N곳".

import type { PhotoRef } from '@/data/models';

/**
 * @param title  trip.title (null/빈 문자열이면 지역 요약 폴백)
 * @param photos 그 여행 사진(sortIndex 오름차순 가정 — 호출부가 정렬)
 * @param names  regionCode → 표시명(RegionNames.names)
 */
export function tripDisplayName(
  title: string | null,
  photos: Pick<PhotoRef, 'regionCode'>[],
  names: Record<string, string>,
): string {
  if (title && title.length > 0) return title;

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const p of photos) {
    const code = p.regionCode;
    if (code === null) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    ordered.push(names[code] ?? code);
  }
  if (ordered.length === 0) return '위치 미상';
  const shown = ordered.slice(0, 2).join(' · ');
  const extra = ordered.length - Math.min(ordered.length, 2);
  return extra > 0 ? `${shown} 외 ${extra}곳` : shown;
}
