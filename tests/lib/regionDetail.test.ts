// tests/lib/regionDetail.test.ts
import { describe, it, expect } from 'vitest';
import { formatVisitDate, photosInRegion } from '@/lib/regionDetail';
import { makePhotoRef } from '@/data/models';

const KST = 32400;
function ph(id: string, region: string | null, takenAt: number) {
  return makePhotoRef({ localIdentifier: id, lat: 33.5, lon: 126.5, takenAt, localTZoffsetSeconds: KST, regionCode: region });
}

describe('formatVisitDate', () => {
  it('KST 자정 epoch → "YYYY. M. D." (1704034800 = 2024-01-01 KST)', () => {
    expect(formatVisitDate(1704034800)).toBe('2024. 1. 1.');
  });
  it('UTC 경계 넘는 시각도 KST 기준 날짜 (1710027000 = 2024-03-10 08:30 KST)', () => {
    expect(formatVisitDate(1710027000)).toBe('2024. 3. 10.');
  });
  it('null → 빈 문자열', () => {
    expect(formatVisitDate(null)).toBe('');
  });
});

describe('photosInRegion', () => {
  const photos = [ph('a', 'R1', 300), ph('b', 'R2', 200), ph('c', 'R1', 100), ph('d', null, 400)];
  it('regionCode 일치 사진만, takenAt 오름차순', () => {
    expect(photosInRegion(photos, 'R1').map((p) => p.localIdentifier)).toEqual(['c', 'a']);
  });
  it('다른 지역/ null regionCode 제외', () => {
    expect(photosInRegion(photos, 'R2').map((p) => p.localIdentifier)).toEqual(['b']);
  });
  it('code=null → 빈 배열', () => {
    expect(photosInRegion(photos, null)).toEqual([]);
  });
  it('입력 배열 비변형(불변)', () => {
    const before = photos.map((p) => p.localIdentifier);
    photosInRegion(photos, 'R1');
    expect(photos.map((p) => p.localIdentifier)).toEqual(before);
  });
});
