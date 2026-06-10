// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { BaljachwiDB } from '@/data/db';
import { makeRepo } from '@/data/repo';
import type { PipelineResult } from '@/core/scanPipeline';

// 각 테스트는 고유 이름의 인메모리 DB 로 격리.
let counter = 0;
function freshRepo() {
  const db = new BaljachwiDB(`test-${counter++}`);
  return { db, repo: makeRepo(db) };
}

// 서울시청 11140 사진 2장 + 여행 T1 + home 없음.
function basicResult(): PipelineResult {
  return {
    photos: [
      { localIdentifier: 'P1', lat: 37.5, lon: 127.0, takenAt: 100, localTZoffsetSeconds: 32400, regionCode: '11140', tripID: 'T1', sortIndex: 0 },
      { localIdentifier: 'P2', lat: 37.5, lon: 127.0, takenAt: 200, localTZoffsetSeconds: 32400, regionCode: '11140', tripID: 'T1', sortIndex: 1 },
    ],
    regions: [{ regionCode: '11140', photoCount: 2, firstVisit: 100, lastVisit: 200 }],
    trips: [{ id: 'T1', sampleIDs: ['P1', 'P2'], startAt: 100, endAt: 200, bbox: { minLat: 37.4, minLon: 126.9, maxLat: 37.6, maxLon: 127.1 }, representativeRegionCode: '11140' }],
    home: null,
  };
}

describe('repo (Dexie IO 경계)', () => {
  it('reconcileScan: 빈 DB → 행 기록 + 멱등 재적용', async () => {
    const { repo } = freshRepo();
    const r1 = await repo.reconcileScan(basicResult());
    expect(r1.applied.insertedPhotos).toBe(2);
    expect(await repo.allPhotos()).toHaveLength(2);
    expect(await repo.allRegions()).toHaveLength(1);
    expect(await repo.allTrips()).toHaveLength(1);

    // 멱등: 동일 결과 재적용 → 신규 0, 카운트 불변
    const r2 = await repo.reconcileScan(basicResult());
    expect(r2.applied.insertedPhotos).toBe(0);
    expect(await repo.allPhotos()).toHaveLength(2);
    expect(await repo.allTrips()).toHaveLength(1);
  });

  it('trips$ 동기 조회: startAt 내림차순(최신 먼저)', async () => {
    const { repo } = freshRepo();
    const res = basicResult();
    res.trips = [
      { id: 'OLD', sampleIDs: ['A'], startAt: 100, endAt: 150, bbox: { minLat: 0, minLon: 0, maxLat: 1, maxLon: 1 }, representativeRegionCode: '11140' },
      { id: 'NEW', sampleIDs: ['B'], startAt: 500, endAt: 550, bbox: { minLat: 0, minLon: 0, maxLat: 1, maxLon: 1 }, representativeRegionCode: '11140' },
    ];
    res.photos = [
      { localIdentifier: 'A', lat: 37.5, lon: 127, takenAt: 100, localTZoffsetSeconds: 32400, regionCode: '11140', tripID: 'OLD', sortIndex: 0 },
      { localIdentifier: 'B', lat: 37.5, lon: 127, takenAt: 500, localTZoffsetSeconds: 32400, regionCode: '11140', tripID: 'NEW', sortIndex: 0 },
    ];
    await repo.reconcileScan(res);
    const trips = await repo.tripsByRecent();
    expect(trips.map((t) => t.id)).toEqual(['NEW', 'OLD']);
  });

  it('photosForTrip: tripID 필터 + sortIndex 오름차순', async () => {
    const { repo } = freshRepo();
    await repo.reconcileScan(basicResult());
    const photos = await repo.photosForTrip('T1');
    expect(photos.map((p) => p.localIdentifier)).toEqual(['P1', 'P2']);
  });

  it('resetAll: 모든 테이블 비움', async () => {
    const { repo } = freshRepo();
    await repo.reconcileScan(basicResult());
    await repo.resetAll();
    expect(await repo.allPhotos()).toHaveLength(0);
    expect(await repo.allRegions()).toHaveLength(0);
    expect(await repo.allTrips()).toHaveLength(0);
  });

  it('pinnedPhotoIDs: userOverride=true PhotoRef id 집합', async () => {
    const { db, repo } = freshRepo();
    await repo.reconcileScan(basicResult());
    expect(await repo.pinnedPhotoIDs()).toEqual(new Set());
    // P1 핀 처리
    await db.photoRefs.update('P1', { userOverride: true });
    expect(await repo.pinnedPhotoIDs()).toEqual(new Set(['P1']));
  });
});
