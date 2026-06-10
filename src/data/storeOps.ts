// src/data/storeOps.ts — Swift BaljachwiCore/DataActor.swift 의 인메모리 store + 순수 헬퍼 포트.
//
// 범위(_GLOBAL_RULES + dataActorReconcile 카드 + 오버라이드):
//  - SwiftData ModelContext → plain mutable DataStore(인메모리 배열). Dexie/IO 없음(repo.ts 담당).
//  - 레코드 타입은 @/data/models 의 PhotoRef/RegionStatus/TripRecord/HomeCache 를 import(재정의 금지).
//  - 시간은 epoch 초 number 정수 산술만. JS Date 객체/타임존 메서드 금지.
//  - Swift Optional → `| null`(undefined 금지).
//
// 여기엔 store 정의 + 삭제/리셋/조회 헬퍼 + reconcile.ts 가 위임하는 내부 upsert/prune/syncHome 을 둔다.

import type { Coordinate } from '@/core/geoTypes';
import type { PhotoRef, RegionStatus, TripRecord } from '@/data/models';
import type { PipelineResult } from '@/core/scanPipeline';

const LEVEL_SIGUNGU = 'sigungu' as const;
const VISIT_STATE_VISITED = 'visited' as const;
const VISIT_STATE_WANT_TO_GO = 'wantToGo' as const;

/** HomeCache 좌표 행(models.HomeCache 의 id 제외 — 인메모리 store 는 PK 불필요). */
export interface HomeCacheRow {
  lat: number;
  lon: number;
}

/**
 * SwiftData ModelContext 대체 — 인메모리 mutable store. 단일 writer 규율은 호출부 책임.
 * 레코드 타입은 @/data/models 의 byte-faithful 인터페이스 사용.
 */
export interface DataStore {
  photos: PhotoRef[];
  regions: RegionStatus[];
  trips: TripRecord[];
  /** 불변식 ≤1행. 외부 폴리션(다중 행) 입력 허용 위해 배열 — reconcile 이 단일 행으로 정리. */
  home: HomeCacheRow[];
}

export function createEmptyStore(): DataStore {
  return { photos: [], regions: [], trips: [], home: [] };
}

/** DataActor.deleteAll — 4종 전부 비움(테스트 리셋 + 데이터 초기화). */
export function deleteAll(store: DataStore): void {
  store.photos.length = 0;
  store.regions.length = 0;
  store.trips.length = 0;
  store.home.length = 0;
}

/** DataActor.home() — 첫 HomeCache 행의 좌표(없으면 null). */
export function homeCoordinate(store: DataStore): Coordinate | null {
  const first = store.home[0];
  return first === undefined ? null : { lat: first.lat, lon: first.lon };
}

/** DataActor.pinnedPhotoIDs() — userOverride===true PhotoRef 의 localIdentifier 집합. */
export function pinnedPhotoIDs(store: DataStore): Set<string> {
  const ids = new Set<string>();
  for (const p of store.photos) {
    if (p.userOverride) ids.add(p.localIdentifier);
  }
  return ids;
}

// ── reconcile.ts 가 위임하는 내부 helper (Swift DataActor private) ──────────

/** upsert 1회의 카운트 + 키→객체 dict + touched trips. (save 없음, 내부 전용.) */
export interface UpsertScratch {
  inserted: number;
  updated: number;
  skipped: number;
  regionsWritten: number;
  tripsWritten: number;
  photoByID: Map<string, PhotoRef>;
  regionByCode: Map<string, RegionStatus>;
  tripByID: Map<string, TripRecord>;
  touchedTrips: TripRecord[];
}

/**
 * insert/update만 수행(삭제 없음). 안정 키로 upsert, userOverride 보존. dict/카운트를 scratch 로 반환.
 * Swift DataActor.upsert 1:1 — first-wins 사전(`if (!map.has(k)) map.set(k,v)`), visited-wins 분기 보존.
 */
