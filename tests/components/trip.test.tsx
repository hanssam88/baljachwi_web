import { describe, it, expect } from 'vitest';
import { tripDisplayName } from '@/components/trip/tripLabel';
import type { PhotoRef } from '@/data/models';

function photo(id: string, regionCode: string | null, sortIndex: number): PhotoRef {
  return {
    localIdentifier: id,
    lat: 0,
    lon: 0,
    takenAt: 0,
    localTZoffsetSeconds: 0,
    regionCode,
    tripID: 'T1',
    sortIndex,
    userOverride: false,
  };
}

describe('tripDisplayName', () => {
  const names: Record<string, string> = {
    '11140': '서울 중구',
    '26170': '부산 동구',
    '50110': '제주 제주시',
  };

  it('title 있으면 title 우선', () => {
    const photos = [photo('a', '11140', 0)];
    expect(tripDisplayName('내 여행', photos, names)).toBe('내 여행');
  });

  it('지역 2곳: " · " 결합', () => {
    const photos = [photo('a', '11140', 0), photo('b', '26170', 1)];
    expect(tripDisplayName(null, photos, names)).toBe('서울 중구 · 부산 동구');
  });

  it('지역 3곳 이상: 앞 2개 + "외 N곳" (첫 등장 순서)', () => {
    const photos = [
      photo('a', '11140', 0),
      photo('b', '26170', 1),
      photo('c', '50110', 2),
      photo('d', '11140', 3), // 중복은 무시
    ];
    expect(tripDisplayName(null, photos, names)).toBe('서울 중구 · 부산 동구 외 1곳');
  });

  it('regionCode 전부 null → "위치 미상"', () => {
    const photos = [photo('a', null, 0), photo('b', null, 1)];
    expect(tripDisplayName(null, photos, names)).toBe('위치 미상');
  });

  it('names에 없는 코드는 코드 그대로 표시', () => {
    const photos = [photo('a', '99999', 0)];
    expect(tripDisplayName(null, photos, names)).toBe('99999');
  });
});
