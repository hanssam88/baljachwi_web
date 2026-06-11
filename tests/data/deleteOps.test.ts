// tests/data/deleteOps.test.ts
import { describe, it, expect } from 'vitest';
import { aggregateSigunguRegions, deletePhotosFromStore } from '@/data/deleteOps';
import { createEmptyStore, type DataStore } from '@/data/storeOps';
import { makePhotoRef, makeRegionStatus, makeTripRecord } from '@/data/models';

const KST = 32400;
function ph(id: string, region: string | null, takenAt: number) {
  return makePhotoRef({ localIdentifier: id, lat: 33.5, lon: 126.5, takenAt, localTZoffsetSeconds: KST, regionCode: region });
}
function store(): DataStore {
  const s = createEmptyStore();
  s.photos = [ph('a', 'R1', 100), ph('b', 'R1', 300), ph('c', 'R2', 200)];
  s.regions = [
    makeRegionStatus({ regionCode: 'R1', level: 'sigungu', state: 'visited', photoCount: 2, firstVisit: 100, lastVisit: 300 }),
    makeRegionStatus({ regionCode: 'R2', level: 'sigungu', state: 'visited', photoCount: 1, firstVisit: 200, lastVisit: 200 }),
  ];
  return s;
}

describe('aggregateSigunguRegions', () => {
  it('regionCode별 count/min/max takenAt 집계, null 제외', () => {
    const agg = aggregateSigunguRegions([ph('a', 'R1', 100), ph('b', 'R1', 300), ph('c', 'R2', 200), ph('d', null, 400)]);
    expect(agg.get('R1')).toEqual({ photoCount: 2, firstVisit: 100, lastVisit: 300 });
    expect(agg.get('R2')).toEqual({ photoCount: 1, firstVisit: 200, lastVisit: 200 });
    expect(agg.size).toBe(2);
  });
});

describe('deletePhotosFromStore', () => {
  it('사진 삭제 → store.photos에서 제거', () => {
    const s = store();
    deletePhotosFromStore(s, ['a']);
    expect(s.photos.map((p) => p.localIdentifier)).toEqual(['b', 'c']);
  });
  it('지역에 생존 사진 남으면 photoCount/방문시각 재계산(firstVisit=min 당겨짐)', () => {
    const s = store();
    deletePhotosFromStore(s, ['a']); // R1에 b(300)만 남음
    expect(s.regions.find((r) => r.regionCode === 'R1')).toMatchObject({ photoCount: 1, firstVisit: 300, lastVisit: 300, state: 'visited' });
  });
  it('lastVisit=max 사진 삭제 시 방문시각 양방향 갱신', () => {
    const s = store();
    deletePhotosFromStore(s, ['b']); // R1에 a(100)만 남음
    expect(s.regions.find((r) => r.regionCode === 'R1')).toMatchObject({ photoCount: 1, firstVisit: 100, lastVisit: 100 });
  });
  it('지역 생존 사진 0 + 비override → 행 삭제', () => {
    const s = store();
    deletePhotosFromStore(s, ['c']);
    expect(s.regions.find((r) => r.regionCode === 'R2')).toBeUndefined();
    expect(s.regions.find((r) => r.regionCode === 'R1')).toBeDefined();
  });
  it('userOverride(가고싶음) 지역은 생존0이어도 보존', () => {
    const s = store();
    s.regions.push(makeRegionStatus({ regionCode: 'R9', level: 'sigungu', state: 'wantToGo', userOverride: true }));
    deletePhotosFromStore(s, ['a', 'b', 'c']);
    expect(s.regions.find((r) => r.regionCode === 'R9')).toBeDefined();
    expect(s.regions.find((r) => r.regionCode === 'R1')).toBeUndefined();
  });
  it('sido 행은 미터치', () => {
    const s = store();
    s.regions.push(makeRegionStatus({ regionCode: 'S1', level: 'sido', state: 'visited' }));
    deletePhotosFromStore(s, ['a', 'b', 'c']);
    expect(s.regions.find((r) => r.regionCode === 'S1')).toBeDefined();
  });
  it('trips/home 미터치 + 빈 ids no-op', () => {
    const s = store();
    s.trips = [makeTripRecord({ id: 'T1', startAt: 0, endAt: 1, minLat: 0, minLon: 0, maxLat: 1, maxLon: 1 })];
    s.home = [{ lat: 1, lon: 2 }];
    deletePhotosFromStore(s, []);
    expect(s.photos).toHaveLength(3);
    deletePhotosFromStore(s, ['a']);
    expect(s.trips).toHaveLength(1);
    expect(s.home).toEqual([{ lat: 1, lon: 2 }]);
  });
});
