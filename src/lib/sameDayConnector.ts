// src/lib/sameDayConnector.ts — 핀 클릭 시 "같은 현지 날짜" 사진을 시간순으로 잇기 위한 순수 헬퍼.
// core localDay(byte-faithful) 재사용 — 같은 localDay 정수 = 같은 현지 날짜.
import { localDay, type PhotoSample } from '@/core/tripSegmenter';
import type { PhotoRef } from '@/data/models';

// PhotoRef → core PhotoSample 어댑터. localDay는 takenAt/localTZoffsetSeconds만 읽지만,
// 타입 계약(id·coordinate)을 충족시켜 코어 수정 없이 동일 함수를 재사용한다.
function toSample(p: PhotoRef): PhotoSample {
  return {
    id: p.localIdentifier,
    coordinate: { lat: p.lat, lon: p.lon },
    takenAt: p.takenAt,
    localTZoffsetSeconds: p.localTZoffsetSeconds,
  };
}

/** PhotoRef의 현지 날짜 정수(core localDay 재사용). 같은 값 = 같은 현지 날짜. */
export function localDayOf(p: PhotoRef): number {
  return localDay(toSample(p));
}

/** anchor와 같은 현지 날짜(localDay)의 사진들, takenAt 오름차순(anchor 포함). */
export function sameDayPhotos(photos: ReadonlyArray<PhotoRef>, anchor: PhotoRef): PhotoRef[] {
  const day = localDayOf(anchor);
  return photos.filter((p) => localDayOf(p) === day).sort((a, b) => a.takenAt - b.takenAt);
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
