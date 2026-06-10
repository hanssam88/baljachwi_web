// src/data/models.ts — Swift BaljachwiCore 의 @Model 타입들의 byte-faithful 포트.
//
// 설계(전역 규칙 + models 카드 오버라이드 표):
//  - SwiftData @Model(클래스) → plain TS interface. 계산 프로퍼티는 클래스 getter가 아니라
//    순수 함수로 — IndexedDB 왕복 후 객체는 prototype/getter 없는 plain object 이기 때문.
//  - Dexie 스키마/Table 정의는 db.ts 로 분리(이 파일은 타입+팩토리+순수함수만).
//  - VisitState 의 단일 정의 지점은 core/visitState.ts — 여기서는 re-export 만(중복 정의 금지).
//  - Swift Date(epoch) 필드는 전부 epoch '초' number 정수. JS Date 객체/타임존 메서드 금지.
//  - Swift Optional → `| null` (undefined 금지: IndexedDB structured clone/인덱스 동작 차이).

import type { Coordinate, BBox } from '@/core/geoTypes';
import { VISIT_STATE_ALL_CASES, type VisitState, type RegionLevel } from '@/core/visitState';

// ── VisitState/RegionLevel: core/visitState 의 단일 정의를 re-export (중복 정의 금지) ──
export type { VisitState, RegionLevel };
/** Swift VisitState.allCases 대응. core 의 VISIT_STATE_ALL_CASES 를 그대로 재공개.
 *  선언 순서 보존: visited, wantToGo, notVisited. */
export const VISIT_STATES: readonly VisitState[] = VISIT_STATE_ALL_CASES;

// ── 레코드 타입 (SwiftData @Model → interface) ──────────────────────

/** 사진 1장 분석 참조. 두 탭(지역지도·경로지도)이 공유하는 독립 aggregate root. */
export interface PhotoRef {
  localIdentifier: string; // dedup 키 (Swift #Unique 미사용 — 파이프라인 수동 dedup)
  lat: number;
  lon: number;
  takenAt: number; // epoch 초 (Swift Date.timeIntervalSince1970) — ms 아님!
  localTZoffsetSeconds: number; // 정수 (예: 32400 = +09:00)
  regionCode: string | null;
  tripID: string | null; // TripRecord.id 약참조 — cascade/nullify 없음
  sortIndex: number; // 읽기 시 정렬 키
  userOverride: boolean; // true면 자동 재반영이 덮어쓰지 않음
}

/** 영속 여행 엔티티. tripSegmenter 의 순수 값 타입 Trip 과 다른 타입(이름 충돌 주의). */
export interface TripRecord {
  id: string; // PhotoRef.tripID 약참조 대상
  startAt: number; // epoch 초
  endAt: number; // epoch 초
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
  representativeRegionCode: string | null;
  userOverride: boolean; // 수동 병합/분리/이동 시 true → 자동 재세그먼테이션 금지
  title: string | null; // V3 가산 필드. 제목 설정 = 핀(userOverride)
}

/** 한 지역(시도/시군구)의 방문 상태 집계. 지역지도 색칠 소스. */
export interface RegionStatus {
  regionCode: string; // 식별자 (수동 dedup)
  level: RegionLevel;
  state: VisitState;
  photoCount: number;
  firstVisit: number | null; // epoch 초
  lastVisit: number | null; // epoch 초
  userOverride: boolean; // 가고싶음 수동 지정 등 → 자동 재집계 금지
}

/** 영속 home 좌표. store 에 단일 행(≤1). 로그·외부전송 절대 금지(민감정보). */
export interface HomeCache {
  id: typeof HOME_CACHE_ROW_ID; // 고정 PK=1 (단일행 불변을 스키마로 자연화)
  lat: number;
  lon: number;
}
/** HomeCache 단일행 고정 PK. Swift 엔 없고 DataActor 가 단일행 불변 보장 → TS 포팅 결정. */
export const HOME_CACHE_ROW_ID = 1;

// ── Swift 계산 프로퍼티 → 순수 함수 ────────────────────────────────
// (IndexedDB 왕복은 prototype/getter 를 제거하므로 클래스 getter 금지.)

export function photoRefCoordinate(p: Pick<PhotoRef, 'lat' | 'lon'>): Coordinate {
  return { lat: p.lat, lon: p.lon };
}

export function tripRecordBBox(
  t: Pick<TripRecord, 'minLat' | 'minLon' | 'maxLat' | 'maxLon'>,
): BBox {
  return { minLat: t.minLat, minLon: t.minLon, maxLat: t.maxLat, maxLon: t.maxLon };
}

export function homeCacheCoordinate(h: Pick<HomeCache, 'lat' | 'lon'>): Coordinate {
  return { lat: h.lat, lon: h.lon };
}

// ── Swift init 기본값 보존 팩토리 ──────────────────────────────────

export function makePhotoRef(args: {
  localIdentifier: string;
  lat: number;
  lon: number;
  takenAt: number;
  localTZoffsetSeconds: number;
  regionCode?: string | null;
  tripID?: string | null;
  sortIndex?: number;
  userOverride?: boolean;
}): PhotoRef {
  return {
    localIdentifier: args.localIdentifier,
    lat: args.lat,
    lon: args.lon,
    takenAt: args.takenAt,
    localTZoffsetSeconds: args.localTZoffsetSeconds,
    regionCode: args.regionCode ?? null,
    tripID: args.tripID ?? null,
    sortIndex: args.sortIndex ?? 0,
    userOverride: args.userOverride ?? false,
  };
}

export function makeTripRecord(args: {
  id: string;
  startAt: number;
  endAt: number;
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
  representativeRegionCode?: string | null;
  userOverride?: boolean;
  title?: string | null;
}): TripRecord {
  return {
    id: args.id,
    startAt: args.startAt,
    endAt: args.endAt,
    minLat: args.minLat,
    minLon: args.minLon,
    maxLat: args.maxLat,
    maxLon: args.maxLon,
    representativeRegionCode: args.representativeRegionCode ?? null,
    userOverride: args.userOverride ?? false,
    title: args.title ?? null,
  };
}

export function makeRegionStatus(args: {
  regionCode: string;
  level: RegionLevel;
  state?: VisitState;
  photoCount?: number;
  firstVisit?: number | null;
  lastVisit?: number | null;
  userOverride?: boolean;
}): RegionStatus {
  return {
    regionCode: args.regionCode,
    level: args.level,
    state: args.state ?? 'notVisited',
    photoCount: args.photoCount ?? 0,
    firstVisit: args.firstVisit ?? null,
    lastVisit: args.lastVisit ?? null,
    userOverride: args.userOverride ?? false,
  };
}
