// @vitest-environment node
//
// Swift ModelTests(BaljachwiCore) 의 byte-faithful 포트.
// IndexedDB 왕복 검증은 node 환경 + fake-indexeddb 로 수행한다(jsdom 미사용).
// Blob 은 structured clone 불가하므로 fake-indexeddb 에 넣지 않는다.
import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';

import {
  VISIT_STATES,
  type VisitState,
  type RegionLevel,
  type PhotoRef,
  type TripRecord,
  type RegionStatus,
  type HomeCache,
  HOME_CACHE_ROW_ID,
  photoRefCoordinate,
  tripRecordBBox,
  homeCacheCoordinate,
  makePhotoRef,
  makeTripRecord,
  makeRegionStatus,
} from '@/data/models';
import { BaljachwiDB } from '@/data/db';

// ───────────────────────────────────────────────────────────────────
// 순수(비-DB) 단언 — ModelTests 의 계산 프로퍼티/enum 케이스 포트
// ───────────────────────────────────────────────────────────────────

describe('VisitState (testVisitStateRawValueAndCases)', () => {
  it('rawValue 문자열 직렬화 값이 정확히 "visited"', () => {
    const v: VisitState = 'visited';
    expect(v).toBe('visited');
  });

  it('"wantToGo" 문자열에서 역직렬화 → wantToGo (VISIT_STATES 멤버)', () => {
    const raw = 'wantToGo';
    expect(VISIT_STATES.includes(raw as VisitState)).toBe(true);
    expect((VISIT_STATES as readonly string[]).indexOf(raw)).toBeGreaterThanOrEqual(0);
  });

  it('allCases 집합 = {visited, wantToGo, notVisited} 정확히 3개', () => {
    expect(new Set(VISIT_STATES)).toEqual(new Set(['visited', 'wantToGo', 'notVisited']));
    expect(VISIT_STATES).toHaveLength(3);
    // 선언 순서 보존
    expect(VISIT_STATES).toEqual(['visited', 'wantToGo', 'notVisited']);
  });
});

describe('PhotoRef.coordinate (testPhotoRefCoordinateComputed)', () => {
  it('photoRefCoordinate deep-equals {lat,lon}; userOverride 기본 false', () => {
    const p = makePhotoRef({
      localIdentifier: 'A',
      lat: 37.5,
      lon: 127.0,
      takenAt: 0,
      localTZoffsetSeconds: 32400,
    });
    expect(photoRefCoordinate(p)).toEqual({ lat: 37.5, lon: 127.0 });
    expect(p.userOverride).toBe(false); // 기본 false
  });

  it('makePhotoRef 기본값 (regionCode/tripID=null, sortIndex=0, userOverride=false)', () => {
    const p = makePhotoRef({
      localIdentifier: 'A',
      lat: 1,
      lon: 2,
      takenAt: 5,
      localTZoffsetSeconds: 0,
    });
    expect(p.regionCode).toBeNull();
    expect(p.tripID).toBeNull();
    expect(p.sortIndex).toBe(0);
    expect(p.userOverride).toBe(false);
    // takenAt 은 epoch '초' 정수 그대로
    expect(p.takenAt).toBe(5);
  });
});

describe('TripRecord.bbox (testTripRecordBBoxComputed)', () => {
  it('tripRecordBBox deep-equals 저장된 4개 Double', () => {
    const t = makeTripRecord({
      id: 'T1',
      startAt: 0,
      endAt: 100,
      minLat: 35.0,
      minLon: 129.0,
      maxLat: 35.2,
      maxLon: 129.2,
    });
    expect(tripRecordBBox(t)).toEqual({
      minLat: 35.0,
      minLon: 129.0,
      maxLat: 35.2,
      maxLon: 129.2,
    });
  });

  it('makeTripRecord 기본값 (representativeRegionCode/title=null, userOverride=false)', () => {
    const t = makeTripRecord({
      id: 'T1',
      startAt: 0,
      endAt: 100,
      minLat: 0,
      minLon: 0,
      maxLat: 1,
      maxLon: 1,
    });
    expect(t.representativeRegionCode).toBeNull();
    expect(t.userOverride).toBe(false);
    expect(t.title).toBeNull();
  });
});

describe('makeRegionStatus 기본값', () => {
  it('state=notVisited, photoCount=0, firstVisit/lastVisit=null, userOverride=false', () => {
    const r = makeRegionStatus({ regionCode: '11140', level: 'sigungu' });
    expect(r.state).toBe('notVisited');
    expect(r.photoCount).toBe(0);
    expect(r.firstVisit).toBeNull();
    expect(r.lastVisit).toBeNull();
    expect(r.userOverride).toBe(false);
  });
});

