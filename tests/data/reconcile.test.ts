// @vitest-environment node
//
// Swift BaljachwiCore DataActorTests + DataActorPruneMissingTests 의 byte-faithful 포트.
// 범위: apply / reconcile / setWantToGo / pinnedPhotoIDs / pruneMissingPins / homeCoordinate /
//       deleteAll / createEmptyStore (merge/split/title/delete 제외).
//
// 순수 인메모리 DataStore 만 검증 — fake-indexeddb 불필요(Dexie/IO 는 다음 태스크 repo.ts 담당).
import { describe, it, expect } from 'vitest';

import type { PipelineResult, PipelinePhoto, PipelineRegion, PipelineTrip } from '@/core/scanPipeline';
import type { Coordinate, BBox } from '@/core/geoTypes';
import {
  createEmptyStore,
  deleteAll,
  homeCoordinate,
  pinnedPhotoIDs,
  type DataStore,
} from '@/data/storeOps';
import {
  apply,
  reconcile,
  setWantToGo,
  pruneMissingPins,
} from '@/data/reconcile';

// ───────────────────────────────────────────────────────────────────
// Fixtures (Swift DataActorTests helper 1:1 — 시간은 epoch 초 number)
// ───────────────────────────────────────────────────────────────────

function photo(
  id: string,
  opts: {
    lat?: number;
    lon?: number;
    t: number;
    tz?: number;
    region: string | null;
    trip: string | null;
    sort?: number;
  },
): PipelinePhoto {
  return {
    localIdentifier: id,
    lat: opts.lat ?? 37.5,
    lon: opts.lon ?? 127.0,
    takenAt: opts.t,
    localTZoffsetSeconds: opts.tz ?? 32400,
    regionCode: opts.region,
    tripID: opts.trip,
    sortIndex: opts.sort ?? 0,
  };
}

function region(code: string, count: number, first: number, last: number): PipelineRegion {
  return { regionCode: code, photoCount: count, firstVisit: first, lastVisit: last };
}

function trip(
  id: string,
  start: number,
  end: number,
  rep: string | null,
  bbox: BBox = { minLat: 37.4, minLon: 126.9, maxLat: 37.6, maxLon: 127.1 },
): PipelineTrip {
  return { id, sampleIDs: [], startAt: start, endAt: end, bbox, representativeRegionCode: rep };
}

/** 기본 결과: 사진 2장(여행 T1, 지역 11140), 지역 1, 여행 1. */
function basicResult(): PipelineResult {
  return {
    photos: [
      photo('P1', { t: 100, region: '11140', trip: 'T1', sort: 0 }),
      photo('P2', { t: 200, region: '11140', trip: 'T1', sort: 1 }),
    ],
    regions: [region('11140', 2, 100, 200)],
    trips: [trip('T1', 100, 200, '11140')],
    home: null,
  };
}

/** P1만 남긴 결과(P1 단일 여행). */
function p1OnlyResult(regionCode = '11140', tripID = 'T1'): PipelineResult {
  return {
    photos: [photo('P1', { lat: 37.5, lon: 126.9, t: 100, region: regionCode, trip: tripID, sort: 0 })],
    regions: [region(regionCode, 1, 100, 100)],
    trips: [trip(tripID, 100, 100, regionCode)],
    home: null,
  };
}

function resultWithHome(home: Coordinate | null): PipelineResult {
  const b = basicResult();
  return { photos: b.photos, regions: b.regions, trips: b.trips, home };
}

function emptyStore(): DataStore {
  return createEmptyStore();
}

function findPhoto(store: DataStore, id: string) {
  return store.photos.find((p) => p.localIdentifier === id);
}
function findRegion(store: DataStore, code: string) {
  return store.regions.find((r) => r.regionCode === code);
}
function findTrip(store: DataStore, id: string) {
  return store.trips.find((t) => t.id === id);
}

// ===================================================================
// apply (멱등 upsert, 삭제 없음)
// ===================================================================

