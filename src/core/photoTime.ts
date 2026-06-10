// src/core/photoTime.ts
//
// PhotoTime — 사진의 타임존 오프셋 결정 및 절대시각→현지 컴포넌트 파생(순수).
//
// 설계 원칙:
//  - 순수·결정적. 네트워크/디스크 I/O 없음. 전역 가변상태 없음.
//  - 디바이스 현재 타임존/달력을 절대 읽지 않는다. 모든 시간 계산은
//    UTC 고정 달력 + 명시적 오프셋(초)으로만 수행한다 (JS Date 메서드 금지).
//
// 단위 규칙:
//  - 모든 오프셋은 "UTC 동쪽 양수" 초(second) 단위.
//    예) KST = +9h = 32400, NYC(EST) = -5h = -18000, 인도(IST) = +5:30 = 19800.

import type { Coordinate } from './geoTypes';

/** 내부 구현용 상수. */
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_HOUR = 3600;

/** Swift ClosedRange<Double> 대응 — 양 끝 경계 포함(>=, <=). */
export interface ClosedRange {
  readonly min: number;
  readonly max: number;
}

/** 닫힌 구간 포함 판정 (Swift ClosedRange.contains 대응). 경계 포함(>=, <=). */
function rangeContains(range: ClosedRange, value: number): boolean {
  return value >= range.min && value <= range.max;
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

/**
 * Swift `TZConfig()` 기본 생성자 대응. 호출마다 새 객체 반환(변이 안전).
 * 모듈 레벨 공유 상수로 두면 변이하는 호출자가 기본값을 오염시킬 수 있으므로 함수로 제공.
 */
export function defaultTZConfig(): TZConfig {
  return {
    koreaLatRange: { min: 33.0, max: 38.9 },
    koreaLonRange: { min: 124.6, max: 132.0 },
    koreaOffsetSeconds: 32400,
  };
}

/**
 * 좌표/EXIF/디바이스 정보로 사진의 타임존 오프셋(초, UTC 동쪽 양수)을 결정한다.
 *
 * 우선순위:
 *  1차) coordinate 가 한국 bbox 내부면 config.koreaOffsetSeconds(=KST +9h). 경계 포함.
 *       coordinate == null 이면 1차를 건너뜀.
 *  2차) exifOffsetSeconds != null 이면 그 값 (0도 유효값 — truthy 체크 금지).
 *  3차) 그 외에는 deviceOffsetSeconds.
 */
export function tzOffset(
  coordinate: Coordinate | null,
  exifOffsetSeconds: number | null,
  deviceOffsetSeconds: number,
  config: TZConfig = defaultTZConfig(),
): number {
  // 1차: 한국 bbox 내부 판정(경계 포함). null 좌표는 이 단계를 건너뜀.
  // 판정 순서 lat 먼저, lon 다음 (byte-faithful 유지).
  if (
    coordinate !== null &&
    rangeContains(config.koreaLatRange, coordinate.lat) &&
    rangeContains(config.koreaLonRange, coordinate.lon)
  ) {
    return config.koreaOffsetSeconds;
  }
  // 2차: EXIF 오프셋. 0(UTC)도 유효값이므로 !== null 로 판정 (truthy 금지).
  if (exifOffsetSeconds !== null && exifOffsetSeconds !== undefined) {
    return exifOffsetSeconds;
  }
  // 3차: 디바이스 오프셋.
  return deviceOffsetSeconds;
}

/** Swift 명명 튜플 (hourOfDay, year, month, day) 대응. */
export interface LocalComponents {
  /** 시(時) 컴포넌트, 항상 [0, 24) 정수. 분/초 버림. */
  hourOfDay: number;
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/** 내림 나눗셈 (음수에서도 floor). */
function floorDiv(a: number, n: number): number {
  return Math.floor(a / n);
}

/** 내림 나머지 (음수에서도 항상 [0, n)). JS % 는 음수를 반환하므로 보정 필수. */
function floorMod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/**
 * Howard Hinnant civil-from-days 알고리즘.
 * days = 1970-01-01(UTC) 기준 일수(음수 허용) → (year, month[1-12], day[1-31]).
 * 참고: http://howardhinnant.github.io/date_algorithms.html#civil_from_days
 */
function civilFromDays(days: number): { year: number; month: number; day: number } {
  // 1970-01-01 을 0000-03-01 기준으로 이동 (719468 = 1970-01-01 의 era 일수).
  const z = days + 719468;
  // era: 400년 주기 (146097일). z 가 음수여도 floorDiv 로 올바른 era.
  const era = floorDiv(z >= 0 ? z : z - 146096, 146097);
  const doe = z - era * 146097; // day of era [0, 146096]
  // year of era [0, 399]
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)); // day of year [0, 365]
  const mp = Math.floor((5 * doy + 2) / 153); // month [0, 11] (Mar=0)
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1; // [1, 31]
  const month = mp < 10 ? mp + 3 : mp - 9; // [1, 12]
  const year = month <= 2 ? y + 1 : y; // Jan/Feb 은 다음 해
  return { year, month, day };
}

/**
 * 절대시각(epochSeconds, UTC epoch 초)과 타임존 오프셋(초)으로 현지 시각 컴포넌트를 파생.
 *
 * epoch + tzOffsetSeconds 를 그대로 UTC 그레고리력으로 읽는 순수 정수 산술.
 * JS Date 메서드 사용 금지 — floorDiv/floorMod + Hinnant civil-from-days 로 구현.
 *
 * 소수 입력 시 Swift Calendar 는 컴포넌트를 내림하므로 Math.floor(shifted) 로 동등 동작.
 */
export function localComponents(
  epochSeconds: number,
  tzOffsetSeconds: number,
): LocalComponents {
  // epoch 에 오프셋(초)을 더해 현지 벽시계 시각으로 이동. 소수는 내림(truncate).
  const shifted = Math.floor(epochSeconds + tzOffsetSeconds);

  // 음수 shifted 에서도 올바르도록 floorDiv/floorMod 사용.
  const days = floorDiv(shifted, SECONDS_PER_DAY);
  const secOfDay = floorMod(shifted, SECONDS_PER_DAY);
  const hourOfDay = Math.floor(secOfDay / SECONDS_PER_HOUR);

  const { year, month, day } = civilFromDays(days);
  return { hourOfDay, year, month, day };
}
