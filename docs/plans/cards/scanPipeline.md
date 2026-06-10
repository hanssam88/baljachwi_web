# 모듈 카드: scanPipeline

**TS 타겟:** src/core/scanPipeline.ts

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
```ts
// src/core/scanPipeline.ts
import type { Coordinate, BBox } from "./geoTypes";
import type { ScannedPhoto } from "./photoScanFilter";   // { localIdentifier: string; lat: number; lon: number; takenAt: number /* epoch초 */ }
import type { RegionMatcher } from "./regionMatcher";     // matcher.regionCode(coord: Coordinate): string | null
import type { TZConfig } from "./photoTime";              // tzOffset(coord, exifOffsetSeconds, deviceOffsetSeconds, config)
import type { SegmentConfig } from "./tripSegmenter";     // segment(samples, config, excludedTripSampleIDs)

/** 파이프라인 처리 후 사진 1장. 입력 ScannedPhoto + 파생정보(타임존/지역/여행). */
export interface PipelinePhoto {
  localIdentifier: string;
  lat: number;
  lon: number;
  /** epoch 초 (Swift Date → number) */
  takenAt: number;
  /** 현지 타임존 오프셋(초, UTC 동쪽 양수) */
  localTZoffsetSeconds: number;
  /** MOIS SIG_CD. 매칭 실패(해외/바다) 시 null */
  regionCode: string | null;
  /** 소속 여행 id. 어느 여행에도 속하지 않으면 null */
  tripID: string | null;
  /** 소속 여행 내 takenAt 오름차순 인덱스(0,1,2...). 여행 없으면 0 */
  sortIndex: number;
}

/** 지역 단위 방문 집계. regionCode가 null인 사진(해외)은 집계 제외. */
export interface PipelineRegion {
  regionCode: string;
  photoCount: number;
  firstVisit: number; // epoch 초
  lastVisit: number;  // epoch 초
}

/** 여행 1개. TripSegmenter Trip + 결정적 id + 대표 지역코드. */
export interface PipelineTrip {
  /** 결정적 id: `${Math.trunc(startAt)}_${sampleIDs[0] ?? ""}` */
  id: string;
  /** 소속 사진 id(takenAt 오름차순, 동률 시 id 안정정렬 — tripSegmenter가 보장) */
  sampleIDs: string[];
  startAt: number; // epoch 초
  endAt: number;   // epoch 초
  bbox: BBox;
  /** 여행 사진 regionCode 최빈값(동률 시 regionCode 오름차순 최소; 전부 null이면 null) — tripMetrics.representativeRegionCode 위임 */
  representativeRegionCode: string | null;
}

/** 파이프라인 전체 결과. */
export interface PipelineResult {
  photos: PipelinePhoto[];   // 입력 순서 보존
  regions: PipelineRegion[]; // regionCode 오름차순
  trips: PipelineTrip[];     // startAt 오름차순, 동률 시 id 오름차순
  home: Coordinate | null;   // SegmentResult.home 그대로
}

/**
 * 스캔 결과 통합 처리(순수·결정적). Swift ScanPipeline.build 1:1.
 * excludedTripSampleIDs: 핀된 사진 id — 트립 세그먼테이션에서만 제외.
 * photos/regions/home은 전체 스캔 기준 유지. 기본 빈 Set.
 */
export function buildScanPipeline(
  scanned: readonly ScannedPhoto[],
  matcher: RegionMatcher,
  deviceOffsetSeconds: number,
  segmentConfig?: SegmentConfig,              // 미지정 시 tripSegmenter 기본 SegmentConfig()
  tzConfig?: TZConfig,                        // 미지정 시 photoTime 기본 TZConfig()
  excludedTripSampleIDs?: ReadonlySet<string> // 기본 new Set()
): PipelineResult;
```
```

## 보존 상수 (constants)

- tripIDFormat=`${Math.trunc(trip.startAt)}_${trip.sampleIDs[0] ?? ""}` (Int(Double) 절삭)
- sortIndexWithoutTrip=0
- exifOffsetSeconds=null (MVP 스캔은 EXIF 오프셋 없음 — tzOffset 호출 시 항상 null)
- excludedTripSampleIDsDefault=빈 Set
- (테스트) deviceKST=32400
- (테스트) baseEpoch=1704067200 (2024-01-01T00:00:00Z)
- (테스트 골든좌표) seoulCityHall=(37.5663,126.9779)→"11140"
- (테스트 골든좌표) gwanghwamun=(37.5759,126.9769)→"11110"
- (테스트 골든좌표) busanStation=(35.1151,129.0413)→"26170"
- (테스트 골든좌표) jejuAirport=(33.5070,126.4927)→"50110"
- (테스트 골든좌표) paris=(48.8566,2.3522)→null

## 포팅할 테스트 (testsToPort)

### testSeoulRegionAggregation
입력: seoulCityHall(37.5663,126.9779) 사진 5장 s1..s5, epoch=base+{0,1,2,3,5}*3600 (base=1704067200), deviceOffset=32400. 기대: photos.length=5, 전원 regionCode="11140"; regions의 "11140" 항목 photoCount=5, firstVisit=1704067200, lastVisit=1704067200+18000=1704085200.

### testOverseasPhotoExcludedFromRegions
입력: paris(48.8566,2.3522) 2장 p1@base, p2@base+7200, deviceOffset=32400. 기대: 전원 regionCode=null, regions=[] (해외 사진은 집계 제외).

### testBusanTripWithSeoulHome
입력: 서울 home — d=0..2에 대해 nightEpoch=base+14*3600+d*86400(KST 23:00)에 h{d}a, +1800에 h{d}b (seoulCityHall, 6장). 부산 trip — tripDay=base+4*86400에 b1..b4 (busanStation), epoch=tripDay+{0,1,2,5}*3600. deviceOffset=32400. 기대: home!=null; trips.length=1; trip.representativeRegionCode="26170"; trip.sampleIDs=["b1","b2","b3","b4"]; b_i 사진의 tripID=trip.id, sortIndex=i(0..3); h* 사진 6장 전부 tripID=null, sortIndex=0.

### testTripIDDeterminism
입력: busanStation 4장 d1..d4, epoch=base+{0,1,2,5}*3600, deviceOffset=32400. build 2회. 기대: trips 비어있지 않음; r1.trips.map(id)===r2.trips.map(id); trips[0].id === `${Math.trunc(startAt)}_${sampleIDs[0]}` (= "1704067200_d1").

### testInputOrderPreservedAndRegionsSorted
입력: x1=busanStation@base+10h, x2=seoulCityHall@base+0h, x3=jejuAirport@base+5h (일부러 시간 역순 입력). 기대: photos.map(localIdentifier)=["x1","x2","x3"] (입력 순서 보존); regions.map(regionCode)=["11140","26170","50110"] (오름차순).

### testRepresentativeRegionCodeTieBreak
입력: t1=seoulCityHall@base(11140), t2=gwanghwamun@base+2h(11110), t3=seoulCityHall@base+4h(11140), t4=gwanghwamun@base+6h(11110). gap<8h·이동<40km·야간 없음→home null→단일 trip. 기대: trips.length=1; representativeRegionCode="11110" (2:2 동률→regionCode 오름차순 최소).

### testKoreaCoordinateGetsKST
입력: k1=seoulCityHall@base, deviceOffsetSeconds=0 (일부러 UTC). 기대: photos[0].localTZoffsetSeconds=32400 (한국 bbox 좌표는 deviceOffset 무관 KST).

### testExcludedTripSampleIDsKeepRegionsPhotosHome
입력: testBusanTripWithSeoulHome과 동일 픽스처(h0a..h2b 6장 + b1..b4 4장), excludedTripSampleIDs={"b1","b2","b3","b4"}. 기대: trips=[] (핀 제외→유령 trip 없음); home!=null (전체 스캔 기준 유지); photos.length=10 (핀 포함 전체); regions에 "26170" 존재 (부산 집계 유지).

## 포팅 함정 (notes)

[포팅 함정]
1) Date→epoch초 number: 모든 시각(takenAt/firstVisit/lastVisit/startAt/endAt)은 epoch 초 number로. min/max는 Math.min/Math.max. JS Date 메서드 금지.
2) trip id의 Int(Double): Swift Int(timeIntervalSince1970)은 0방향 절삭 → Math.trunc 사용 (Math.floor 아님; 테스트 epoch은 전부 양의 정수라 동일하지만 byte-faithful하게 trunc).
3) 이중 옵셔널 평탄화: Swift `regionByID[$0] ?? nil`은 String?? → String? 평탄화. TS에서는 Map<string, string|null>에서 get이 undefined(키 없음) 또는 null(매칭 실패) 둘 다 가능 → compactMap 대응 시 `!= null`로 둘 다 걸러야 함(representativeRegionCode에는 string만 전달).
4) regionByID first-wins: localIdentifier 중복 시 Dictionary(uniquingKeysWith: first) → TS는 `if (!map.has(id)) map.set(id, code)`. 마지막 값 덮어쓰기(JS 기본)와 반대이므로 주의.
5) tripMembership은 일반 객체/Map 대입(last-wins)이지만 segmenter가 sample을 한 trip에만 배정하므로 실질 무관 — 같은 순회 순서만 유지.
6) trips 정렬: startAt 오름차순 + 동률 시 id 문자열 오름차순 명시 비교자. JS sort는 안정적이므로 문제 없으나 비교자를 그대로 구현(`t0 !== t1` 숫자 비교 후 `a.id < b.id`). regions 정렬은 regionCode `<` 단순 문자열 비교(localeCompare 금지 — Swift String `<`는 유니코드 코드포인트 비교, 숫자 코드라 `<` 연산자로 동일).
7) representativeRegionCode는 재구현 금지 — tripMetrics.representativeRegionCode에 위임(canonical tie-break: 빈도 내림차순, 동률 시 코드 오름차순). Swift 쪽 counts.max 비교반전 트릭을 이 모듈에서 복제하지 말 것.
8) tzOffset 호출은 항상 exifOffsetSeconds=null 고정. segmentConfig/tzConfig 기본값은 각 모듈의 기본 생성자 값과 동일해야 함(파라미터 미지정 시).
9) photos는 입력 순서 보존(map만, 정렬 없음). sampleIDs 순서는 tripSegmenter 산출(takenAt 오름차순, 동률 id 안정정렬)을 그대로 신뢰.
10) 테스트 픽스처: 실제 GeoDataStore(11MB GeoJSON) 기반 RegionMatcher가 필요 — Swift 테스트는 클래스당 1회 생성·공유. TS에서는 geoStores+geojsonDecode로 파싱된 JSON을 모듈 레벨 싱글턴/beforeAll에서 1회 로드해 공유(테스트 전용 의존: geoStores, geojsonDecode). 디코드 비용 때문에 매 테스트 재로드 금지.
11) `trip.sampleIDs.first ?? ""` — 빈 trip은 발생하지 않지만 `?? ""` 폴백 유지.
12) (지시 명시) dataActorReconcile 모듈의 경우: reconcile/upsert/prune/visited-wins/단일행 home에 해당하는 로직과 테스트만 포팅 대상으로 추리고 merge/split/title/delete는 제외한다. scanPipeline은 dataActorReconcile에 의존하지 않음.