export function upsert(store: DataStore, result: PipelineResult): UpsertScratch {
  const s: UpsertScratch = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    regionsWritten: 0,
    tripsWritten: 0,
    photoByID: new Map(),
    regionByCode: new Map(),
    tripByID: new Map(),
    touchedTrips: [],
  };

  // --- PhotoRef upsert (key: localIdentifier) ---
  for (const p of store.photos) {
    if (!s.photoByID.has(p.localIdentifier)) s.photoByID.set(p.localIdentifier, p);
  }
  for (const p of result.photos) {
    const existing = s.photoByID.get(p.localIdentifier);
    if (existing !== undefined) {
      if (existing.userOverride) {
        s.skipped += 1;
        continue;
      }
      existing.lat = p.lat;
      existing.lon = p.lon;
      existing.takenAt = p.takenAt;
      existing.localTZoffsetSeconds = p.localTZoffsetSeconds;
      existing.regionCode = p.regionCode;
      existing.tripID = p.tripID;
      existing.sortIndex = p.sortIndex;
      s.updated += 1;
    } else {
      const next: PhotoRef = {
        localIdentifier: p.localIdentifier,
        lat: p.lat,
        lon: p.lon,
        takenAt: p.takenAt,
        localTZoffsetSeconds: p.localTZoffsetSeconds,
        regionCode: p.regionCode,
        tripID: p.tripID,
        sortIndex: p.sortIndex,
        userOverride: false,
      };
      store.photos.push(next);
      s.photoByID.set(p.localIdentifier, next);
      s.inserted += 1;
    }
  }

  // --- RegionStatus upsert (key: regionCode, level=sigungu만) ---
  for (const r of store.regions) {
    if (r.level !== LEVEL_SIGUNGU) continue; // sido 행은 upsert/prune 비후보
    if (!s.regionByCode.has(r.regionCode)) s.regionByCode.set(r.regionCode, r);
  }
  for (const reg of result.regions) {
    const existing = s.regionByCode.get(reg.regionCode);
    if (existing !== undefined) {
      if (existing.userOverride) {
        // visited-wins: 사진 생긴 '가고싶음' 지역만 방문 승격 + override 해제. 그 외 override 는 보존(continue).
        if (existing.state !== VISIT_STATE_WANT_TO_GO) continue;
        existing.userOverride = false;
      }
      existing.state = VISIT_STATE_VISITED;
      existing.photoCount = reg.photoCount;
      existing.firstVisit = reg.firstVisit;
      existing.lastVisit = reg.lastVisit;
      s.regionsWritten += 1;
    } else {
      const next: RegionStatus = {
        regionCode: reg.regionCode,
        level: LEVEL_SIGUNGU,
        state: VISIT_STATE_VISITED,
        photoCount: reg.photoCount,
        firstVisit: reg.firstVisit,
        lastVisit: reg.lastVisit,
        userOverride: false,
      };
      store.regions.push(next);
      s.regionByCode.set(reg.regionCode, next);
      s.regionsWritten += 1;
    }
  }

  // --- TripRecord upsert (key: id) ---
  for (const t of store.trips) {
    if (!s.tripByID.has(t.id)) s.tripByID.set(t.id, t);
  }
  for (const tr of result.trips) {
    const existing = s.tripByID.get(tr.id);
    if (existing !== undefined) {
      s.touchedTrips.push(existing); // append 가 override continue 보다 앞 (T6 이중 계약)
      if (existing.userOverride) continue;
      existing.startAt = tr.startAt;
      existing.endAt = tr.endAt;
      existing.minLat = tr.bbox.minLat;
      existing.minLon = tr.bbox.minLon;
      existing.maxLat = tr.bbox.maxLat;
      existing.maxLon = tr.bbox.maxLon;
      existing.representativeRegionCode = tr.representativeRegionCode;
      s.tripsWritten += 1;
    } else {
      const next: TripRecord = {
        id: tr.id,
        startAt: tr.startAt,
        endAt: tr.endAt,
        minLat: tr.bbox.minLat,
        minLon: tr.bbox.minLon,
        maxLat: tr.bbox.maxLat,
        maxLon: tr.bbox.maxLon,
        representativeRegionCode: tr.representativeRegionCode,
        userOverride: false,
        title: null,
      };
      store.trips.push(next);
      s.tripByID.set(tr.id, next);
      s.touchedTrips.push(next);
      s.tripsWritten += 1;
    }
  }

  return s;
}