describe('apply', () => {
  // T1
  it('testApplyToEmptyStoreInserts', () => {
    const store = emptyStore();
    const r = apply(store, basicResult());

    expect(r.insertedPhotos).toBe(2);
    expect(r.updatedPhotos).toBe(0);
    expect(r.skippedOverridePhotos).toBe(0);
    expect(r.regionsWritten).toBe(1);
    expect(r.tripsWritten).toBe(1);
    expect(r.touchedTripIDs.length).toBe(1);

    expect(store.photos.length).toBe(2);
    expect(store.regions.length).toBe(1);
    expect(store.trips.length).toBe(1);

    const rs = store.regions[0];
    expect(rs.state).toBe('visited');
    expect(rs.photoCount).toBe(2);
    expect(rs.level).toBe('sigungu');
  });

  // T2
  it('testIdempotentReapply', () => {
    const store = emptyStore();
    apply(store, basicResult());
    const r2 = apply(store, basicResult());

    expect(r2.insertedPhotos).toBe(0);
    expect(r2.updatedPhotos).toBe(2);

    expect(store.photos.length).toBe(2);
    expect(store.regions.length).toBe(1);
    expect(store.trips.length).toBe(1);
  });

  // T3
  it('testReapplyUpdatesNonOverrideFields', () => {
    const store = emptyStore();
    apply(store, basicResult());

    const updated: PipelineResult = {
      photos: [
        photo('P1', { t: 100, region: '11110', trip: 'T1', sort: 0 }),
        photo('P2', { t: 200, region: '11140', trip: 'T1', sort: 1 }),
      ],
      regions: [region('11110', 1, 100, 100), region('11140', 1, 200, 200)],
      trips: [trip('T1', 100, 200, '11140')],
      home: null,
    };
    apply(store, updated);

    expect(findPhoto(store, 'P1')!.regionCode).toBe('11110');
  });

  // T4
  it('testUserOverridePhotoPreserved', () => {
    const store = emptyStore();
    apply(store, basicResult());

    const p1 = findPhoto(store, 'P1')!;
    p1.userOverride = true;
    p1.regionCode = 'OVERRIDE';

    const result2: PipelineResult = {
      photos: [
        photo('P1', { t: 100, region: '11110', trip: 'T1', sort: 0 }),
        photo('P2', { t: 200, region: '11140', trip: 'T1', sort: 1 }),
      ],
      regions: [region('11140', 2, 100, 200)],
      trips: [trip('T1', 100, 200, '11140')],
      home: null,
    };
    const r = apply(store, result2);
    expect(r.skippedOverridePhotos).toBe(1);

    const after = findPhoto(store, 'P1')!;
    expect(after.regionCode).toBe('OVERRIDE');
    expect(after.userOverride).toBe(true);
  });

  // T5
  it('testNonWantToGoOverrideRegionPreserved', () => {
    const store = emptyStore();
    apply(store, basicResult());

    const rs = store.regions[0];
    rs.userOverride = true;
    rs.state = 'notVisited';

    const r = apply(store, basicResult());
    expect(r.regionsWritten).toBe(0);

    const after = store.regions[0];
    expect(after.state).toBe('notVisited');
    expect(after.userOverride).toBe(true);
  });

  // T6
  it('testUserOverrideTripPreserved', () => {
    const store = emptyStore();
    apply(store, basicResult());

    const tr = store.trips[0];
    tr.userOverride = true;
    tr.representativeRegionCode = 'MANUAL';

    const r = apply(store, basicResult());
    expect(r.tripsWritten).toBe(0);
    expect(r.touchedTripIDs.length).toBe(1);

    expect(store.trips[0].representativeRegionCode).toBe('MANUAL');
  });

  // T7
  it('testDeleteAllClearsEverything', () => {
    const store = emptyStore();
    apply(store, basicResult());
    deleteAll(store);

    expect(store.photos.length).toBe(0);
    expect(store.regions.length).toBe(0);
    expect(store.trips.length).toBe(0);
  });

  // T8
  it('testReturnedTripIDsResolve', () => {
    const store = emptyStore();
    const r = apply(store, basicResult());
    expect(r.touchedTripIDs[0]).toBe('T1');
  });

  // T9
  it('testPhotoFieldsPersisted', () => {
    const store = emptyStore();
    apply(store, basicResult());

    const photos = [...store.photos].sort((a, b) => a.sortIndex - b.sortIndex);
    expect(photos.map((p) => p.localIdentifier)).toEqual(['P1', 'P2']);
    expect(photos.map((p) => p.tripID)).toEqual(['T1', 'T1']);
    expect(photos.map((p) => p.regionCode)).toEqual(['11140', '11140']);
    expect(photos[0].localTZoffsetSeconds).toBe(32400);
  });

  // T10
  it('testApplyWithHomeStillPersistsPhotosButNotHome', () => {
    const store = emptyStore();
    const r = apply(store, resultWithHome({ lat: 37.5, lon: 127.0 }));
    expect(r.insertedPhotos).toBe(2);
    expect(store.home.length).toBe(0);
  });

  // T11
  it('testFreshActorReapplyIsIdempotent', () => {
    const store = emptyStore();
    apply(store, basicResult());
    const r = apply(store, basicResult());
    expect(r.insertedPhotos).toBe(0);
    expect(r.updatedPhotos).toBe(2);
    expect(store.photos.length).toBe(2);
    expect(store.regions.length).toBe(1);
    expect(store.trips.length).toBe(1);
  });
});

