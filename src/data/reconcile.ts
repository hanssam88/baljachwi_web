// src/data/reconcile.ts — Swift BaljachwiCore/DataActor.swift 의 공개 영속 API 포트.
//
// 범위: apply(upsert) / reconcile(upsert+prune+home 동기화) / setWantToGo(visited-wins) /
//       pruneMissingPins(삭제 핀 정리, 제자리 recalc). merge/split/title/delete 제외.
//
//  - 순수 인메모리 DataStore 만(Dexie/IO 없음 — repo.ts 담당).
//  - 시간은 epoch 초 number 정수 산술만. Swift Optional → `| null`.

import type { PipelineResult } from '@/core/scanPipeline';
import { computeTripMetrics, type TripMetricsInput } from '@/core/tripMetrics';
import type { TripRecord } from '@/data/models';
import {
  upsert,
  prune,
  syncHome,
  type DataStore,
} from '@/data/storeOps';

const LEVEL_SIGUNGU = 'sigungu' as const;
const VISIT_STATE_VISITED = 'visited' as const;
const VISIT_STATE_WANT_TO_GO = 'wantToGo' as const;
const WANT_TO_GO_NEW_ROW_PHOTO_COUNT = 0;
const WANT_TO_GO_NEW_ROW_FIRST_VISIT = null;
const WANT_TO_GO_NEW_ROW_LAST_VISIT = null;

// ── Result 타입 ──────────────────────────────────────────────────

/** apply 결과 요약. Swift tripPersistentIDs → touchedTripIDs(string[])로 대체. */
export interface ApplyResult {
  insertedPhotos: number;
  updatedPhotos: number;
  skippedOverridePhotos: number;
  /** insert+update 합산, override 스킵 제외. */
  regionsWritten: number;
  /** insert+update 합산, override 스킵 제외. */
  tripsWritten: number;
  /** result.trips 순회 순서대로 touched TripRecord id. override 스킵 trip 도 포함. */
  touchedTripIDs: string[];
}

export interface ReconcileResult {
  applied: ApplyResult;
  /** 부재 ∧ 비-override PhotoRef. */
  deletedPhotos: number;
  /** 부재 ∧ 비-override RegionStatus (sigungu만). */
  deletedRegions: number;
  /** 부재 ∧ 비-override ∧ 생존사진 미참조 TripRecord. */
  deletedTrips: number;
  /** home set/clear/update 로 좌표가 바뀌면 true. */
  homeChanged: boolean;
}

export interface PruneMissingResult {
  /** 제거된 부재 핀 PhotoRef. */
  removedPhotos: number;
  /** 생존자 기준 제자리 recalc 된 trip. */
  recalcedTrips: number;
  /** 생존 0으로 삭제된 trip. */
  deletedTrips: number;
}

// ── 공개 API ─────────────────────────────────────────────────────

/** 멱등 upsert(삭제 없음, userOverride 보존). home 은 절대 미터치. 부분/증분 입력용. */
export function apply(store: DataStore, result: PipelineResult): ApplyResult {
  const s = upsert(store, result);
  return applyResult(s.inserted, s.updated, s.skipped, s.regionsWritten, s.tripsWritten, s.touchedTrips);
}

/**
 * 전체 동기화: upsert + 부재 prune(userOverride 면제, 사진→지역→여행 순) + home 단일행 동기화(clear-on-null).
 * ⚠ result 는 전체 스캔의 완결 출력이어야 함(부분 입력이면 데이터 손실).
 */
export function reconcile(store: DataStore, result: PipelineResult): ReconcileResult {
  const s = upsert(store, result);
  const { deletedPhotos, deletedRegions, deletedTrips } = prune(store, result, s);
  const homeChanged = syncHome(store, result.home);
  return {
    applied: applyResult(s.inserted, s.updated, s.skipped, s.regionsWritten, s.tripsWritten, s.touchedTrips),
    deletedPhotos,
    deletedRegions,
    deletedTrips,
    homeChanged,
  };
}

/**
 * 가고싶음 토글. level==="sigungu"만 대상.
 *  - on=true: visited 행 보존(no-op) / 기존 행 wantToGo+override / 부재 시 신규 행(photoCount 0, first/last null).
 *  - on=false: visited 행 보존(삭제 금지) / 그 외 행 삭제.
 */
export function setWantToGo(store: DataStore, regionCode: string, on: boolean): void {
  const existing = store.regions.find(
    (r) => r.regionCode === regionCode && r.level === LEVEL_SIGUNGU,
  );
  if (on) {
    if (existing !== undefined) {
      if (existing.state === VISIT_STATE_VISITED) return; // 방문 행 보존
      existing.state = VISIT_STATE_WANT_TO_GO;
      existing.userOverride = true;
    } else {
      store.regions.push({
        regionCode,
        level: LEVEL_SIGUNGU,
        state: VISIT_STATE_WANT_TO_GO,
        photoCount: WANT_TO_GO_NEW_ROW_PHOTO_COUNT,
        firstVisit: WANT_TO_GO_NEW_ROW_FIRST_VISIT,
        lastVisit: WANT_TO_GO_NEW_ROW_LAST_VISIT,
        userOverride: true,
      });
    }
  } else if (existing !== undefined) {
    if (existing.state === VISIT_STATE_VISITED) return; // 방문 행 삭제 금지(데이터 손실)
    const idx = store.regions.indexOf(existing);
    store.regions.splice(idx, 1);
  }
}