/**
 * 결과에 없는 레코드를 삭제(prune). userOverride 는 면제. 삭제 순서: 사진 → 지역 → 여행.
 * 여행은 photo-prune 이후 "생존 사진 미참조"일 때만 삭제(3중 AND). Swift DataActor.prune 1:1.
 */
export function prune(
  store: DataStore,
  result: PipelineResult,
  s: UpsertScratch,
): { deletedPhotos: number; deletedRegions: number; deletedTrips: number } {
  const pIDs = new Set(result.photos.map((p) => p.localIdentifier));
  const rCodes = new Set(result.regions.map((r) => r.regionCode));
  const tIDs = new Set(result.trips.map((t) => t.id));

  // (a) PhotoRef prune + 생존 사진 tripID 집계(단일 패스).
  let deletedPhotos = 0;
  const survivingTripRefs = new Set<string>();
  const photosToDelete = new Set<string>();
  for (const [id, obj] of s.photoByID) {
    if (!pIDs.has(id) && !obj.userOverride) {
      photosToDelete.add(id);
      deletedPhotos += 1;
    } else if (obj.tripID !== null) {
      survivingTripRefs.add(obj.tripID); // override 는 사용자 tripID 유지 (R11)
    }
  }
  if (photosToDelete.size > 0) {
    store.photos = store.photos.filter((p) => !photosToDelete.has(p.localIdentifier));
  }

  // (b) RegionStatus prune (dict 는 sigungu 한정).
  let deletedRegions = 0;
  const regionsToDelete = new Set<string>();
  for (const [code, obj] of s.regionByCode) {
    if (!rCodes.has(code) && !obj.userOverride) {
      regionsToDelete.add(code);
      deletedRegions += 1;
    }
  }
  if (regionsToDelete.size > 0) {
    store.regions = store.regions.filter(
      (r) => !(r.level === LEVEL_SIGUNGU && regionsToDelete.has(r.regionCode)),
    );
  }

  // (c) TripRecord prune — 3중 AND: 부재 ∧ 비override ∧ 생존 사진 미참조.
  let deletedTrips = 0;
  const tripsToDelete = new Set<string>();
  for (const [id, obj] of s.tripByID) {
    if (!tIDs.has(id) && !obj.userOverride && !survivingTripRefs.has(id)) {
      tripsToDelete.add(id);
      deletedTrips += 1;
    }
  }
  if (tripsToDelete.size > 0) {
    store.trips = store.trips.filter((t) => !tripsToDelete.has(t.id));
  }

  return { deletedPhotos, deletedRegions, deletedTrips };
}

/**
 * home 을 result.home 과 동기화. 비-null 이면 단일 행 upsert(여분 정리), null 이면 전체 삭제.
 * 좌표가 바뀌었으면 true 반환(엄밀 float 동치 — 허용오차 금지). Swift syncHomeNoSave 1:1.
 */
export function syncHome(store: DataStore, coord: Coordinate | null): boolean {
  const before = store.home;
  const firstRow = before[0];
  const beforeCoord: Coordinate | null =
    firstRow === undefined ? null : { lat: firstRow.lat, lon: firstRow.lon };

  if (coord !== null) {
    if (firstRow !== undefined) {
      firstRow.lat = coord.lat;
      firstRow.lon = coord.lon;
    } else {
      store.home.push({ lat: coord.lat, lon: coord.lon });
    }
    if (store.home.length > 1) store.home.length = 1; // 단일 행 보장 (첫 행 유지, 나머지 삭제)
  } else {
    store.home.length = 0; // clear-on-null
  }

  return homeChanged(beforeCoord, coord);
}

/** Swift Coordinate Equatable 의 `!=`(엄밀 float 동치) 의미. 둘 다 null=false, 한쪽만 null=true. */
function homeChanged(before: Coordinate | null, next: Coordinate | null): boolean {
  if (before === null && next === null) return false;
  if (before === null || next === null) return true;
  return !(before.lat === next.lat && before.lon === next.lon);
}
