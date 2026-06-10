// src/data/repo.ts — Dexie(IndexedDB) IO 경계 + 단일 writer.
//
// 순수 reconcile 로직(storeOps/reconcile)을 Dexie 트랜잭션으로 감싼다.
// 모든 쓰기는 이 파일 경유(원자성). 읽기 liveQuery 는 queries.ts.
//
// 패턴: 트랜잭션 안에서 전 테이블 → 인메모리 DataStore 로드 → 순수 reconcile/apply →
//       clear + bulkPut 라이트백. rw 트랜잭션이라 중간 실패 시 전체 롤백.

import type { BaljachwiDB } from '@/data/db';
import { getDB } from '@/data/db';
import type { PipelineResult } from '@/core/scanPipeline';
import { createEmptyStore, pinnedPhotoIDs as storePinnedIDs, type DataStore } from '@/data/storeOps';
import { reconcile, apply, type ReconcileResult, type ApplyResult } from '@/data/reconcile';
import type { PhotoRef, TripRecord, RegionStatus } from '@/data/models';
import { HOME_CACHE_ROW_ID } from '@/data/models';

/** 전 테이블 → 인메모리 DataStore 로드(트랜잭션 내부 호출). */
async function loadStore(db: BaljachwiDB): Promise<DataStore> {
  const store = createEmptyStore();
  store.photos = await db.photoRefs.toArray();
  store.regions = await db.regionStatuses.toArray();
  store.trips = await db.tripRecords.toArray();
  store.home = (await db.homeCache.toArray()).map((h) => ({ lat: h.lat, lon: h.lon }));
  return store;
}

/** 인메모리 DataStore → 전 테이블 라이트백(트랜잭션 내부 호출, clear 후 bulkPut). */
async function writeBack(db: BaljachwiDB, store: DataStore): Promise<void> {
  await Promise.all([
    db.photoRefs.clear(),
    db.regionStatuses.clear(),
    db.tripRecords.clear(),
    db.homeCache.clear(),
  ]);
  await Promise.all([
    db.photoRefs.bulkPut(store.photos),
    db.regionStatuses.bulkPut(store.regions),
    db.tripRecords.bulkPut(store.trips),
    db.homeCache.bulkPut(store.home.map((h) => ({ id: HOME_CACHE_ROW_ID, lat: h.lat, lon: h.lon }))),
  ]);
}

/** DB 인스턴스를 주입받는 repo. 앱은 makeRepo(getDB()), 테스트는 인메모리 DB 주입. */
export function makeRepo(db: BaljachwiDB) {
  return {
    /** 전체 스캔 동기화(upsert + prune + home). 단일 rw 트랜잭션. */
    async reconcileScan(result: PipelineResult): Promise<ReconcileResult> {
      return db.transaction(
        'rw',
        db.photoRefs,
        db.regionStatuses,
        db.tripRecords,
        db.homeCache,
        async () => {
          const store = await loadStore(db);
          const res = reconcile(store, result);
          await writeBack(db, store);
          return res;
        },
      );
    },

    /** 증분 가져오기(upsert만, prune·home 미터치). */
    async applyScan(result: PipelineResult): Promise<ApplyResult> {
      return db.transaction(
        'rw',
        db.photoRefs,
        db.regionStatuses,
        db.tripRecords,
        db.homeCache,
        async () => {
          const store = await loadStore(db);
          const res = apply(store, result);
          await writeBack(db, store);
          return res;
        },
      );
    },

    /** 썸네일 저장(별도 테이블, 실패해도 본 데이터 무관). */
    async saveThumb(localIdentifier: string, data: Blob): Promise<void> {
      await db.thumbs.put({ localIdentifier, data });
    },

    /** 썸네일 조회(없으면 null). */
    async thumbFor(localIdentifier: string): Promise<Blob | null> {
      const row = await db.thumbs.get(localIdentifier);
      return row ? row.data : null;
    },

    /** userOverride=true PhotoRef 의 localIdentifier 집합(다음 스캔 excludedTripSampleIDs). */
    async pinnedPhotoIDs(): Promise<Set<string>> {
      const store = createEmptyStore();
      store.photos = await db.photoRefs.toArray();
      return storePinnedIDs(store);
    },

    /** 데이터 초기화 — 5 테이블 전부 비움(DataActor.deleteAll + 썸네일).
     *  테이블이 5개라 배열 형태 transaction 사용(가변 인자 오버로드 한도 초과 회피). */
    async resetAll(): Promise<void> {
      await db.transaction(
        'rw',
        [db.photoRefs, db.regionStatuses, db.tripRecords, db.homeCache, db.thumbs],
        async () => {
          await Promise.all([
            db.photoRefs.clear(),
            db.regionStatuses.clear(),
            db.tripRecords.clear(),
            db.homeCache.clear(),
            db.thumbs.clear(),
          ]);
        },
      );
    },

    // ── 단건 조회(테스트·비-live 용) ──
    allPhotos: (): Promise<PhotoRef[]> => db.photoRefs.toArray(),
    allRegions: (): Promise<RegionStatus[]> => db.regionStatuses.toArray(),
    allTrips: (): Promise<TripRecord[]> => db.tripRecords.toArray(),
    /** 최신순(startAt 내림차순) 여행. */
    tripsByRecent: (): Promise<TripRecord[]> =>
      db.tripRecords.orderBy('startAt').reverse().toArray(),
    /** 여행 사진(sortIndex 오름차순). */
    photosForTrip: (tripID: string): Promise<PhotoRef[]> =>
      db.photoRefs.where('tripID').equals(tripID).sortBy('sortIndex'),
  };
}

export type Repo = ReturnType<typeof makeRepo>;

/** 앱 전역 repo(싱글턴 DB). */
export const repo = (): Repo => makeRepo(getDB());
