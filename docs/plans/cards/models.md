# 모듈 카드: models

**TS 타겟:** src/data/db.ts 레코드 타입

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
// src/data/db.ts — models: SwiftData @Model → plain TS interface (레코드 타입)
import type { Coordinate, BBox } from "../core/geoTypes";

/** Swift VisitState (VisitState.swift): String RawValue 그대로 보존.
 *  단일 정의 지점 — regionAggregate는 여기서 import (중복 정의 금지). */
export type VisitState = "visited" | "wantToGo" | "notVisited";
export const VISIT_STATES: readonly VisitState[] = ["visited", "wantToGo", "notVisited"];

export type RegionLevel = "sido" | "sigungu";

/** 사진 1장 분석 참조. 두 탭이 공유하는 독립 aggregate root. */
export interface PhotoRef {
  localIdentifier: string;        // dedup 키 (Swift #Unique 미사용 — 파이프라인 수동 dedup)
  lat: number;
  lon: number;
  takenAt: number;                // epoch 초 (Swift Date.timeIntervalSince1970) — ms 아님!
  localTZoffsetSeconds: number;   // 정수 (예: 32400 = +09:00)
  regionCode: string | null;
  tripID: string | null;          // TripRecord.id 약참조 — cascade/nullify 없음
  sortIndex: number;              // 읽기 시 정렬 키
  userOverride: boolean;          // true면 자동 재반영이 덮어쓰지 않음
}

/** 영속 여행 엔티티. tripSegmenter의 순수 값 타입 Trip과 다른 타입 (이름 충돌 주의). */
export interface TripRecord {
  id: string;                     // PhotoRef.tripID 약참조 대상
  startAt: number;                // epoch 초
  endAt: number;                  // epoch 초
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
  representativeRegionCode: string | null;
  userOverride: boolean;          // 수동 병합/분리/이동 시 true → 자동 재세그먼테이션 금지
  title: string | null;           // V3 가산 필드. 제목 설정 = 핀(userOverride)
}

/** 한 지역(시도/시군구)의 방문 상태 집계. 지역지도 색칠 소스. */
export interface RegionStatus {
  regionCode: string;             // 식별자 (수동 dedup)
  level: RegionLevel;
  state: VisitState;
  photoCount: number;
  firstVisit: number | null;      // epoch 초
  lastVisit: number | null;       // epoch 초
  userOverride: boolean;          // 가고싶음 수동 지정 등 → 자동 재집계 금지
}

/** 영속 home 좌표. store에 단일 행(≤1). 로그·외부전송 절대 금지. */
export interface HomeCache {
  id: typeof HOME_CACHE_ROW_ID;   // 고정 PK=1 (단일행 불변을 스키마로 자연화)
  lat: number;
  lon: number;
}
export const HOME_CACHE_ROW_ID = 1;

// ---- Swift 계산 프로퍼티 → 순수 함수 (IndexedDB 왕복은 prototype/getter를 제거하므로 클래스 금지) ----
export function photoRefCoordinate(p: Pick<PhotoRef, "lat" | "lon">): Coordinate {
  return { lat: p.lat, lon: p.lon };
}
export function tripRecordBBox(t: Pick<TripRecord, "minLat" | "minLon" | "maxLat" | "maxLon">): BBox {
  return { minLat: t.minLat, minLon: t.minLon, maxLat: t.maxLat, maxLon: t.maxLon };
}
export function homeCacheCoordinate(h: Pick<HomeCache, "lat" | "lon">): Coordinate {
  return { lat: h.lat, lon: h.lon };
}

// ---- Swift init 기본값 보존 팩토리 ----
export function makePhotoRef(args: {
  localIdentifier: string; lat: number; lon: number;
  takenAt: number; localTZoffsetSeconds: number;
  regionCode?: string | null; tripID?: string | null;
  sortIndex?: number; userOverride?: boolean;
}): PhotoRef; // 기본: regionCode=null, tripID=null, sortIndex=0, userOverride=false

export function makeTripRecord(args: {
  id: string; startAt: number; endAt: number;
  minLat: number; minLon: number; maxLat: number; maxLon: number;
  representativeRegionCode?: string | null; userOverride?: boolean; title?: string | null;
}): TripRecord; // 기본: representativeRegionCode=null, userOverride=false, title=null

