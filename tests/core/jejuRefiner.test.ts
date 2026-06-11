// tests/core/jejuRefiner.test.ts
import { describe, it, expect } from 'vitest';
import { refineJeju, type JejuDong } from '@/core/jejuRefiner';
import type { MultiPolygon } from '@/core/geoTypes';

const sq = (minLon: number, minLat: number, s: number): MultiPolygon => ({
  polygons: [{
    outer: [
      { lon: minLon, lat: minLat }, { lon: minLon + s, lat: minLat },
      { lon: minLon + s, lat: minLat + s }, { lon: minLon, lat: minLat + s },
    ], holes: []
  }],
});
const dongs: JejuDong[] = [
  { code: '5011000002', mp: sq(126.0, 33.0, 0.1) },
  { code: '5011000001', mp: sq(126.2, 33.0, 0.1) },
];

describe('refineJeju', () => {
  it('포함하는 동 코드 반환', () => {
    expect(refineJeju({ lat: 33.05, lon: 126.05 }, dongs)).toBe('5011000002');
    expect(refineJeju({ lat: 33.05, lon: 126.25 }, dongs)).toBe('5011000001');
  });
  it('어떤 동에도 안 들면 경계 최단거리 동(임계값 없음)', () => {
    // 두 동: A(126.0~126.1)=5011000002, B(126.2~126.3)=5011000001. 점 126.16은 둘 사이.
    // A 우측변 126.1까지 0.06°, B 좌측변 126.2까지 0.04° → B(5011000001)가 더 가까움.
    const r = refineJeju({ lat: 33.05, lon: 126.16 }, dongs);
    expect(r).toBe('5011000001');
  });
  it('빈 목록 → null', () => expect(refineJeju({ lat: 33, lon: 126 }, [])).toBeNull());
});
