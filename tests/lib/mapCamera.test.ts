import { describe, it, expect } from 'vitest';
import { paddedBounds, connectedBounds } from '@/lib/mapCamera';
import { makePhotoRef } from '@/data/models';

const MIN = 0.01;
const KST = 32400;
// localDay = floor((takenAt + tz)/86400). 같은 날이 되도록 takenAt을 하루(86400) 안에서 배치.
function ph(id: string, lat: number, lon: number, takenAt: number) {
  return makePhotoRef({ localIdentifier: id, lat, lon, takenAt, localTZoffsetSeconds: KST, regionCode: null });
}

describe('paddedBounds', () => {
  it('정상 bbox → 위경도 각각 span*0.2 패딩, SW→NE 순서', () => {
    // lat span 10 → pad 2, lon span 20 → pad 4
    const b = paddedBounds({ minLat: 30, maxLat: 40, minLon: 120, maxLon: 140 }, MIN);
    expect(b).toEqual([[116, 28], [144, 42]]);
  });
  it('정사각이 아닌 bbox → 위/경도 패딩 독립 계산', () => {
    const b = paddedBounds({ minLat: 33, maxLat: 34, minLon: 126, maxLon: 130 }, MIN);
    // lat span 1 → 0.2, lon span 4 → 0.8
    expect(b).toEqual([[125.2, 32.8], [130.8, 34.2]]);
  });
  it('degenerate bbox(min==max) → minSpan/2로 클램프', () => {
    const b = paddedBounds({ minLat: 33.5, maxLat: 33.5, minLon: 126.5, maxLon: 126.5 }, MIN);
    // pad = MIN/2 = 0.005
    expect(b).toEqual([[126.495, 33.495], [126.505, 33.505]]);
  });
  it('span이 작아 비율 패딩 < minSpan/2 → minSpan/2 채택', () => {
    const b = paddedBounds({ minLat: 33.5, maxLat: 33.51, minLon: 126.5, maxLon: 126.51 }, MIN);
    // span 0.01 * 0.2 = 0.002 < 0.005 → 0.005
    expect(b).toEqual([[126.495, 33.495], [126.515, 33.515]]);
  });
  it('ratio 인자 생략 시 기본 0.2 적용', () => {
    const def = paddedBounds({ minLat: 30, maxLat: 40, minLon: 120, maxLon: 140 }, MIN);
    const exp = paddedBounds({ minLat: 30, maxLat: 40, minLon: 120, maxLon: 140 }, MIN, 0.2);
    expect(def).toEqual(exp);
  });
});

describe('connectedBounds', () => {
  // 같은 날(day0): a,b / 다른 날(day+1): c (takenAt += 86400)
  const a = ph('a', 33.0, 126.0, 100);
  const b = ph('b', 34.0, 127.0, 200);
  const c = ph('c', 38.0, 128.0, 100 + 86400);
  const photos = [a, b, c];
  it('같은 현지 날짜 사진만 bbox에 포함(다른 날 c 제외)', () => {
    const out = connectedBounds(photos, a, MIN);
    // a,b만: lat 33~34(pad 0.2), lon 126~127(pad 0.2) → c(38,128) 미포함
    expect(out).toEqual([[125.8, 32.8], [127.2, 34.2]]);
  });
  it('anchor 자신은 항상 포함(다른 날 anchor c → c 단독 박스)', () => {
    const out = connectedBounds(photos, c, MIN);
    expect(out).toEqual([[127.995, 37.995], [128.005, 38.005]]); // 단독 → minSpan 클램프
  });
  it('빈 photos → null', () => {
    expect(connectedBounds([], a, MIN)).toBeNull();
  });
});