// ===================================================================
// reconcile (전체 동기화: upsert + prune)
// ===================================================================

describe('reconcile', () => {
  // R1
  it('testReconcileDeletesAbsentNonOverridePhoto', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    const res = reconcile(store, p1OnlyResult());
    expect(res.deletedPhotos).toBe(1);
    expect(store.photos.map((p) => p.localIdentifier)).toEqual(['P1']);
  });

  // R2
  it('testReconcileKeepsAbsentOverridePhoto', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    findPhoto(store, 'P2')!.userOverride = true;

    const res = reconcile(store, p1OnlyResult());
    expect(res.deletedPhotos).toBe(0);
    expect(store.photos.length).toBe(2);
  });

  // R3
  it('testReconcileDeletesAbsentNonOverrideRegion', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    const res = reconcile(store, p1OnlyResult('11110'));
    expect(res.deletedRegions).toBe(1);
    expect(store.regions.map((r) => r.regionCode)).toEqual(['11110']);
  });

  // R4
  it('testReconcileKeepsAbsentOverrideRegion', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    const rs = store.regions[0];
    rs.userOverride = true;
    rs.state = 'wantToGo';

    reconcile(store, p1OnlyResult('11110'));
    const kept = findRegion(store, '11140');
    expect(kept).toBeDefined();
    expect(kept!.state).toBe('wantToGo');
  });

  // R5
  it('testReconcileDeletesOrphanNonOverrideTrip', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    const r: PipelineResult = {
      photos: [
        photo('P1', { t: 100, region: '11140', trip: 'T2', sort: 0 }),
        photo('P2', { t: 200, region: '11140', trip: 'T2', sort: 1 }),
      ],
      regions: [region('11140', 2, 100, 200)],
      trips: [trip('T2', 100, 200, '11140')],
      home: null,
    };
    const res = reconcile(store, r);
    expect(res.deletedTrips).toBe(1);
    expect(store.trips.map((t) => t.id)).toEqual(['T2']);
  });

  // R6
  it('testReconcileKeepsAbsentOverrideTrip', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    findTrip(store, 'T1')!.userOverride = true;

    const r: PipelineResult = {
      photos: [
        photo('P1', { t: 100, region: '11140', trip: 'T2', sort: 0 }),
        photo('P2', { t: 200, region: '11140', trip: 'T2', sort: 1 }),
      ],
      regions: [region('11140', 2, 100, 200)],
      trips: [trip('T2', 100, 200, '11140')],
      home: null,
    };
    const res = reconcile(store, r);
    expect(res.deletedTrips).toBe(0);
    expect([...store.trips.map((t) => t.id)].sort()).toEqual(['T1', 'T2']);
  });

  // R7
  it('testReconcileIdempotent', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    const res = reconcile(store, basicResult());
    expect(res.applied.insertedPhotos).toBe(0);
    expect(res.applied.updatedPhotos).toBe(2);
    expect(res.deletedPhotos).toBe(0);
    expect(res.deletedRegions).toBe(0);
    expect(res.deletedTrips).toBe(0);
    expect(store.photos.length).toBe(2);
    expect(store.regions.length).toBe(1);
    expect(store.trips.length).toBe(1);
  });

  // R8
  it('testReconcileUpsertAndDeleteTogether', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    const r: PipelineResult = {
      photos: [
        photo('P1', { lat: 37.5, lon: 126.9, t: 100, region: '11110', trip: 'T1', sort: 0 }),
        photo('P3', { lat: 37.5, lon: 126.9, t: 150, region: '11110', trip: 'T1', sort: 1 }),
      ],
      regions: [region('11110', 2, 100, 150)],
      trips: [trip('T1', 100, 150, '11110')],
      home: null,
    };
    const res = reconcile(store, r);
    expect(res.applied.insertedPhotos).toBe(1);
    expect(res.applied.updatedPhotos).toBe(1);
    expect(res.deletedPhotos).toBe(1);
    expect(res.deletedRegions).toBe(1);
    expect(res.applied.regionsWritten).toBe(1);

    expect([...store.photos.map((p) => p.localIdentifier)].sort()).toEqual(['P1', 'P3']);
    expect(store.regions.map((r) => r.regionCode)).toEqual(['11110']);
  });

  // R9
  it('testReconcileEmptyResultDeletesAllNonOverride', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    const res = reconcile(store, { photos: [], regions: [], trips: [], home: null });
    expect(res.deletedPhotos).toBe(2);
    expect(res.deletedRegions).toBe(1);
    expect(res.deletedTrips).toBe(1);
    expect(res.applied.insertedPhotos).toBe(0);
    expect(store.photos.length).toBe(0);
    expect(store.regions.length).toBe(0);
    expect(store.trips.length).toBe(0);
  });

  // R10
  it('testReconcileResegmentationNoDangling', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    const r: PipelineResult = {
      photos: [
        photo('P1', { t: 100, region: '11140', trip: 'T2a', sort: 0 }),
        photo('P2', { t: 200, region: '11140', trip: 'T2b', sort: 0 }),
      ],
      regions: [region('11140', 2, 100, 200)],
      trips: [trip('T2a', 100, 100, '11140'), trip('T2b', 200, 200, '11140')],
      home: null,
    };
    const res = reconcile(store, r);
    expect(res.deletedTrips).toBe(1);
    const trips = new Set(store.trips.map((t) => t.id));
    expect(trips).toEqual(new Set(['T2a', 'T2b']));
    for (const p of store.photos) {
      if (p.tripID !== null) expect(trips.has(p.tripID)).toBe(true);
    }
  });

  // R11
  it('testReconcileOverridePhotoPinsTrip', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    const p1 = findPhoto(store, 'P1')!;
    p1.userOverride = true; // tripID T1 유지

    const r: PipelineResult = {
      photos: [
        photo('P1', { t: 100, region: '11140', trip: 'T2', sort: 0 }),
        photo('P2', { t: 200, region: '11140', trip: 'T2', sort: 1 }),
      ],
      regions: [region('11140', 2, 100, 200)],
      trips: [trip('T2', 100, 200, '11140')],
      home: null,
    };
    const res = reconcile(store, r);
    expect(res.deletedTrips).toBe(0);
    const trips = new Set(store.trips.map((t) => t.id));
    expect(trips).toEqual(new Set(['T1', 'T2']));
    expect(findPhoto(store, 'P1')!.tripID).toBe('T1');
    for (const p of store.photos) {
      if (p.tripID !== null) expect(trips.has(p.tripID)).toBe(true);
    }
  });

  // R12
  it('testReconcileDoesNotPruneSidoRows', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    // sido 행 직접 insert.
    store.regions.push({
      regionCode: '11',
      level: 'sido',
      state: 'visited',
      photoCount: 5,
      firstVisit: null,
      lastVisit: null,
      userOverride: false,
    });

    reconcile(store, p1OnlyResult('11110'));
    const sido = store.regions.find((r) => r.level === 'sido');
    expect(sido!.regionCode).toBe('11');
    const sigungu = new Set(store.regions.filter((r) => r.level === 'sigungu').map((r) => r.regionCode));
    expect(sigungu).toEqual(new Set(['11110']));
  });

  // R13
  it('testReconcileFreshActorIdempotent', () => {
    const store = emptyStore();
    reconcile(store, basicResult());
    const res = reconcile(store, basicResult());
    expect(res.applied.insertedPhotos).toBe(0);
    expect(res.applied.updatedPhotos).toBe(2);
    expect(res.deletedPhotos).toBe(0);
    expect(res.deletedRegions).toBe(0);
    expect(res.deletedTrips).toBe(0);
    expect(store.photos.length).toBe(2);
    expect(store.regions.length).toBe(1);
    expect(store.trips.length).toBe(1);
  });
});