/**
 * 삭제된 핀 정리: rawAssetIDs(pre-filter 전체 라이브러리 id)에 없는 userOverride PhotoRef 제거 +
 * 영향 trip 을 생존자 기준 제자리 recalc(id/title/userOverride 보존, 메트릭 필드만 덮음) 또는 생존 0이면 삭제.
 * ⚠ 전체(.authorized) 스캔에서만 호출 — 게이트는 호출부 책임. Swift pruneMissingPins 1:1.
 */
export function pruneMissingPins(
  store: DataStore,
  rawAssetIDs: ReadonlySet<string>,
): PruneMissingResult {
  const allPhotos = store.photos;

  // (1) 삭제 대상 = userOverride ∧ 라이브러리 부재. 영향 tripID 수집.
  const toDelete: string[] = [];
  const affectedTripIDs = new Set<string>();
  for (const p of allPhotos) {
    if (p.userOverride && !rawAssetIDs.has(p.localIdentifier)) {
      toDelete.push(p.localIdentifier);
      if (p.tripID !== null) affectedTripIDs.add(p.tripID);
    }
  }
  if (toDelete.length === 0) {
    return { removedPhotos: 0, recalcedTrips: 0, deletedTrips: 0 }; // early return — store 무변형
  }

  // (2) 생존자 = 영향 trip 소속 ∧ 삭제대상 아님 — pre-deletion 스냅샷(allPhotos)에서 계산.
  const toDeleteIDs = new Set(toDelete);
  const survivorsByTrip = new Map<string, TripMetricsInput[]>();
  for (const p of allPhotos) {
    if (p.tripID === null || !affectedTripIDs.has(p.tripID) || toDeleteIDs.has(p.localIdentifier)) {
      continue;
    }
    const list = survivorsByTrip.get(p.tripID);
    const input: TripMetricsInput = { lat: p.lat, lon: p.lon, takenAt: p.takenAt, regionCode: p.regionCode };
    if (list !== undefined) list.push(input);
    else survivorsByTrip.set(p.tripID, [input]);
  }

  // (3) 부재 핀 삭제.
  store.photos = store.photos.filter((p) => !toDeleteIDs.has(p.localIdentifier));

  // (4) 영향 trip: 생존 0이면 삭제, 아니면 제자리 recalc(id/title/userOverride 보존, 메트릭 필드만).
  const tripByID = new Map<string, TripRecord>();
  for (const t of store.trips) {
    if (!tripByID.has(t.id)) tripByID.set(t.id, t); // first-wins
  }
  let recalced = 0;
  let deletedTrips = 0;
  const tripsToDelete = new Set<string>();
  for (const tid of affectedTripIDs) {
    const trip = tripByID.get(tid);
    if (trip === undefined) continue;
    const survivors = survivorsByTrip.get(tid) ?? [];
    if (survivors.length === 0) {
      tripsToDelete.add(tid);
      deletedTrips += 1;
    } else {
      const m = computeTripMetrics(survivors);
      if (m === null) {
        // survivors 비어있지 않음 → non-null 보장. fail-loud(Swift 강제 unwrap 대응).
        throw new Error('pruneMissingPins: computeTripMetrics returned null for non-empty survivors');
      }
      trip.startAt = m.startAt;
      trip.endAt = m.endAt;
      trip.minLat = m.bbox.minLat;
      trip.minLon = m.bbox.minLon;
      trip.maxLat = m.bbox.maxLat;
      trip.maxLon = m.bbox.maxLon;
      trip.representativeRegionCode = m.representativeRegionCode;
      recalced += 1;
    }
  }
  if (tripsToDelete.size > 0) {
    store.trips = store.trips.filter((t) => !tripsToDelete.has(t.id));
  }

  return { removedPhotos: toDelete.length, recalcedTrips: recalced, deletedTrips };
}

// ── 내부 ─────────────────────────────────────────────────────────

function applyResult(
  inserted: number,
  updated: number,
  skipped: number,
  regionsWritten: number,
  tripsWritten: number,
  touchedTrips: TripRecord[],
): ApplyResult {
  return {
    insertedPhotos: inserted,
    updatedPhotos: updated,
    skippedOverridePhotos: skipped,
    regionsWritten,
    tripsWritten,
    touchedTripIDs: touchedTrips.map((t) => t.id),
  };
}
