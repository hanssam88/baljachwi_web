# 모듈 카드: photoTime

**TS 타겟:** src/core/photoTime.ts

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
// src/core/photoTime.ts
import type { Coordinate } from "./geoTypes";

/** Swift ClosedRange<Double> 대응 — 양 끝 경계 포함(>=, <=) */
export interface ClosedRange {
  readonly min: number;
  readonly max: number;
}

/** 타임존 결정 임계값/설정. 모든 오프셋은 "UTC 동쪽 양수" 초 단위. */
export interface TZConfig {
  /** 한국 bbox 위도 닫힌 구간. 기본 {min: 33.0, max: 38.9} */
  koreaLatRange: ClosedRange;
  /** 한국 bbox 경도 닫힌 구간. 기본 {min: 124.6, max: 132.0} */
  koreaLonRange: ClosedRange;
  /** bbox 내부일 때 고정 오프셋(초). KST +9h = 32400, DST 없음 */
  koreaOffsetSeconds: number;
}

/** Swift `TZConfig()` 기본 생성자 대응. 호출마다 새 객체 반환(변이 안전). */
export function defaultTZConfig(): TZConfig {
  return {
    koreaLatRange: { min: 33.0, max: 38.9 },
    koreaLonRange: { min: 124.6, max: 132.0 },
    koreaOffsetSeconds: 32400,
  };
}

/**
 * 우선순위: 1차 한국 bbox(경계 포함, coordinate null이면 건너뜀)
 *        → 2차 exifOffsetSeconds(null 아니면 그 값, 0도 유효)
 *        → 3차 deviceOffsetSeconds.
 */
export function tzOffset(
  coordinate: Coordinate | null,
  exifOffsetSeconds: number | null,
  deviceOffsetSeconds: number,
  config?: TZConfig // 생략 시 defaultTZConfig()
): number;

/** Swift 명명 튜플 (hourOfDay, year, month, day) 대응 */
export interface LocalComponents {
  /** 시(時) 컴포넌트, 항상 [0, 24) 정수. 분/초 버림 */
  hourOfDay: number;
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
}

/**
 * epochSeconds: Swift Date.timeIntervalSince1970 대응 (UTC epoch 초, number).
 * epoch + tzOffsetSeconds 를 그대로 UTC 그레고리력으로 읽는 순수 정수 산술.
 * JS Date 메서드(getHours 등) 사용 금지 — floorDiv/floorMod + civil-from-days 로 구현.
 */