// ===================================================================
// home 영속 (HomeCache 단일 행)
// ===================================================================

describe('home', () => {
  // H1
  it('testReconcilePersistsHome', () => {
    const store = emptyStore();
    const r = reconcile(store, resultWithHome({ lat: 37.5, lon: 127.0 }));
    expect(r.homeChanged).toBe(true);
    expect(store.home.length).toBe(1);
    expect(store.home[0].lat).toBe(37.5);
    expect(store.home[0].lon).toBe(127.0);
    expect(homeCoordinate(store)).toEqual({ lat: 37.5, lon: 127.0 });
  });

  // H2
  it('testReconcileUpdatesHome', () => {
    const store = emptyStore();
    reconcile(store, resultWithHome({ lat: 37.5, lon: 127.0 }));
    const r = reconcile(store, resultWithHome({ lat: 35.1, lon: 129.0 }));
    expect(r.homeChanged).toBe(true);
    expect(store.home.length).toBe(1);
    expect(store.home[0].lat).toBe(35.1);
    expect(store.home[0].lon).toBe(129.0);
  });

  // H3
  it('testReconcileSameHomeNoChange', () => {
    const store = emptyStore();
    reconcile(store, resultWithHome({ lat: 37.5, lon: 127.0 }));
    const r = reconcile(store, resultWithHome({ lat: 37.5, lon: 127.0 }));
    expect(r.homeChanged).toBe(false);
    expect(store.home.length).toBe(1);
  });

  // H4
  it('testReconcileNilHomeClears', () => {
    const store = emptyStore();
    reconcile(store, resultWithHome({ lat: 37.5, lon: 127.0 }));
    const r = reconcile(store, resultWithHome(null));
    expect(r.homeChanged).toBe(true);
    expect(store.home.length).toBe(0);
    expect(homeCoordinate(store)).toBeNull();
  });

  // H5
  it('testApplyDoesNotTouchHome', () => {
    const store = emptyStore();
    reconcile(store, resultWithHome({ lat: 37.5, lon: 127.0 }));
    apply(store, resultWithHome({ lat: 35.1, lon: 129.0 }));
    expect(store.home.length).toBe(1);
    expect(store.home[0].lat).toBe(37.5);
    expect(store.home[0].lon).toBe(127.0);
  });

  // H6
  it('testDeleteAllClearsHome', () => {
    const store = emptyStore();
    reconcile(store, resultWithHome({ lat: 37.5, lon: 127.0 }));
    deleteAll(store);
    expect(store.home.length).toBe(0);
    expect(homeCoordinate(store)).toBeNull();
  });

  // H7
  it('testReconcileEnforcesSingleHomeRow', () => {
    const store = emptyStore();
    reconcile(store, basicResult()); // home 없음
    store.home.push({ lat: 1.0, lon: 1.0 });
    store.home.push({ lat: 2.0, lon: 2.0 });

    reconcile(store, resultWithHome({ lat: 37.5, lon: 127.0 }));
    expect(store.home.length).toBe(1);
    expect(store.home[0].lat).toBe(37.5);
    expect(store.home[0].lon).toBe(127.0);
  });

  // H8
  it('testHomeReadableFromFreshActor', () => {
    const store = emptyStore();
    reconcile(store, resultWithHome({ lat: 37.5, lon: 127.0 }));
    expect(homeCoordinate(store)).toEqual({ lat: 37.5, lon: 127.0 });
  });
});

