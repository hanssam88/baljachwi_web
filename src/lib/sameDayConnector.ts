// src/lib/sameDayConnector.ts — 핀 클릭 시 "같은 현지 날짜" 사진을 시간순으로 잇기 위한 순수 헬퍼.
// core localDay(byte-faithful) 재사용 — 같은 localDay 정수 = 같은 현지 날짜.
import { localDay } from '@/core/tripSegmenter';
import type { PhotoRef } from '@/data/models';

/** anchor와 같은 현지 날짜(localDay)의 사진들, takenAt 오름차순(anchor 포함). */
export function sameDayPhotos(photos: ReadonlyArray<PhotoRef>, anchor: PhotoRef): PhotoRef[] {
  const day = localDay(anchor);
  return photos.filter((p) => localDay(p) === day).sort((a, b) => a.takenAt - b.takenAt);
}

/** 같은 날 사진들 → [lon,lat] 좌표열. 2점 미만이면 빈 배열(선 없음). 직선 연결용. */
export function dayConnectorCoords(
  photos: ReadonlyArray<PhotoRef>,
  anchor: PhotoRef,
): [number, number][] {
  const same = sameDayPhotos(photos, anchor);
  if (same.length < 2) return [];
  return same.map((p) => [p.lon, p.lat] as [number, number]);
}