describe('homeCacheCoordinate', () => {
  it('deep-equals {lat,lon}', () => {
    const h: HomeCache = { id: HOME_CACHE_ROW_ID, lat: 37.5, lon: 127.0 };
    expect(homeCacheCoordinate(h)).toEqual({ lat: 37.5, lon: 127.0 });
  });

  it('HOME_CACHE_ROW_ID 고정 PK=1', () => {
    expect(HOME_CACHE_ROW_ID).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────────────
// DB 왕복 — fake-indexeddb. ModelTests 컨테이너 공유 + 매 테스트 전체 삭제 패턴 포트.
// ───────────────────────────────────────────────────────────────────

describe('BaljachwiDB roundtrip', () => {
  let db: BaljachwiDB;

  beforeEach(async () => {
    db = new BaljachwiDB('baljachwi-models-test');
    await db.open();
    // ModelTests.ctx() 의 전체 삭제 격리 패턴 — 모든 테이블 clear.
    await Promise.all([
      db.photoRefs.clear(),
      db.tripRecords.clear(),
      db.regionStatuses.clear(),
      db.homeCache.clear(),
      db.thumbs.clear(),
    ]);
  });

  afterEach(() => {
    db.close();
  });

  it('5개 테이블이 존재한다 (thumbs 포함)', () => {
    const names = db.tables.map((t) => t.name).sort();
    expect(names).toEqual(
      ['homeCache', 'photoRefs', 'regionStatuses', 'thumbs', 'tripRecords'].sort(),
    );
  });

  it('photoRefInsertAndFetch: 1건 insert 후 전체 fetch → count 1, first.localIdentifier === "A"', async () => {
    await db.photoRefs.put(
      makePhotoRef({
        localIdentifier: 'A',
        lat: 37.5,
        lon: 127.0,
        takenAt: 10,
        localTZoffsetSeconds: 32400,
      }),
    );
    const all = await db.photoRefs.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].localIdentifier).toBe('A');
  });

  it('regionStatusVisitStatePersists: insert→save→fetch 후 state="visited" 문자열 영속, photoCount=3', async () => {
    await db.regionStatuses.put(
      makeRegionStatus({
        regionCode: '11140',
        level: 'sigungu',
        state: 'visited',
        photoCount: 3,
      }),
    );
    const fetched = await db.regionStatuses.toArray();
    expect(fetched).toHaveLength(1);
    expect(fetched[0].state).toBe('visited');
    expect(fetched[0].photoCount).toBe(3);
  });

  it('deletingTripRecordPreservesPhotoRefs: Trip 삭제해도 PhotoRef 보존 + tripID 유지 (cascade 없음)', async () => {
    await db.tripRecords.put(
      makeTripRecord({
        id: 'T1',
        startAt: 0,
        endAt: 100,
        minLat: 0,
        minLon: 0,
        maxLat: 1,
        maxLon: 1,
      }),
    );
    await db.photoRefs.put(
      makePhotoRef({
        localIdentifier: 'P1',
        lat: 0.5,
        lon: 0.5,
        takenAt: 10,
        localTZoffsetSeconds: 32400,
        tripID: 'T1',
      }),
    );
    // TripRecord 만 삭제
    await db.tripRecords.delete('T1');

    const trips = await db.tripRecords.toArray();
    const photos = await db.photoRefs.toArray();
    expect(trips).toHaveLength(0); // TripRecord 삭제됨
    expect(photos).toHaveLength(1); // PhotoRef cascade되지 않고 보존
    expect(photos[0].tripID).toBe('T1'); // 약참조라 자동 nullify되지 않음
  });

  it('photoRefsSortedBySortIndex: 역순 삽입 → tripID 쿼리 + sortIndex 오름차순 → ["a","b","c"]', async () => {
    // 의도적으로 역순 삽입.
    const order: Array<[string, number]> = [
      ['c', 2],
      ['a', 0],
      ['b', 1],
    ];
    for (const [id, idx] of order) {
      await db.photoRefs.put(
        makePhotoRef({
          localIdentifier: id,
          lat: 0,
          lon: 0,
          takenAt: 0,
          localTZoffsetSeconds: 0,
          tripID: 'T1',
          sortIndex: idx,
        }),
      );
    }
    const rows = await db.photoRefs.where('tripID').equals('T1').toArray();
    rows.sort((a, b) => a.sortIndex - b.sortIndex); // 숫자 비교 (10<9 버그 방지)
    expect(rows.map((r) => r.localIdentifier)).toEqual(['a', 'b', 'c']);
  });

  it('userOverrideSettable: userOverride:true 저장→fetch 후 true (boolean 영속)', async () => {
    await db.photoRefs.put(
      makePhotoRef({
        localIdentifier: 'A',
        lat: 0,
        lon: 0,
        takenAt: 0,
        localTZoffsetSeconds: 0,
        userOverride: true,
      }),
    );
    const fetched = await db.photoRefs.toArray();
    expect(fetched[0].userOverride).toBe(true);
  });

  it('homeCache 단일행 upsert: 항상 id=1 (HOME_CACHE_ROW_ID)', async () => {
    await db.homeCache.put({ id: HOME_CACHE_ROW_ID, lat: 37.5, lon: 127.0 });
    await db.homeCache.put({ id: HOME_CACHE_ROW_ID, lat: 35.1, lon: 129.0 });
    const all = await db.homeCache.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(1);
    expect(all[0].lat).toBe(35.1);
  });

  it('tripID=null 인 PhotoRef 도 put/fetch 왕복 (옵셔널=null)', async () => {
    await db.photoRefs.put(
      makePhotoRef({
        localIdentifier: 'X',
        lat: 0,
        lon: 0,
        takenAt: 0,
        localTZoffsetSeconds: 0,
      }),
    );
    const fetched = await db.photoRefs.get('X');
    expect(fetched).toBeDefined();
    expect(fetched!.tripID).toBeNull();
    // equals('T1') 쿼리에는 null 행이 잡히지 않음
    const t1 = await db.photoRefs.where('tripID').equals('T1').toArray();
    expect(t1).toHaveLength(0);
  });
});