// ===================================================================
// 가고싶음 토글 (setWantToGo, visited-wins)
// ===================================================================

describe('setWantToGo', () => {
  // WT1
  it('testSetWantToGoCreatesOverrideRow', () => {
    const store = emptyStore();
    setWantToGo(store, '11140', true);
    expect(store.regions.length).toBe(1);
    const r = store.regions[0];
    expect(r.regionCode).toBe('11140');
    expect(r.level).toBe('sigungu');
    expect(r.state).toBe('wantToGo');
    expect(r.userOverride).toBe(true);
    expect(r.photoCount).toBe(0);
  });

  // WT2
  it('testSetWantToGoOffDeletesRow', () => {
    const store = emptyStore();
    setWantToGo(store, '11140', true);
    setWantToGo(store, '11140', false);
    expect(store.regions.length).toBe(0);
  });

  // WT3
  it('testSetWantToGoIdempotent', () => {
    const store = emptyStore();
    setWantToGo(store, '11140', true);
    setWantToGo(store, '11140', true);
    expect(store.regions.length).toBe(1);
    expect(store.regions[0].state).toBe('wantToGo');
  });

  // WT4
  it('testWantToGoUpgradedToVisitedWhenPhotosAppear', () => {
    const store = emptyStore();
    setWantToGo(store, '11140', true);
    reconcile(store, basicResult());

    const rows = store.regions.filter((r) => r.regionCode === '11140');
    expect(rows.length).toBe(1);
    const r = rows[0];
    expect(r.state).toBe('visited');
    expect(r.userOverride).toBe(false);
    expect(r.photoCount).toBe(2);
  });

  // WT5
  it('testWantToGoSurvivesReconcileWhenAbsent', () => {
    const store = emptyStore();
    setWantToGo(store, '26470', true);
    reconcile(store, basicResult());

    const rows = store.regions.filter((r) => r.regionCode === '26470');
    expect(rows.length).toBe(1);
    expect(rows[0].state).toBe('wantToGo');
  });

  // WT6
  it('testSetWantToGoNeverClobbersVisited', () => {
    const store = emptyStore();
    apply(store, basicResult()); // 11140 = visited

    setWantToGo(store, '11140', true);
    let rows = store.regions.filter((r) => r.regionCode === '11140');
    expect(rows[0].state).toBe('visited');
    expect(rows[0].userOverride).toBe(false);

    setWantToGo(store, '11140', false);
    rows = store.regions.filter((r) => r.regionCode === '11140');
    expect(rows.length).toBe(1);
    expect(rows[0].state).toBe('visited');
  });
});

