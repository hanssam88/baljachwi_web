# 모듈 카드: dataActorReconcile

**TS 타겟:** src/data/repo.ts + src/data/reconcile.ts (reconcile/upsert/prune/visited-wins/단일행 home만 — merge/split/title/delete 제외)

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
// ============ src/data/repo.ts ============
import type { Coordinate } from "../geo/geoTypes";

/** Swift VisitState(String rawValue) 그대로. */
export type VisitState = "visited" | "wantToGo" | "notVisited";
export type RegionLevel = "sido" | "sigungu";

/** @Model PhotoRef → plain mutable record. 시간은 전부 epoch 초(number). */
export interface PhotoRefRecord {
  localIdentifier: string;
  lat: number;
  lon: number;
  takenAt: number;               // epoch sec (Swift Date.timeIntervalSince1970)
  localTZoffsetSeconds: number;  // 정수
  regionCode: string | null;
  tripID: string | null;        // TripRecordRow.id 약참조 (관계 없음)
  sortIndex: number;             // 정수
  userOverride: boolean;
}

/** @Model RegionStatus → plain mutable record. */
export interface RegionStatusRecord {
  regionCode: string;
  level: RegionLevel;
  state: VisitState;
  photoCount: number;
  firstVisit: number | null;     // epoch sec
  lastVisit: number | null;
  userOverride: boolean;
}

/** @Model TripRecord → plain mutable record. bbox는 4개 number 평탄 저장. */
export interface TripRecordRow {
  id: string;
  startAt: number;               // epoch sec
  endAt: number;
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
  representativeRegionCode: string | null;
  userOverride: boolean;
  title: string | null;          // 본 모듈은 보존만 (설정 = title 기능, 제외 범위)
}

/** @Model HomeCache → 좌표 행. */
export interface HomeCacheRow {
  lat: number;
  lon: number;
}

