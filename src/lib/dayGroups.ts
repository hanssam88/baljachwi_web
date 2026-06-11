// src/lib/dayGroups.ts — 사진을 "현지 날짜(localDay)"별 일자 카드로 묶는 순수 헬퍼.
// core localDay(byte-faithful)를 localDayOf 어댑터로 재사용 — 같은 정수 = 같은 현지 날짜.
import { localDayOf } from '@/lib/sameDayConnector';
import type { PhotoRef } from '@/data/models';

const SECONDS_PER_DAY = 86400;
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 같은 현지 날짜 사진 묶음. localDay=정렬·키, photos=takenAt 오름차순. */
export interface DayGroup {
  localDay: number;
  photos: PhotoRef[];
}

/** 사진을 현지 날짜별로 묶음. 그룹=최신 날짜 우선(내림차순), 그룹 내=takenAt 오름차순.
 *  입력 배열은 변형하지 않음(그룹별 새 배열만 정렬). */
export function groupPhotosByDay(photos: ReadonlyArray<PhotoRef>): DayGroup[] {
  const byDay = new Map<number, PhotoRef[]>();
  for (const p of photos) {
    const day = localDayOf(p);
    const arr = byDay.get(day);
    if (arr) arr.push(p);
    else byDay.set(day, [p]);
  }
  const groups: DayGroup[] = [];
  for (const [localDay, arr] of byDay) {
    groups.push({ localDay, photos: arr.sort((a, b) => a.takenAt - b.takenAt) });
  }
  groups.sort((a, b) => b.localDay - a.localDay);
  return groups;
}

/** localDay 정수 → "2024. 5. 3. (금)". localDay*86400 = 현지 자정의 shifted epoch →
 *  UTC getter로 환산해 브라우저 TZ에 의존하지 않는 안정 라벨. */
export function dayLabel(localDay: number): string {
  const d = new Date(localDay * SECONDS_PER_DAY * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const wd = WEEKDAYS_KO[d.getUTCDay()];
  return `${y}. ${m}. ${day}. (${wd})`;
}