// ===================================================================
// pinnedPhotoIDs
// ===================================================================

describe('pinnedPhotoIDs', () => {
  // PIN
  it('testPinnedPhotoIDsReturnsOverridePhotos', () => {
    const store = emptyStore();
    apply(store, basicResult());
    expect(pinnedPhotoIDs(store)).toEqual(new Set());

    findPhoto(store, 'P1')!.userOverride = true;
    expect(pinnedPhotoIDs(store)).toEqual(new Set(['P1']));
  });
});

// ===================================================================
// pruneMissingPins (삭제된 핀 정리 — 제자리 recalc)
// ===================================================================

// 핀 헬퍼: T1을 핀+제목, 멤버 photo userOverride=true (Swift setTripTitle 등가 직접 변형).
function titledPinnedT1(
  members: { id: string; lat: number; lon: number; t: number }[],
  title = '내 여행',
): DataStore {
  const store = emptyStore();
  const result: PipelineResult = {
    photos: members.map((m, i) => ({
      localIdentifier: m.id,
      lat: m.lat,
      lon: m.lon,
      takenAt: m.t,
      localTZoffsetSeconds: 32400,
      regionCode: '11140',
      tripID: 'T1',
      sortIndex: i,
    })),
    regions: [
      region(
        '11140',
        members.length,
        Math.min(...members.map((m) => m.t)),
        Math.max(...members.map((m) => m.t)),
      ),
    ],
    trips: [
      {
        id: 'T1',
        sampleIDs: members.map((m) => m.id),
        startAt: Math.min(...members.map((m) => m.t)),
        endAt: Math.max(...members.map((m) => m.t)),
        bbox: { minLat: 0, minLon: 0, maxLat: 0, maxLon: 0 },
        representativeRegionCode: '11140',
      },
    ],
    home: null,
  };
  apply(store, result);
  // setTripTitle 등가: trip.userOverride=true + trip.title 설정 + 멤버 photo.userOverride=true.
  const t = findTrip(store, 'T1')!;
  t.userOverride = true;
  t.title = title;
  for (const p of store.photos) p.userOverride = true;
  return store;
}