export function localComponents(
  epochSeconds: number,
  tzOffsetSeconds: number
): LocalComponents;
```

## 보존 상수 (constants)

- koreaLatRange.min=33.0
- koreaLatRange.max=38.9
- koreaLonRange.min=124.6
- koreaLonRange.max=132.0
- koreaOffsetSeconds=32400
- (내부 구현용) SECONDS_PER_DAY=86400
- (내부 구현용) SECONDS_PER_HOUR=3600

## 포팅할 테스트 (testsToPort)

### testSeoulInsideKoreaBBox_returnsKST
tzOffset({lat:37.5665, lon:126.978}, exif=7200, device=0) === 32400 — 한국 bbox가 EXIF/디바이스보다 우선

### testParisOutsideKorea_withExif_returnsExif
tzOffset({lat:48.85, lon:2.35}, exif=3600, device=32400) === 3600

### testOutsideKorea_exifNil_returnsDevice
tzOffset({lat:48.85, lon:2.35}, exif=null, device=32400) === 32400

### testNilCoordinate_withExif_returnsExif
tzOffset(null, exif=3600, device=32400) === 3600 — 좌표 null이면 1차 건너뜀

### testNilCoordinate_exifNil_returnsDevice
tzOffset(null, exif=null, device=-18000) === -18000 — 음수 디바이스 오프셋 그대로

### testKoreaBBoxExactCorners_inclusive_returnKST
네 모서리 (33.0,124.6), (38.9,132.0), (33.0,132.0), (38.9,124.6) 각각 exif=3600, device=0 으로 호출 시 모두 32400 — 닫힌 구간 경계 포함 검증

### testKoreaBBoxJustOutside_fallsBackToExif
(32.999, 126.0) → 3600, (36.0, 132.001) → 3600 (exif=3600, device=0) — 경계 epsilon 바깥은 exif 폴백

### testCustomConfig_overridesBBoxAndOffset
config={lat 35.0..36.0, lon 139.0..140.0, offset 12345} 주입 시: 서울(37.5665,126.978, exif=3600, device=0) → 3600 (새 bbox 밖), 도쿄근처(35.6,139.7, exif=3600, device=0) → 12345 (새 bbox 안)

### testLocalComponents_sameDay
epoch=1767276000 (2026-01-01T14:00:00Z), offset=32400 → {hourOfDay:23, year:2026, month:1, day:1}

### testLocalComponents_forwardRollover
epoch=1767283200 (2026-01-01T16:00:00Z), offset=32400 → {hourOfDay:1, year:2026, month:1, day:2} — 익일 롤오버

### testLocalComponents_backwardRollover_negativeOffset
epoch=1767232800 (2026-01-01T02:00:00Z), offset=-18000 → {hourOfDay:21, year:2025, month:12, day:31} — 연/월/일 모두 역방향 롤백

### testLocalComponents_halfHourOffset
epoch=1780862400 (2026-06-07T20:00:00Z), offset=19800 (+5:30) → {hourOfDay:1, year:2026, month:6, day:8} — 현지 01:30, 분은 버림

### testLocalComponents_negativeHalfHour_backwardRolloverAcrossYear
epoch=1767236400 (2026-01-01T03:00:00Z), offset=-19800 (-5:30) → {hourOfDay:21, year:2025, month:12, day:31} — 현지 21:30, 음수+반시간대+연경계 동시

### testLocalComponents_hourInRange
epoch=1767225600 (2026-01-01T00:00:00Z), offset=32400 → hourOfDay===9 그리고 0 <= hourOfDay < 24 범위 단언

## 포팅 함정 (notes)

함정 목록: (1) exifOffsetSeconds 옵셔널 — Swift `if let exif` 은 0도 통과시킨다. TS에서 truthy 체크(`if (exif)`) 금지, 반드시 `exif !== null && exif !== undefined` (또는 `!= null`)로 판정. exif=0(UTC)이 유효값. (2) bbox 경계는 ClosedRange.contains — 양 끝 포함(>=, <=). 부등호 방향/포함 여부를 절대 바꾸지 말 것. 판정 순서도 lat 먼저, lon 다음(부작용 없으니 결과 동일하지만 byte-faithful 유지). (3) localComponents 는 JS Date 의 getHours/getFullYear 등 로컬 타임존 메서드 절대 금지. 구현: shifted = epochSeconds + tzOffsetSeconds 후 floorDiv(shifted, 86400)로 days, floorMod(shifted, 86400)로 secOfDay, hour = Math.floor(secOfDay/3600), days→(y,m,d)는 Hinnant civil-from-days 알고리즘. 음수 shifted(1970 이전/큰 음수 오프셋)에서 JS `%` 는 음수를 반환하므로 floorMod = ((a % n) + n) % n 필수, floorDiv = Math.floor(a / n). (4) Swift Date.timeIntervalSince1970 은 Double — TS 시그니처도 number(소수 허용). 테스트는 정수 초만 사용하지만, 소수 입력 시 Swift Calendar 는 컴포넌트를 내림(truncate)하므로 추출 전 Math.floor(shifted) 적용이 동등 동작. (5) Swift ClosedRange<Double> → TS {min, max} 객체로 표현(튜플보다 명시적). TZConfig 기본값은 함수 defaultTZConfig()로 — 모듈 레벨 공유 상수 객체로 두면 테스트(testCustomConfig)처럼 변이하는 호출자가 기본값을 오염시킬 수 있음. (6) 반환 명명 튜플 (hourOfDay, year, month, day) → LocalComponents 객체로. (7) tzOffset 의 config 기본 인자: `config: TZConfig = defaultTZConfig()` 패턴. (8) 테스트 헬퍼 utcDate 는 epoch 정수를 하드코딩하거나 Date.UTC(y, mo-1, d, h, mi, s)/1000 사용 가능(Date.UTC 는 타임존 비의존이라 결정적, 단 month 가 0-based 인 점 주의). 프로덕션 코드에는 Date 사용 금지. (9) 이 모듈은 dataActorReconcile 이 아니므로 reconcile 관련 제외 지침은 해당 없음. (10) Coordinate 는 geoTypes 의 {lat, lon} 을 import — 로컬 재정의 금지.