/** SwiftData ModelContext 대체 — 인메모리 mutable store. 단일 writer 규율은 호출부 책임. */
export interface DataStore {
  photos: PhotoRefRecord[];
  regions: RegionStatusRecord[];
  trips: TripRecordRow[];
  /** 불변식 ≤1행. 외부 폴리션(다중 행) 입력 허용 위해 배열 — reconcile이 단일 행으로 정리. */
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
export function homeCoordinate(store: DataStore): Coordinate | null;

/** DataActor.pinnedPhotoIDs() — userOverride===true PhotoRef의 localIdentifier 집합. */
export function pinnedPhotoIDs(store: DataStore): Set<string>;

// ============ src/data/reconcile.ts ============
import type { PipelineResult } from "../scan/scanPipeline";
import type { DataStore } from "./repo";

/** apply 결과 요약. Swift tripPersistentIDs(PersistentIdentifier[]) → touchedTripIDs(string[])로 대체. */
export interface ApplyResult {
  insertedPhotos: number;
  updatedPhotos: number;
  skippedOverridePhotos: number;
  regionsWritten: number;   // insert+update 합산, override 스킵 제외
  tripsWritten: number;     // insert+update 합산, override 스킵 제외
  /** result.trips 순회 순서대로 touched TripRecord id. override 스킵 trip도 포함(append가 continue보다 앞). */
  touchedTripIDs: string[];
}

export interface ReconcileResult {
  applied: ApplyResult;
  deletedPhotos: number;    // 부재 ∧ 비-override PhotoRef
  deletedRegions: number;   // 부재 ∧ 비-override RegionStatus (sigungu만)
  deletedTrips: number;     // 부재 ∧ 비-override ∧ 생존사진 미참조 TripRecord
  homeChanged: boolean;     // home set/clear/update로 좌표가 바뀌면 true
}

export interface PruneMissingResult {
  removedPhotos: number;    // 제거된 부재 핀 PhotoRef
  recalcedTrips: number;    // 생존자 기준 제자리 recalc된 trip
  deletedTrips: number;     // 생존 0으로 삭제된 trip
}

/** 멱등 upsert(삭제 없음, userOverride 보존). home은 절대 미터치. 부분/증분 입력용. */
export function apply(store: DataStore, result: PipelineResult): ApplyResult;

/** 전체 동기화: upsert + 부재 prune(userOverride 면제, 사진→지역→여행 순) + home 단일행 동기화(clear-on-null).
 *  ⚠ result는 전체 스캔의 완결 출력이어야 함(부분 입력이면 데이터 손실). */
export function reconcile(store: DataStore, result: PipelineResult): ReconcileResult;

/** 가고싶음 토글. on=true: visited 행 보존(no-op)/기존 행 wantToGo+override/부재 시 신규 행(photoCount 0, first/lastVisit null).
 *  on=false: visited 행 보존(삭제 금지)/그 외 행 삭제. level==="sigungu"만 대상. */
export function setWantToGo(store: DataStore, regionCode: string, on: boolean): void;

/** 삭제된 핀 정리: rawAssetIDs(pre-filter 전체 라이브러리 id)에 없는 userOverride PhotoRef 제거 +
 *  영향 trip을 생존자 기준 제자리 recalc(id/title/userOverride 보존, 메트릭 필드만 덮음) 또는 생존 0이면 삭제.
 *  ⚠ 전체(.authorized) 스캔에서만 호출 — 게이트는 호출부 책임. */
export function pruneMissingPins(store: DataStore, rawAssetIDs: ReadonlySet<string>): PruneMissingResult;
```

## 보존 상수 (constants)

- levelSigungu="sigungu"
- levelSido="sido"
- visitStateVisited="visited"
- visitStateWantToGo="wantToGo"
- visitStateNotVisited="notVisited"
- wantToGoNewRowPhotoCount=0
- wantToGoNewRowFirstVisit=null
- wantToGoNewRowLastVisit=null

## 포팅할 테스트 (testsToPort)

### testApplyToEmptyStoreInserts (T1)
basicResult(P1 lat37.5/lon127.0/t100/tz32400/region 11140/trip T1/sort0, P2 t200/sort1; region 11140 count2 first100 last200; trip T1 start100 end200 bbox(37.4,126.9,37.6,127.1) rep 11140; home null)를 빈 store에 apply → insertedPhotos 2, updatedPhotos 0, skipped 0, regionsWritten 1, tripsWritten 1, touchedTripIDs.length 1. store: photos 2 / regions 1 / trips 1. region 행 state=visited, photoCount 2, level sigungu

### testIdempotentReapply (T2)
apply(basicResult) 2회 → 2회차 insertedPhotos 0, updatedPhotos 2. store 카운트 불변 photos 2 / regions 1 / trips 1 (중복 없음)

### testReapplyUpdatesNonOverrideFields (T3)
apply(basic) 후, P1 regionCode 11140→11110으로 바뀐 결과(regions: 11110 count1 first100 last100 + 11140 count1 first200 last200) apply → store의 P1.regionCode === "11110"

### testUserOverridePhotoPreserved (T4)
apply(basic) 후 store 직접 변형: P1.userOverride=true, P1.regionCode="OVERRIDE". P1을 region 11110으로 바꾼 결과 apply → skippedOverridePhotos 1, P1.regionCode "OVERRIDE" 유지, userOverride true 유지

### testNonWantToGoOverrideRegionPreserved (T5)
apply(basic) 후 region 11140 행 직접 변형: userOverride=true, state="notVisited". basic 재적용 → regionsWritten 0(스킵), state "notVisited" 유지, userOverride true 유지 (visited-wins는 wantToGo 한정 — guard 분기 검증)

### testUserOverrideTripPreserved (T6)
apply(basic) 후 trip T1 직접 변형: userOverride=true, representativeRegionCode="MANUAL". basic 재적용 → tripsWritten 0 그리고 touchedTripIDs.length 1(이중 계약: written 제외 + ID 집합 포함). rep "MANUAL" 유지

### testDeleteAllClearsEverything (T7)
apply(basic) → deleteAll → photos 0 / regions 0 / trips 0

### testReturnedTripIDsResolve (T8, 적응)
apply(basic) → touchedTripIDs[0] === "T1" (Swift persistentModelID 교차컨텍스트 resolve를 id 문자열 계약으로 대체)

### testPhotoFieldsPersisted (T9)
apply(basic) 후 photos를 sortIndex asc 정렬 → localIdentifier [P1,P2], tripID [T1,T1], regionCode [11140,11140], 첫 사진 localTZoffsetSeconds 32400

### testApplyWithHomeStillPersistsPhotosButNotHome (T10)
basic+home(37.5,127.0)으로 apply → insertedPhotos 2, store.home.length 0 (apply는 home 미터치)

### testFreshActorReapplyIsIdempotent (T11, 적응)
Swift cold-context 검증 — TS plain store에선 캐시 없음. apply(basic) 후 동일 store에 재호출 → inserted 0, updated 2, 카운트 2/1/1. 회귀용으로 유지

### testReconcileDeletesAbsentNonOverridePhoto (R1)
reconcile(basic) → reconcile(p1Only: P1만 lat37.5/lon126.9/t100, region 11140 count1, trip T1 start100 end100) → deletedPhotos 1(P2). store photos === [P1]

### testReconcileKeepsAbsentOverridePhoto (R2)
reconcile(basic), P2.userOverride=true 직접 설정 → reconcile(p1Only) → deletedPhotos 0, photos 2 (override 부재 보존)

### testReconcileDeletesAbsentNonOverrideRegion (R3)
reconcile(basic) → reconcile(p1Only(region=11110)) → deletedRegions 1(11140 삭제). 남은 regionCode ["11110"]

### testReconcileKeepsAbsentOverrideRegion (R4)
reconcile(basic), 11140 행 직접 변형 userOverride=true/state=wantToGo → reconcile(p1Only(region=11110)) → 11140 행 생존, state wantToGo

### testReconcileDeletesOrphanNonOverrideTrip (R5)
reconcile(basic; T1) → P1,P2를 trip T2로 재배정한 결과(trips=[T2 start100 end200]) reconcile → deletedTrips 1(고아 T1). trips id === [T2]

### testReconcileKeepsAbsentOverrideTrip (R6)
reconcile(basic), T1.userOverride=true 직접 설정 → R5와 동일한 T2 결과 reconcile → deletedTrips 0, trips id 정렬 [T1, T2]

### testReconcileIdempotent (R7)
reconcile(basic) 2회 → 2회차 applied.inserted 0/updated 2, deletedPhotos 0, deletedRegions 0, deletedTrips 0. 카운트 2/1/1

### testReconcileUpsertAndDeleteTogether (R8)
reconcile(basic) → 결과{P1(37.5,126.9,t100,region 11110,T1,sort0), P3(t150,region 11110,T1,sort1); regions [11110 count2 first100 last150]; trips [T1 start100 end150 rep 11110]} reconcile → inserted 1(P3), updated 1(P1), deletedPhotos 1(P2), deletedRegions 1(11140), regionsWritten 1. photos 정렬 [P1,P3], regions [11110]

### testReconcileEmptyResultDeletesAllNonOverride (R9)
reconcile(basic) → reconcile(빈 결과 photos/regions/trips=[], home null) → deletedPhotos 2, deletedRegions 1, deletedTrips 1, inserted 0. store 전부 0

### testReconcileResegmentationNoDangling (R10)
reconcile(basic; T1[P1,P2]) → P1→T2a(sort0)/P2→T2b(sort0), trips [T2a(100,100), T2b(200,200)] reconcile → deletedTrips 1(옛 T1). trips 집합 {T2a,T2b}, 모든 non-null PhotoRef.tripID가 존재 trip id에 포함(dangling 0)

### testReconcileOverridePhotoPinsTrip (R11)
reconcile(basic), P1.userOverride=true(tripID T1 유지) → P1,P2 모두 T2로 분류한 결과(trips=[T2]) reconcile → deletedTrips 0 (T1은 비-override여도 생존 사진 P1이 참조 → 3중 AND 셋째항으로 면제). trips {T1,T2}, P1.tripID==="T1", dangling 0

### testReconcileDoesNotPruneSidoRows (R12)
reconcile(basic; sigungu 11140) 후 store에 직접 insert: {regionCode "11", level "sido", state visited, photoCount 5} → reconcile(p1Only(region=11110)) → sido 행 "11" 보존(prune 후보 아님), sigungu 집합 {"11110"}(11140은 삭제)

### testReconcileFreshActorIdempotent (R13, 적응)
cold-fetch 멱등 — TS에선 동일 store 재호출. reconcile(basic) 2회째: inserted 0/updated 2/deleted 0,0,0. 카운트 2/1/1. 회귀용

### testReconcilePersistsHome (H1)
reconcile(basic+home(37.5,127.0)) → homeChanged true. store.home 1행 lat 37.5 lon 127.0, homeCoordinate() === {lat:37.5, lon:127.0}

### testReconcileUpdatesHome (H2)
home(37.5,127.0) reconcile → home(35.1,129.0) reconcile → homeChanged true, 행 1개 lat 35.1 lon 129.0

### testReconcileSameHomeNoChange (H3)
동일 home(37.5,127.0) reconcile 2회 → 2회차 homeChanged false, 행 1개

### testReconcileNilHomeClears (H4)
home(37.5,127.0) 설정 후 home null 결과 reconcile → homeChanged true, store.home 0행, homeCoordinate() null

### testApplyDoesNotTouchHome (H5)
reconcile(home 37.5,127.0) 후 apply(home 35.1,129.0) → home 그대로 1행 37.5/127.0

### testDeleteAllClearsHome (H6)
reconcile(home 37.5,127.0) → deleteAll → home 0행, homeCoordinate() null

### testReconcileEnforcesSingleHomeRow (H7)
reconcile(basic, home 없음) 후 store.home에 (1.0,1.0),(2.0,2.0) 2행 직접 push(폴리션) → reconcile(home 37.5,127.0) → 행 1개 37.5/127.0 (첫 행 덮고 나머지 삭제)

### testHomeReadableFromFreshActor (H8, 적응)
reconcile(home 37.5,127.0) 후 homeCoordinate(store) === {37.5,127.0}. cold-actor 의미는 TS에서 trivial — 회귀용

### testSetWantToGoCreatesOverrideRow (WT1)
빈 store에 setWantToGo("11140", true) → 행 1개: regionCode 11140, level sigungu, state wantToGo, userOverride true, photoCount 0

### testSetWantToGoOffDeletesRow (WT2)
on → off → regions 0행 (미방문 = 행 부재 불변식)

### testSetWantToGoIdempotent (WT3)
on 2회 → 행 1개, state wantToGo 유지

### testWantToGoUpgradedToVisitedWhenPhotosAppear (WT4)
setWantToGo("11140", true) → reconcile(basic; 11140에 사진 2장) → 11140 행 1개: state visited(승격), userOverride false(해제), photoCount 2 — visited-wins 핵심

### testWantToGoSurvivesReconcileWhenAbsent (WT5)
setWantToGo("26470", true) → reconcile(basic; 26470 부재) → 26470 행 1개 생존, state wantToGo (userOverride prune 면제)

### testPinnedPhotoIDsReturnsOverridePhotos (PIN)
apply(basic) → pinnedPhotoIDs() 빈 집합. P1.userOverride=true 직접 설정 → pinnedPhotoIDs() === {"P1"}

### testSetWantToGoNeverClobbersVisited (WT6)
apply(basic; 11140 visited) → setWantToGo(true): state visited 유지 + userOverride false 유지(클로버 안 함) → setWantToGo(false): 행 1개 유지, state visited(삭제 금지)

### testPartialMissingRecalcsInPlacePreservingFields (P1)
T1에 P1(37.1,127.1,t100)/P2(37.2,127.2,t200)/P3(37.3,127.3,t300) apply 후 핀(직접 변형: trip.userOverride=true, trip.title="내 여행", 멤버 3장 userOverride=true) → pruneMissingPins({P1,P2}) → removedPhotos 1, recalcedTrips 1, deletedTrips 0. trip id [T1] 불변(제자리 recalc), title "내 여행" 보존, userOverride true 보존, startAt 100, endAt 200(300→200 축소), bbox (37.1,127.1,37.2,127.2), photos 집합 {P1,P2}

### testAllMissingDeletesTrip (P2)
P1(t100)/P2(t200) 핀 후 pruneMissingPins(빈 Set) → removedPhotos 2, deletedTrips 1, recalcedTrips 0. trips 0, photos 0

### testNonOverrideMissingUntouched (P3)
P1/P2 apply만(비핀, 전부 userOverride=false) → pruneMissingPins(빈 Set) → removedPhotos 0, deletedTrips 0. trip T1 유지, photos 2 유지 (비-override는 reconcile prune 담당)

### testPresentPinsPreserved (P4)
P1/P2 핀 후 pruneMissingPins({P1,P2}) → removedPhotos 0. title "내 여행" 유지, endAt 200 유지(메트릭 미변), photos 2

### testNoMissingIsNoOp (P5)
P1/P2 핀 후 pruneMissingPins({P1,P2,"extra_unrelated"}) → removedPhotos 0, recalcedTrips 0, deletedTrips 0 (early return 경로)

### testColdActorSeesPinnedData (P6, 적응)
P1(t100)/P2(t200) 핀(title "콜드") → pruneMissingPins({P1}) → removedPhotos 1, recalcedTrips 1. title "콜드" 보존, endAt 100(P1만 생존). cold-actor 의미는 TS에서 trivial

### testIdempotentAcrossConsecutiveRuns (P7)
P1/P2/P3(t100/200/300) 핀 → pruneMissingPins({P1}) 1회차(P2,P3 제거) → 2회차 동일 호출 → removedPhotos 0, recalcedTrips 0, deletedTrips 0. photos [P1]만, title "내 여행" 유지

## 포팅 함정 (notes)

[범위] 포팅 대상: apply(upsert), reconcile(upsert+prune+home 동기화), 내부 prune, syncHome(단일행), setWantToGo(visited-wins 포함), pinnedPhotoIDs, pruneMissingPins, home(), deleteAll(리셋용), ApplyResult/ReconcileResult/PruneMissingResult. 제외: mergeTrips/splitTrip/setTripTitle/deleteTrip과 MergeResult/SplitResult/MergeError/TitleError/DeleteError/SplitError 전부(DataActor.swift 207~418행). DataActorTests의 모든 테스트는 in-scope. DataActorPruneMissingTests의 픽스처 titledPinnedT1은 제외 대상인 setTripTitle로 핀을 만들므로, TS 포트에서는 store 직접 변형(trip.userOverride=true + trip.title 설정 + 멤버 photo.userOverride=true)으로 동등 상태를 만든다.

[함정]
1. persistentModelID는 SwiftData 전용 — ApplyResult.tripPersistentIDs를 touchedTripIDs: string[](TripRecord.id, result.trips 순회 순서)로 대체. override로 upsert 스킵된 trip도 포함해야 함(Swift 코드에서 touchedTrips.append가 userOverride continue보다 먼저 실행 — T6이 이 이중 계약을 고정).
2. Swift Dictionary(uniquingKeysWith: {first,_ in first})는 중복 키 시 첫 행 유지(first-wins). JS Map.set은 last-wins이므로 `if (!map.has(k)) map.set(k, v)`로 재현할 것 (photoByID/regionByCode/tripByID 3곳 + pruneMissingPins의 tripByID).
3. visited-wins 분기 순서 정확히 보존: 기존 행이 userOverride일 때 state==="wantToGo"인 경우에만 userOverride=false로 해제 후 visited 승격+필드 갱신+regionsWritten++; 그 외 override는 continue(카운트 미증가, T5). 비-override 기존 행은 무조건 state=visited 덮어쓰기.
4. prune은 upsert가 만든 사전(photoByID = 기존 store 전체 + 이번에 insert된 신규 행 포함)을 단일 패스 순회: 부재∧비override → 삭제, 그 외(생존)이고 tripID non-null → survivingTripRefs에 수집. override 사진은 upsert 스킵으로 사용자 tripID가 유지된 채 수집됨 → R11의 핵심. trip prune은 3중 AND: !tIDs.has(id) && !userOverride && !survivingTripRefs.has(id). 삭제 순서 사진→지역→여행.
5. regionByCode 사전은 level==="sigungu"만 필터해 구성 → sido 행은 upsert/prune 양쪽 비후보(R12). setWantToGo의 기존 행 조회도 sigungu 한정.
6. syncHome: before=store.home 스냅샷, beforeCoord=첫 행 좌표(없으면 null). coord non-null이면 첫 행에 lat/lon 덮어쓰고 나머지 행 전부 삭제(단일행 보장, H7), null이면 전행 삭제. homeChanged = beforeCoord !== coord 의미의 값 비교: 둘 다 null이면 false, 한쪽만 null이면 true, 둘 다 있으면 lat===lat && lon===lon의 부정(엄밀 float 동치 — Swift Coordinate Equatable과 동일, 허용오차 금지).
7. apply는 home을 절대 건드리지 않음(H5/T10) — reconcile만 동기화.
8. Date → epoch 초 number로 전면 치환. 비교/min/max는 number 산술. JS Date 객체·getHours·타임존 메서드 금지. PipelineRegion.firstVisit/lastVisit는 non-null, RegionStatusRecord에선 null 허용(setWantToGo 신규 행은 null).
9. 옵셔널은 전부 `| null`로 통일(undefined 금지) — regionCode/tripID/representativeRegionCode/title/firstVisit/lastVisit. 동등성 비교 일관성 확보.
10. pruneMissingPins: (1) toDelete = userOverride ∧ !rawAssetIDs.has(id), 비면 {0,0,0} early return(store 무변형, P5). (2) 생존자는 삭제 전 스냅샷(allPhotos)에서 계산 — 삭제 후 재조회 금지(Swift pending-delete 비일관 회피 의미론 유지). (3) trip recalc는 제자리 — id/title/userOverride 보존, startAt/endAt/bbox4필드/representativeRegionCode만 덮음(delete-and-reinsert 금지, P1의 🔴 단언). 생존 0이면 trip 삭제. TripMetrics.compute 의존(tripMetrics 모듈) — 비어있지 않은 입력은 non-null 보장이므로 TS에선 null이면 throw(fail-loud, Swift 강제 unwrap 대응).
11. 정렬: in-scope 로직 내부에 정렬 없음(merge/split의 takenAt/sortIndex tie-break 정렬은 제외 범위). 테스트 검증부의 sortIndex 정렬만 필요. Swift Set/Dictionary 순회 순서는 비결정적이지만 in-scope 산출(카운트·삭제 집합)은 순서 독립 — JS Map/Set 삽입순 순회로 문제 없음.
12. saveOrRollback/cold-context 멱등성(T11/R13/H8/P6)은 SwiftData 트랜잭션·캐시 전용 의미 — plain store에선 자동 충족. 테스트는 회귀용으로 단순화 포팅. in-scope 함수에는 save 전 throw 가드가 없어 롤백 메커니즘 불요.
13. PhotoRefRecord 등 4개 record 인터페이스는 models 모듈 카드와 중복 정의 충돌 가능 — models가 정의하면 repo.ts는 거기서 import(필드 계약은 위 exportsTs 그대로 합의 필요).
14. setWantToGo의 visited 보존은 on/off 양쪽 early return(WT6 — 데이터 손실 차단 blocker였음). off에서 행이 없으면 no-op.