describe('pruneMissingPins', () => {
  // P1
  it('testPartialMissingRecalcsInPlacePreservingFields', () => {
    const store = titledPinnedT1([
      { id: 'P1', lat: 37.1, lon: 127.1, t: 100 },
      { id: 'P2', lat: 37.2, lon: 127.2, t: 200 },
      { id: 'P3', lat: 37.3, lon: 127.3, t: 300 },
    ]);

    const result = pruneMissingPins(store, new Set(['P1', 'P2']));
    expect(result.removedPhotos).toBe(1);
    expect(result.recalcedTrips).toBe(1);
    expect(result.deletedTrips).toBe(0);

    expect(store.trips.map((t) => t.id)).toEqual(['T1']);
    const t = findTrip(store, 'T1')!;
    expect(t.title).toBe('내 여행');
    expect(t.userOverride).toBe(true);
    expect(t.startAt).toBe(100);
    expect(t.endAt).toBe(200);
    expect({ minLat: t.minLat, minLon: t.minLon, maxLat: t.maxLat, maxLon: t.maxLon }).toEqual({
      minLat: 37.1,
      minLon: 127.1,
      maxLat: 37.2,
      maxLon: 127.2,
    });
    expect(new Set(store.photos.map((p) => p.localIdentifier))).toEqual(new Set(['P1', 'P2']));
  });

  // P2
  it('testAllMissingDeletesTrip', () => {
    const store = titledPinnedT1([
      { id: 'P1', lat: 37.1, lon: 127.1, t: 100 },
      { id: 'P2', lat: 37.2, lon: 127.2, t: 200 },
    ]);

    const result = pruneMissingPins(store, new Set());
    expect(result.removedPhotos).toBe(2);
    expect(result.deletedTrips).toBe(1);
    expect(result.recalcedTrips).toBe(0);

    expect(store.trips.length).toBe(0);
    expect(store.photos.length).toBe(0);
  });

  // P3
  it('testNonOverrideMissingUntouched', () => {
    const store = emptyStore();
    apply(store, {
      photos: [
        photo('P1', { lat: 37.1, lon: 127.1, t: 100, region: '11140', trip: 'T1', sort: 0 }),
        photo('P2', { lat: 37.2, lon: 127.2, t: 200, region: '11140', trip: 'T1', sort: 1 }),
      ],
      regions: [region('11140', 2, 100, 200)],
      trips: [trip('T1', 100, 200, '11140', { minLat: 0, minLon: 0, maxLat: 0, maxLon: 0 })],
      home: null,
    });

    const result = pruneMissingPins(store, new Set());
    expect(result.removedPhotos).toBe(0);
    expect(result.deletedTrips).toBe(0);

    expect(store.trips.map((t) => t.id)).toEqual(['T1']);
    expect(store.photos.length).toBe(2);
  });

  // P4
  it('testPresentPinsPreserved', () => {
    const store = titledPinnedT1([
      { id: 'P1', lat: 37.1, lon: 127.1, t: 100 },
      { id: 'P2', lat: 37.2, lon: 127.2, t: 200 },
    ]);

    const result = pruneMissingPins(store, new Set(['P1', 'P2']));
    expect(result.removedPhotos).toBe(0);

    const t = findTrip(store, 'T1')!;
    expect(t.title).toBe('내 여행');
    expect(t.endAt).toBe(200);
    expect(store.photos.length).toBe(2);
  });

  // P5
  it('testNoMissingIsNoOp', () => {
    const store = titledPinnedT1([
      { id: 'P1', lat: 37.1, lon: 127.1, t: 100 },
      { id: 'P2', lat: 37.2, lon: 127.2, t: 200 },
    ]);

    const result = pruneMissingPins(store, new Set(['P1', 'P2', 'extra_unrelated']));
    expect(result.removedPhotos).toBe(0);
    expect(result.recalcedTrips).toBe(0);
    expect(result.deletedTrips).toBe(0);
  });

  // P6
  it('testColdActorSeesPinnedData', () => {
    const store = titledPinnedT1(
      [
        { id: 'P1', lat: 37.1, lon: 127.1, t: 100 },
        { id: 'P2', lat: 37.2, lon: 127.2, t: 200 },
      ],
      '콜드',
    );

    const result = pruneMissingPins(store, new Set(['P1']));
    expect(result.removedPhotos).toBe(1);
    expect(result.recalcedTrips).toBe(1);

    const t = findTrip(store, 'T1')!;
    expect(t.title).toBe('콜드');
    expect(t.endAt).toBe(100);
  });

  // P7
  it('testIdempotentAcrossConsecutiveRuns', () => {
    const store = titledPinnedT1([
      { id: 'P1', lat: 37.1, lon: 127.1, t: 100 },
      { id: 'P2', lat: 37.2, lon: 127.2, t: 200 },
      { id: 'P3', lat: 37.3, lon: 127.3, t: 300 },
    ]);

    pruneMissingPins(store, new Set(['P1'])); // P2,P3 제거
    const second = pruneMissingPins(store, new Set(['P1']));
    expect(second.removedPhotos).toBe(0);
    expect(second.recalcedTrips).toBe(0);
    expect(second.deletedTrips).toBe(0);

    expect(store.photos.map((p) => p.localIdentifier)).toEqual(['P1']);
    expect(findTrip(store, 'T1')!.title).toBe('내 여행');
  });
});
