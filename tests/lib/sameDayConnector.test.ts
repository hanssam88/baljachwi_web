import { describe, it, expect } from 'vitest';
import { sameDayPhotos, dayConnectorCoords } from '@/lib/sameDayConnector';
import type { PhotoRef } from '@/data/models';

// KST(+32400). 2024-01-01 12:00 KST ≈ 1704078000. 하루=86400.
const KST = 32400;
function p(id: string, takenAt: number, lon = 126.5, lat = 33.5): PhotoRef {
  return { localIdentifier: id, lat, lon, takenAt, localTZoffsetSeconds: KST,
    regionCode: null, tripID: null, sortIndex: 0, userOverride: false };
}

describe('sameDayPhotos', () => {
  const day1a = p('1a', 1704078000, 126.1, 33.1);          // day1 12:00
  const day1b = p('1b', 1704078000 + 3600, 126.2, 33.2);   // day1 13:00
  const day2 = p('2', 1704078000 + 86400, 126.3, 33.3);    // day2 12:00
  const all = [day1b, day2, day1a]; // 입력은 비정렬

  it('anchor와 같은 현지 날짜 사진만, takenAt 오름차순(anchor 포함)', () => {
    expect(sameDayPhotos(all, day1b).map((x) => x.localIdentifier)).toEqual(['1a', '1b']);
  });
  it('같은 날 1장뿐이면 자기 자신만', () => {
    expect(sameDayPhotos(all, day2).map((x) => x.localIdentifier)).toEqual(['2']);
  });
});

describe('dayConnectorCoords', () => {
  const day1a = p('1a', 1704078000, 126.1, 33.1);
  const day1b = p('1b', 1704078000 + 3600, 126.2, 33.2);
  const day2 = p('2', 1704078000 + 86400, 126.3, 33.3);

  it('같은 날 2장 이상 → [lon,lat] 좌표열(시간순)', () => {
    expect(dayConnectorCoords([day1b, day2, day1a], day1a)).toEqual([
      [126.1, 33.1], [126.2, 33.2],
    ]);
  });
  it('같은 날 1장뿐 → 빈 배열(선 없음)', () => {
    expect(dayConnectorCoords([day1a, day2], day2)).toEqual([]);
  });
});