export function makeRegionStatus(args: {
  regionCode: string; level: RegionLevel;
  state?: VisitState; photoCount?: number;
  firstVisit?: number | null; lastVisit?: number | null; userOverride?: boolean;
}): RegionStatus; // 기본: state="notVisited", photoCount=0, firstVisit=null, lastVisit=null, userOverride=false

// ---- BaljachwiSchema 대응: DB 경계 (Dexie 가정) ----
// 테이블 4개. SwiftData 자동 경량 마이그레이션 이력(V1→V3 가산)은 TS 신규 스키마와 무관 — version(1)에 전 필드 포함.
//   photoRefs:      PK localIdentifier, index [tripID, sortIndex] (tripID equals 쿼리 + sortIndex 정렬용)
//   tripRecords:    PK id
//   regionStatuses: PK regionCode, index level
//   homeCache:      PK id (단일행, 항상 id=1 upsert)
export declare class BaljachwiDB /* extends Dexie */ {
  photoRefs: /* Table<PhotoRef, string> */ unknown;
  tripRecords: /* Table<TripRecord, string> */ unknown;
  regionStatuses: /* Table<RegionStatus, string> */ unknown;
  homeCache: /* Table<HomeCache, number> */ unknown;
  constructor(name?: string); // 테스트는 fake-indexeddb로 인메모리 (inMemoryContainer 대응)
}
```

## 보존 상수 (constants)

- VisitState.visited="visited"
- VisitState.wantToGo="wantToGo"
- VisitState.notVisited="notVisited"
- RegionLevel.sido="sido"
- RegionLevel.sigungu="sigungu"
- PhotoRef.sortIndex 기본값=0
- PhotoRef.userOverride 기본값=false
- PhotoRef.regionCode 기본값=null
- PhotoRef.tripID 기본값=null
- TripRecord.representativeRegionCode 기본값=null
- TripRecord.userOverride 기본값=false
- TripRecord.title 기본값=null
- RegionStatus.state 기본값="notVisited"
- RegionStatus.photoCount 기본값=0
- RegionStatus.firstVisit/lastVisit 기본값=null
- RegionStatus.userOverride 기본값=false
- HOME_CACHE_ROW_ID=1 (TS 포팅 결정: 단일행 고정 PK — Swift엔 없음, DataActor가 단일행 불변 보장)

## 포팅할 테스트 (testsToPort)

### visitStateRawValueAndCases
VisitState 'visited'의 직렬화 값이 정확히 문자열 "visited"; 문자열 "wantToGo"에서 역직렬화 시 wantToGo; 전체 케이스 집합 = {visited, wantToGo, notVisited} 정확히 3개 (VISIT_STATES 배열로 검증)

### photoRefCoordinateComputed
makePhotoRef({localIdentifier:"A", lat:37.5, lon:127.0, takenAt:0, localTZoffsetSeconds:32400}) → photoRefCoordinate(p) deep-equals {lat:37.5, lon:127.0}; p.userOverride === false (기본값)

### photoRefInsertAndFetch
DB에 PhotoRef{localIdentifier:"A", lat:37.5, lon:127.0, takenAt:10, localTZoffsetSeconds:32400} 1건 insert 후 전체 fetch → count 1, first.localIdentifier === "A"

### regionStatusVisitStatePersists
RegionStatus{regionCode:"11140", level:"sigungu", state:"visited", photoCount:3} insert→save→fetch 왕복 후 count 1, state === "visited" (문자열 영속), photoCount === 3

### tripRecordBBoxComputed
makeTripRecord({id:"T1", startAt:0, endAt:100, minLat:35.0, minLon:129.0, maxLat:35.2, maxLon:129.2}) → tripRecordBBox(t) deep-equals {minLat:35.0, minLon:129.0, maxLat:35.2, maxLon:129.2}

### deletingTripRecordPreservesPhotoRefs
TripRecord{id:"T1", startAt:0, endAt:100, bbox 0,0,1,1} + PhotoRef{localIdentifier:"P1", lat:0.5, lon:0.5, takenAt:10, tz:32400, tripID:"T1"} 저장 → TripRecord만 삭제 → trips count 0, photos count 1 (cascade 없음), photo.tripID === "T1" 유지 (약참조 — 자동 nullify 없음, 파이프라인이 명시 정리)

### photoRefsSortedBySortIndex
의도적 역순 삽입: ("c",sortIndex 2), ("a",0), ("b",1) 모두 tripID "T1", lat/lon/takenAt/tz 전부 0 → tripID==="T1" 쿼리 + sortIndex 오름차순 정렬 → localIdentifier 순서 정확히 ["a","b","c"]

### userOverrideSettable
PhotoRef{localIdentifier:"A", lat:0, lon:0, takenAt:0, tz:0, userOverride:true} 저장→fetch 왕복 후 userOverride === true (boolean 영속)

## 포팅 함정 (notes)

[VisitState 정의 위치] Swift에선 VisitState.swift 별도 파일이며 RegionStatus(models)와 RegionAggregate(regionAggregate)가 공유한다. 이 카드가 models에서 단일 정의로 export하므로 regionAggregate는 models에서 import해야 함 — 두 모듈에 중복 정의 금지. [Date→epoch 초] 모든 Date 필드(takenAt/startAt/endAt/firstVisit/lastVisit)는 epoch '초' number. 테스트 픽스처 Date(timeIntervalSince1970: N) = N초 그대로. JS Date.now()는 ms이므로 혼용 금지 — 이 모듈에선 Date 객체 자체를 쓰지 말 것. [옵셔널] Swift Optional → `| null` 고정 (undefined 금지: IndexedDB structured clone과 인덱스 동작이 null/undefined에서 다름. tripID가 null인 행은 tripID 인덱스에서 빠지지만 equals('T1') 쿼리엔 영향 없음). [@Model→interface] 계산 프로퍼티(coordinate/bbox)는 클래스 getter가 아닌 순수 함수로 — IndexedDB 왕복 후 객체는 plain object라 getter가 사라짐. 동등성 비교는 필드별(vitest toEqual), 참조 비교 금지. [#Unique 미사용] Swift는 dedup을 파이프라인이 수동 통제. Dexie에서 localIdentifier/regionCode/id를 PK로 쓰면 put()이 자동 upsert가 되어 의미가 약간 강해지지만 dataActorReconcile의 upsert 의미와 일치하므로 허용 — 단 add()(중복 시 throw)와 put() 구분에 주의. [cascade/nullify 금지] TripRecord 삭제 시 PhotoRef 보존 + tripID 유지는 TS에선 관계 기계가 없어 자동 성립하지만, 계약 고정용으로 테스트를 반드시 포팅(파이프라인이 명시적으로 정리한다는 전제). [정렬] sortIndex는 숫자 비교 (a,b)=>a.sortIndex-b.sortIndex — 문자열 비교 금지(10<9 버그). Array.sort는 ES2019+ 안정 정렬이라 동률 시 삽입 순서 보존(SortDescriptor와 동일). Dexie 인덱스 orderBy도 가능. [HomeCache] 단일행 불변은 Swift에선 스키마가 아니라 DataActor(sole writer)가 보장 — TS는 고정 PK id=1 upsert로 자연화(HOME_CACHE_ROW_ID=1은 포팅 결정 사항). 집 좌표는 민감정보: 로그/외부전송 금지 주석 유지. [테스트 격리] ModelTests는 컨테이너 1개 공유 + 테스트마다 전체 삭제 패턴 — TS도 DB 1개 공유 + beforeEach에서 4개 table.clear()로 동일하게. [BBox 출처] Swift에선 BBox가 TripSegmenter.swift에 정의되어 있으나 TS에선 합의대로 geoTypes에서 import. [dataActorReconcile 범위] dataActorReconcile 모듈은 reconcile/upsert/prune/visited-wins/단일행 home에 해당하는 로직과 테스트만 포팅 대상으로 추리고 merge/split/title/delete는 제외한다 — 이 models 레코드 타입들이 그 부분집합의 계약 기반(특히 userOverride/visited-wins는 RegionStatus.state·userOverride 필드, 단일행 home은 HomeCache+HOME_CACHE_ROW_ID에 의존).