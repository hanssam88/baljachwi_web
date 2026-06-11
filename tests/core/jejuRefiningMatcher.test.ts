// tests/core/jejuRefiningMatcher.test.ts
import { describe, it, expect } from 'vitest';
import { GeoDataStore, type RegionCodeEntry } from '@/core/geoDataStore';
import { JejuRefiningMatcher } from '@/core/jejuRefiningMatcher';
import type { JejuDong } from '@/core/jejuRefiner';

// 50110 = 큰 사각형(제주시 대용), 11110 = 서울 종로 대용.
const geojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature', properties: { sgg: '50110' }, geometry: {
        type: 'Polygon',
        coordinates: [[[126.0, 33.0], [126.5, 33.0], [126.5, 33.5], [126.0, 33.5], [126.0, 33.0]]]
      }
    },
    {
      type: 'Feature', properties: { sgg: '11110' }, geometry: {
        type: 'Polygon',
        coordinates: [[[126.97, 37.57], [126.99, 37.57], [126.99, 37.59], [126.97, 37.59], [126.97, 37.57]]]
      }
    },
  ],
};
const entries: RegionCodeEntry[] = [
  { regionCode: '50110', level: 'sigungu', nameKo: '제주시', sidoCode: '50', bbox: [126.0, 33.0, 126.5, 33.5] },
  { regionCode: '11110', level: 'sigungu', nameKo: '종로구', sidoCode: '11', bbox: [126.97, 37.57, 126.99, 37.59] },
];
const dongs: JejuDong[] = [
  {
    code: '5011000001', mp: {
      polygons: [{
        outer: [
          { lon: 126.0, lat: 33.0 }, { lon: 126.25, lat: 33.0 },
          { lon: 126.25, lat: 33.5 }, { lon: 126.0, lat: 33.5 }], holes: []
      }]
    }
  },
  {
    code: '5011000002', mp: {
      polygons: [{
        outer: [
          { lon: 126.25, lat: 33.0 }, { lon: 126.5, lat: 33.0 },
          { lon: 126.5, lat: 33.5 }, { lon: 126.25, lat: 33.5 }], holes: []
      }]
    }
  },
];

describe('JejuRefiningMatcher', () => {
  const m = new JejuRefiningMatcher(new GeoDataStore(entries, geojson), dongs);
  it('제주 좌표 → 동 코드로 정제', () => {
    expect(m.regionCode({ lat: 33.25, lon: 126.1 })).toBe('5011000001');
    expect(m.regionCode({ lat: 33.25, lon: 126.4 })).toBe('5011000002');
  });
  it('비제주 좌표 → base 코드 그대로(정제 안 함)', () => {
    expect(m.regionCode({ lat: 37.58, lon: 126.98 })).toBe('11110');
  });
  it('해외/바다 → null', () => {
    expect(m.regionCode({ lat: 0, lon: 0 })).toBeNull();
  });
  it('dongs 비었으면(fetch 실패 시뮬) 제주 좌표는 base 50110 유지(graceful degrade)', () => {
    const m0 = new JejuRefiningMatcher(new GeoDataStore(entries, geojson), []);
    expect(m0.regionCode({ lat: 33.25, lon: 126.1 })).toBe('50110');
  });
});
