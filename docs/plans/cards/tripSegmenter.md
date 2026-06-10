# 모듈 카드: tripSegmenter

**TS 타겟:** src/core/tripSegmenter.ts

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
```ts
// src/core/tripSegmenter.ts
import type { Coordinate, BBox } from './geoTypes';

/** 여행 분리 입력 단위. 시간은 전부 epoch 초(number) — JS Date 금지. */
export interface PhotoSample {
  /** 안정 키(정렬 tie-break에도 사용). */
  id: string;
  coordinate: Coordinate;
  /** 절대 촬영 시각, UTC epoch 초 (Swift Date.timeIntervalSince1970 대응). */
  takenAt: number;
  /** 현지 타임존 오프셋(초). 예: KST=+32400, 파리(겨울)=+3600. */
  localTZoffsetSeconds: number;
}

/** 여행 1개. sampleIDs는 절대시각 오름차순. */
export interface Trip {
  sampleIDs: string[];
  /** epoch 초 */
  startAt: number;
  /** epoch 초 */
  endAt: number;
  bbox: BBox; // {minLat,minLon,maxLat,maxLon} — geoTypes BBox 필드명 일치 필수
}

export interface SegmentResult {
  trips: Trip[];
  /** 탐지된 home 좌표(없으면 null). */
  home: Coordinate | null;
}

/** 임계값 전부 주입형. 기본값은 makeSegmentConfig 참조. */
export interface SegmentConfig {
  jumpKM: number;                  // ③ home 점프 분리 거리(km)
  gapHours: number;                // ④ 시간 gap 분리(h)
  homeSuppressionRadiusKM: number; // home 근처 판정 반경(km)
  stayShiftKM: number;             // home nil 폴백 체류지 이동(km)
  nightStartHour: number;          // 야간 시작(포함)
  nightEndHour: number;            // 야간 끝(미포함)
  minHomeNights: number;           // home 성립 최소 서로 다른 현지 날짜 수
  burstMeters: number;             // burst 거리(m)
  burstSeconds: number;            // burst 시간(초)
  homeClusterRadiusKM: number;     // 야간 위치 그리디 군집 반경(km)
  trivialMinPhotos: number;        // 사진 수 미만 → trivial
  trivialRadiusKM: number;         // AND-절 반경(km)
  trivialDurationHours: number;    // AND-절 지속(h)
}

/** Swift SegmentConfig() 기본 생성자 대응 — partial 오버라이드 허용. */
export function makeSegmentConfig(overrides?: Partial<SegmentConfig>): SegmentConfig;

/**
 * 사진들을 여행 단위로 분리. 순수·결정적.
 * 순서: (1)절대시각+id 정렬 → (2)burst dedupe → (3)home 탐지(전체 deduped 기준)
 *      → (3.5)excludedTripSampleIDs 제외 → (4)인접쌍 분리 → (5)trivial 제거 + 조건부 home-area 억제.
 * excludedTripSampleIDs 기본 빈 Set — home 탐지에는 영향 없음(트립 생성에서만 제외).
 */
export function segment(
  samples: PhotoSample[],
  config?: SegmentConfig,
  excludedTripSampleIDs?: ReadonlySet<string>
): SegmentResult;

// ── Swift internal static(@testable 테스트 대상) — TS에서는 named export로 노출 ──

/** 현지 시(0~23). shifted = takenAt + tzOffset. */
export function hourOfDay(s: PhotoSample): number {
  const shifted = s.takenAt + s.localTZoffsetSeconds;
  const h = Math.floor(shifted / 3600);
  return ((h % 24) + 24) % 24;
}

/** 현지 날짜 버킷. 음수 epoch도 Math.floor로 안전 (Math.trunc 금지). */
export function localDay(s: PhotoSample): number {
  return Math.floor((s.takenAt + s.localTZoffsetSeconds) / 86400);
}

/** 야간 판정. wrap: nightStart>nightEnd 이면 hour>=start || hour<end. 경계: start 포함, end 미포함. */
export function isNight(hour: number, config: SegmentConfig): boolean {
  if (config.nightStartHour <= config.nightEndHour) {
    return hour >= config.nightStartHour && hour < config.nightEndHour;
  }
  return hour >= config.nightStartHour || hour < config.nightEndHour;
}

/** haversine 거리(m). R=6371000, sqrt 클램프 min(1, sqrt(h)). */
export function haversineMeters(a: Coordinate, b: Coordinate): number;
```
```

## 보존 상수 (constants)

- jumpKM=90
- gapHours=8
- homeSuppressionRadiusKM=18
- stayShiftKM=40
- nightStartHour=21
- nightEndHour=6
- minHomeNights=3
- burstMeters=50
- burstSeconds=120
- homeClusterRadiusKM=18
- trivialMinPhotos=2
- trivialRadiusKM=5
- trivialDurationHours=4
- earthRadiusMeters=6371000 (haversine R)
- secondsPerHour=3600
- secondsPerDay=86400
- kmToMeters=1000 (homeClusterRadiusKM*1000, 거리/1000 비교)

## 포팅할 테스트 (testsToPort)

### testEmptyInput
segment([], 기본config) → trips=[], home=null.

### testSinglePhotoIsTrivial
BUSAN(35.1796,129.0756) 1장, epoch=localEpoch(day100,h10,tz32400) → trips 빈 배열 (사진<trivialMinPhotos=2). 헬퍼: localEpoch(day,hour,min=0,tz)=day*86400+hour*3600+min*60-tz.

### testSortsByAbsoluteTime
입력순서 c(h14)/a(h10)/b(h12,lat=BUSAN.lat+0.05) day200 KST → trips.length=1, sampleIDs=["a","b","c"] (절대시각 정렬).

### testBurstDedupeCollapsesToFirst
burst0..burst9: BUSAN 동일좌표, day300 h10 시작 +i*12초(Δt<120s, 거리0) + later(BUSAN.lat+0.1, day300 h16) → trips.length=1, sampleIDs=["burst0","later"] (앵커=첫 점, 9장 제거).

### testBurstDoesNotCollapseLongStay
BUSAN 동일좌표 a(h10)/b(h11)/c(h15) day310 → Δt 1h>120s라 축약 안 됨. trips.length=1, sampleIDs=["a","b","c"].

### testHomeDetectedFromNightClusters
SEOUL(37.5665,126.9780) 야간 h23, day400..402 3일 → home!=null, |home.lat-37.5665|<=0.01, |home.lon-126.9780|<=0.01.

### testHomeNilWhenInsufficientNights
SEOUL 야간 h23 day500,501 2일(<minHomeNights=3) → home=null.

### testKST23IsNight
SEOUL h23:30, day600..602 3일, tz=32400 → home!=null (23시>=nightStart 21, wrap 경계 확인).

### testBusan3NightsSingleTrip
서울 h22 야간 6일(day700..705) + 부산 4일(busan_day{0..3}: lat=BUSAN.lat+d*0.01, day710..713 h13; busan_night{0..2}: BUSAN, day710..712 h22) → home.lat≈SEOUL.lat(±0.1); "busan" prefix 포함 trip 정확히 1개; 그 trip의 busan-prefix id 수=7. 야간 gap(22→다음날13시=15h>gapHours)이어도 ①(둘 다 home에서 멂)로 비분리.

### testCommuteSuppressedWhenRealTripCoexists
5일(day800..804): home{d}=SEOUL h22, work_am{d}/work_pm{d}=SEOUL_WORK(37.5,127.04, <18km) h9/h18 + 부산(busan_day{0..2}: lat+d*0.02 day810..812 h13, busan_night{0..1} day810..811 h22) → home.lat≈SEOUL(±0.1); 어떤 trip도 "work" prefix id 미포함(home-area 억제, 백스톱 활성); "busan" prefix 포함 trip 존재.

### testResortOnlyLibraryNotDeletedToZero
부산만 4일(day100..103): r{d}_noon(lat+d*0.02,h13), r{d}_pm(lat+d*0.02,lon+0.03,h16), r{d}_night(BUSAN,h22,d<3만) → home이 부산으로 오탐돼도 trips 비어있으면 안 됨(모든 비사소 세그먼트가 home 반경 내 → 억제 skip 백스톱).

### testNearHomeOnlyActivitySurfaces
서울 야간 h23 5일(day200..204) + 2일(day210,211) 활동 act{d}_a(37.66,127.05,h10)/act{d}_b(37.52,127.10,h14)/act{d}_c(37.60,127.08,h18) → home.lat≈SEOUL(±0.05); trips 비어있지 않음(원거리 여행 없으면 home-area 억제 비활성).

### testHomeTieBreakFirstAppearanceWins
서울 야간 3일(a0..2, day300..302 h23) + 부산 야간 3일(b0..2, day303..305 h23) 동률 → home.lat≈SEOUL.lat(±0.05). 첫 등장 클러스터 승리 = max(by:)가 strict-greater일 때만 교체.

### testDayTripSameDayTerminalHomeReturn
home 성립(SEOUL h23 day890..892) + day900: morning_home(SEOUL h9), lunch_far(DAEJEON 36.3504,127.3845 h12), evening_home(SEOUL h20:30) → lunch_far 포함 trip 존재하고 그 trip이 evening_home도 포함(② 같은날 종착 home복귀가 ④ 8.5h gap보다 우선).

### testHomeSuppressionNoNewTripAtNight
home 성립(SEOUL h22 day1000..1002) + night(SEOUL day1010 h22) + morning(SEOUL_NEAR 37.57,126.98 day1011 h8, 10h gap) → 어떤 trip도 id "night"/"morning" 미포함(home-area drop).

### testOverseasNightUsesLocalTZOffset
파리(48.8566,2.3522) tz=3600, 현지 h21 3일(day1100..1102; UTC로는 20시) → home!=null, ≈파리(±0.05). tzOffset 미적용이면 야간 미인식되는 식별 케이스.

### testOverseasTripSeparatesFromKoreanHome
서울 home(h22 day1100..1102, tz32400) + paris_a(day1110 h10 tz3600), paris_b(lat+0.08,lon+0.08, h15 tz3600) → "paris" prefix 포함 trip 정확히 1개.

### testHomeNilFallbackSplitsByStayShift
seoul_a(h10)/seoul_b(lat+0.02,h14) day1200 + busan_a(h10)/busan_b(lat+0.02,h14) day1205, 야간 없음 → home=null, trips.length=2 (stayShiftKM=40 폴백 분리).

### testTrivialSmallShortClusterRemoved
a(BUSAN h10)/b(lat+0.005 h12) day1500 → 기본config: trips=[] (반경~0.28km<5 AND 2h<4). config{trivialRadiusKM:0, trivialDurationHours:0} 주입: trips.length=1 (AND-절 무력화).

### testTripMetadata
a(BUSAN h10)/b(lat+0.1,lon+0.1 h15) day1300 → trips.length=1; startAt=localEpoch(1300,10,tz32400)±0.5, endAt=localEpoch(1300,15)±0.5; bbox.minLat=35.1796, minLon=129.0756, maxLat=35.2796, maxLon=129.1756 (각 ±1e-6).

### testConfigInjectionJumpKMIsolatesRuleThree
서울 home(h22 day1400..1402) + day1410: morning_home(SEOUL h9), busan_noon(BUSAN h12), busan_pm(lat+0.1 h16), busan_eve(lat+0.2 h20). 기본 jumpKM=90: 모든 id가 busan-prefix이고 busan_noon 포함하는 trip 존재(③ 발화). jumpKM=99999 주입: all-busan trip 없음 AND busan_noon 포함 trip이 morning_home도 포함(③ 미발화 병합). gap 3h<8이라 ④ 미발화, 종착 부산이라 ② 미발화 — ③ 격리 검증.

### testExcludedSampleIDsDropTheirTripOnly
testHomeNilFallbackSplitsByStayShift와 동일 4샘플. 기본: trips.length=2. excludedTripSampleIDs={busan_a,busan_b}: trips.length=1, busan-prefix trip 없음, seoul_a 포함 trip 유지.

### testExcludedSampleIDsDoNotAffectHome
night0..2(SEOUL h23 day400..402). full=segment(s) → home!=null. excluded=segment(s,{night0}) → excluded.home가 full.home과 깊은 동등(lat/lon 동일) — home 탐지는 전체 deduped 기준.

## 포팅 함정 (notes)

[시간] Swift Date → epoch 초 number로 전면 치환. 원본부터 시스템 Calendar/TimeZone 미사용 — hourOfDay/localDay는 Math.floor 기반 정수 산술만(Math.trunc 금지: 음수 epoch에서 floor와 다름). JS %는 부호 보존이므로 ((h%24)+24)%24 이중 mod 그대로 보존. [정렬] sorted{ t0!=t1 ? t0<t1 : $0.id<$1.id } → 복사 후 sort((a,b)=> a.takenAt-b.takenAt || codepoint 비교). id 비교는 localeCompare 금지, (a<b?-1:a>b?1:0) 코드포인트 비교(Swift String < 와 ASCII id에서 일치). [tie-break] detectHome의 max(by:{$0.days.count<$1.days.count})는 strict-greater일 때만 교체 → 동률 시 첫 등장 클러스터 승리. reduce로 candidate.days.size > best.days.size 일 때만 교체해야 testHomeTieBreakFirstAppearanceWins 통과. firstIndex(where:) → findIndex (첫 매칭 클러스터에 편입). 클러스터 편입 시마다 centroid 재계산(running re-centroid가 이후 멤버십에 영향 — 순서 보존). days는 Set<number>, .count→.size. [경계 연산자 정밀 보존] burst: dM<=burstMeters AND dt<=burstSeconds(둘 다 <=); aFar/bFar: dist/1000 > radius(strict >); ③ jump: distKM >= jumpKM(>=); ④ gap: gapH > gapHours(strict >); 폴백 stayShift: >= ; trivial AND-절: radius < AND duration < (strict <), count < trivialMinPhotos; isHomeArea/종착복귀: <= radius. [shouldSplit 순서] first-match ①→②→③→④→⑤ 순서 절대 보존. ②의 sameDayTerminatesAtHome lookahead는 exclusion 적용 후 배열(forTrips) 기준. [home/exclusion 경계] home 탐지는 전체 deduped(제외 전), 트립 런 생성만 forTrips(제외 후) — 순서 바꾸면 testExcludedSampleIDsDoNotAffectHome 깨짐. forTrips 빈 경우 {trips:[], home} 반환. [burst 앵커] 직전 점이 아니라 burst 첫 점(앵커) 기준 거리/시간 — 앵커는 생존 샘플에서만 갱신. [haversine] R=6371000, min(1,sqrt(h)) 클램프, asin 사용 — Math 함수 그대로 1:1. [옵셔널] home: Coordinate? → Coordinate|null. SegmentResult.home 비교 테스트는 lat/lon 깊은 동등(같은 코드경로라 === 성립). makeTrip의 min()??0 폴백은 비어있지 않은 run에서만 호출되므로 도달 불가 — 형태만 보존. [백스톱] hasAwayTrip(모든 비사소가 home-area면 억제 skip) 로직 누락 시 testResortOnlyLibraryNotDeletedToZero/testNearHomeOnlyActivitySurfaces 깨짐. [BBox 충돌] Swift 원본은 이 파일에서 BBox 자체 정의 — TS는 geoTypes의 BBox{minLat,minLon,maxLat,maxLon} import. geoTypes 필드명이 다르면 tripSegmenter 전용 타입으로 분리 후 re-export. [accuracy] XCTAssertEqual(accuracy:) → Math.abs(a-b)<=acc 형태(toBeCloseTo의 자릿수 의미와 다름 주의). [스코프] dataActorReconcile 관련: 본 카드는 tripSegmenter라 해당 없음 — dataActorReconcile 분석 시에는 reconcile/upsert/prune/visited-wins/단일행 home 로직·테스트만 포함하고 merge/split/title/delete는 제외한다.