// tests/lib/dayGroups.test.ts
import { describe, it, expect } from 'vitest';
import { groupPhotosByDay, dayLabel } from '@/lib/dayGroups';
import type { PhotoRef } from '@/data/models';

const KST = 32400;
// 2024-01-01 12:00 KST ≈ 1704078000. 하루=86400.
function p(id: string, takenAt: number, region: string | null = null): PhotoRef {
  return { localIdentifier: id, lat: 33.5, lon: 126.5, takenAt, localTZoffsetSeconds: KST,
    regionCode: region, tripID: null, sortIndex: 0, userOverride: false };
}

describe('groupPhotosByDay', () => {
  const d1a = p('1a', 1704078000);          // day1 12:00
  const d1b = p('1b', 1704078000 + 3600);   // day1 13:00
  const d2 = p('2', 1704078000 + 86400);    // day2 12:00
  const d3 = p('3', 1704078000 + 2 * 86400);// day3 12:00

  it('현지 날짜별로 묶고 최신 날짜 우선(그룹 내 takenAt 오름차순)', () => {
    const groups = groupPhotosByDay([d1b, d3, d2, d1a]); // 비정렬 입력
    expect(groups.map((g) => g.photos.map((x) => x.localIdentifier))).toEqual([
      ['3'], ['2'], ['1a', '1b'],
    ]);
    expect(groups[0].localDay).toBeGreaterThan(groups[2].localDay); // 내림차순
  });
  it('빈 입력 → 빈 배열', () => {
    expect(groupPhotosByDay([])).toEqual([]);
  });
  it('입력 배열 순서를 변형하지 않음', () => {
    const input = [d1b, d1a];
    groupPhotosByDay(input);
    expect(input.map((x) => x.localIdentifier)).toEqual(['1b', '1a']);
  });
});

describe('dayLabel', () => {
  it('localDay 정수 → "YYYY. M. D. (요일)" (UTC 환산, 브라우저 TZ 무관)', () => {
    expect(dayLabel(0)).toBe('1970. 1. 1. (목)'); // 1970-01-01 = 목
    expect(dayLabel(1)).toBe('1970. 1. 2. (금)'); // 1970-01-02 = 금
  });
});
