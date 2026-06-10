import { describe, it, expect } from 'vitest';
import {
  tzOffset,
  localComponents,
  defaultTZConfig,
  type TZConfig,
} from '@/core/photoTime';
import type { Coordinate } from '@/core/geoTypes';

// PhotoTime — 타임존 오프셋 결정 + 절대시각→현지 컴포넌트 파생(순수).
//
// 단위 규칙:
//  - 모든 오프셋은 "UTC 동쪽 양수" 초(second) 단위. (KST = +9h = 32400, NYC = -5h = -18000)
//  - epochSeconds 는 절대시각(UTC epoch 초). 정렬은 절대시각, hour-of-day/날짜는 현지시각으로 분리.

/**
 * 헬퍼: UTC 고정 달력으로 결정적 epoch 초 생성 (디바이스 TimeZone 비의존).
 * Date.UTC 는 타임존 비의존이라 결정적. month 가 0-based 인 점 주의.
 * (프로덕션 코드에는 Date 사용 금지 — 테스트 헬퍼에서만 허용)
 */
function utcEpoch(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
): number {
  return Date.UTC(y, mo - 1, d, h, mi, s) / 1000;
}

describe('tzOffset', () => {
  // MARK: - tzOffset: 우선순위 1차 (한국 bbox)

  // 서울(37.5665, 126.978)은 한국 bbox 내부 → KST 고정 +9h(32400). EXIF/디바이스 무시.
  it('testSeoulInsideKoreaBBox_returnsKST', () => {
    const offset = tzOffset(
      { lat: 37.5665, lon: 126.978 },
      7200, // 한국 bbox가 우선이므로 무시되어야 함
      0,
    );
    expect(offset).toBe(32400);
  });

  // MARK: - tzOffset: 우선순위 2차 (EXIF)

  // 파리(48.85, 2.35)는 한국 밖 + exif 3600 존재 → 3600.
  it('testParisOutsideKorea_withExif_returnsExif', () => {
    const offset = tzOffset({ lat: 48.85, lon: 2.35 }, 3600, 32400);
    expect(offset).toBe(3600);
  });

  // MARK: - tzOffset: 우선순위 3차 (디바이스)

  // 한국 밖 + exif nil → 디바이스 오프셋(+9h)을 반환.
  it('testOutsideKorea_exifNil_returnsDevice', () => {
    const offset = tzOffset({ lat: 48.85, lon: 2.35 }, null, 32400);
    expect(offset).toBe(32400);
  });

  // MARK: - tzOffset: nil 좌표 (1차 건너뜀)

  // 좌표 nil이면 1차(한국 bbox)를 건너뛰고 exif가 있으면 exif.
  it('testNilCoordinate_withExif_returnsExif', () => {
    const offset = tzOffset(null, 3600, 32400);
    expect(offset).toBe(3600);
  });

  // 좌표 nil + exif nil → 디바이스. (음수 디바이스 오프셋 그대로)
  it('testNilCoordinate_exifNil_returnsDevice', () => {
    const offset = tzOffset(null, null, -18000); // NYC 서경 -5h
    expect(offset).toBe(-18000);
  });

  // 함정 (1): exif=0(UTC)은 유효값 — truthy 체크 금지. exif=0 이면 0 반환(디바이스로 폴백 안 됨).
  it('exif=0 (UTC) 은 유효값 — 디바이스로 폴백하지 않음', () => {
    expect(tzOffset(null, 0, 32400)).toBe(0);
    expect(tzOffset({ lat: 48.85, lon: 2.35 }, 0, 32400)).toBe(0);
  });

  // MARK: - tzOffset: 한국 bbox 경계 (경계 포함 규칙)

  // bbox 네 모서리 경계 좌표는 "포함"(inclusive)으로 판정 → KST.
  // 경계 규칙: lat ∈ [33.0, 38.9], lon ∈ [124.6, 132.0] 모두 닫힌 구간(>=, <=).
  it('testKoreaBBoxExactCorners_inclusive_returnKST', () => {
    const corners: Coordinate[] = [
      { lat: 33.0, lon: 124.6 }, // 남서
      { lat: 38.9, lon: 132.0 }, // 북동
      { lat: 33.0, lon: 132.0 }, // 남동
      { lat: 38.9, lon: 124.6 }, // 북서
    ];
    for (const c of corners) {
      expect(tzOffset(c, 3600, 0)).toBe(32400);
    }
  });

  // bbox 경계 바로 바깥(epsilon)은 KST가 아님 → exif로 폴백.
  it('testKoreaBBoxJustOutside_fallsBackToExif', () => {
    const outside: Coordinate = { lat: 32.999, lon: 126.0 }; // 남쪽 경계 바로 아래
    expect(tzOffset(outside, 3600, 0)).toBe(3600);
    const outsideLon: Coordinate = { lat: 36.0, lon: 132.001 }; // 동쪽 경계 바로 밖
    expect(tzOffset(outsideLon, 3600, 0)).toBe(3600);
  });

  // MARK: - tzOffset: 설정 주입

  // config로 bbox/오프셋을 주입하면 임계값이 바뀐다(매직넘버 미매장 검증).
  it('testCustomConfig_overridesBBoxAndOffset', () => {
    // 한국 bbox를 일본 본토 근처로 옮기고 오프셋도 +9h가 아닌 값으로.
    const config: TZConfig = {
      koreaLatRange: { min: 35.0, max: 36.0 },
      koreaLonRange: { min: 139.0, max: 140.0 },
      koreaOffsetSeconds: 12345,
    };
    // 서울 좌표는 새 bbox 밖 → exif 폴백.
    expect(tzOffset({ lat: 37.5665, lon: 126.978 }, 3600, 0, config)).toBe(3600);
    // 새 bbox 내부(도쿄 근처) → 주입한 오프셋.
    expect(tzOffset({ lat: 35.6, lon: 139.7 }, 3600, 0, config)).toBe(12345);
  });

  // 함정 (5): defaultTZConfig() 는 호출마다 새 객체 — 변이가 기본값을 오염시키지 않음.
  it('defaultTZConfig() 는 호출마다 변이-독립 객체 반환', () => {
    const a = defaultTZConfig();
    const b = defaultTZConfig();
    expect(a).not.toBe(b);
    expect(a.koreaLatRange).not.toBe(b.koreaLatRange);
    // 한 객체를 변이해도 기본 동작은 그대로 (range 는 readonly 계약 → 객체 통째 교체로 변이)
    a.koreaOffsetSeconds = 999;
    a.koreaLatRange = { min: 0, max: 0 };
    expect(defaultTZConfig().koreaOffsetSeconds).toBe(32400);
    expect(defaultTZConfig().koreaLatRange.min).toBe(33.0);
    // 변이한 a를 주입해도 정상 동작(한국 밖 → exif)
    expect(tzOffset({ lat: 37.5665, lon: 126.978 }, 3600, 0)).toBe(32400);
  });

  // defaultTZConfig 상수값 검증.
  it('defaultTZConfig 상수 보존', () => {
    const c = defaultTZConfig();
    expect(c.koreaLatRange).toEqual({ min: 33.0, max: 38.9 });
    expect(c.koreaLonRange).toEqual({ min: 124.6, max: 132.0 });
    expect(c.koreaOffsetSeconds).toBe(32400);
  });
});

describe('localComponents', () => {
  // MARK: - localComponents: 같은 날 (롤오버 없음)

  // 2026-01-01 14:00 UTC, +9 → 현지 23시, 같은 날 2026-01-01.
  it('testLocalComponents_sameDay', () => {
    const epoch = utcEpoch(2026, 1, 1, 14, 0, 0);
    expect(epoch).toBe(1767276000); // 카드 명시 epoch
    const lc = localComponents(epoch, 32400);
    expect(lc.hourOfDay).toBe(23);
    expect(lc.year).toBe(2026);
    expect(lc.month).toBe(1);
    expect(lc.day).toBe(1);
  });

  // MARK: - localComponents: 정방향 날짜 롤오버

  // 2026-01-01 16:00 UTC, +9 → 현지 익일 01시, 2026-01-02.
  it('testLocalComponents_forwardRollover', () => {
    const epoch = utcEpoch(2026, 1, 1, 16, 0, 0);
    expect(epoch).toBe(1767283200);
    const lc = localComponents(epoch, 32400);
    expect(lc.hourOfDay).toBe(1);
    expect(lc.year).toBe(2026);
    expect(lc.month).toBe(1);
    expect(lc.day).toBe(2);
  });

  // MARK: - localComponents: 역방향 날짜 롤오버 (음수 오프셋)

  // 2026-01-01 02:00 UTC, NYC -5h(-18000) → 현지 전날 21시, 2025-12-31.
  it('testLocalComponents_backwardRollover_negativeOffset', () => {
    const epoch = utcEpoch(2026, 1, 1, 2, 0, 0);
    expect(epoch).toBe(1767232800);
    const lc = localComponents(epoch, -18000);
    expect(lc.hourOfDay).toBe(21);
    expect(lc.year).toBe(2025);
    expect(lc.month).toBe(12);
    expect(lc.day).toBe(31);
  });

  // MARK: - localComponents: 반시간대 오프셋 (+5:30 인도 = 19800)

  // 2026-06-07 20:00 UTC, +5:30(19800) → 현지 01:30 익일 → hourOfDay는 시(時) 단위라 1.
  it('testLocalComponents_halfHourOffset', () => {
    const epoch = utcEpoch(2026, 6, 7, 20, 0, 0);
    expect(epoch).toBe(1780862400);
    const lc = localComponents(epoch, 19800);
    expect(lc.hourOfDay).toBe(1); // 01:30 → hour 컴포넌트 1
    expect(lc.year).toBe(2026);
    expect(lc.month).toBe(6);
    expect(lc.day).toBe(8);
  });

  // 음수 + 반시간대 + 역방향 날짜(연 경계) 롤오버 동시 검증.
  // 2026-01-01 03:00 UTC, 오프셋 -5:30(-19800) → 현지 2025-12-31 21:30 → (hour 21, 2025-12-31).
  it('testLocalComponents_negativeHalfHour_backwardRolloverAcrossYear', () => {
    const epoch = utcEpoch(2026, 1, 1, 3, 0, 0);
    expect(epoch).toBe(1767236400);
    const lc = localComponents(epoch, -19800);
    expect(lc.hourOfDay).toBe(21); // 21:30 → hour 21
    expect(lc.year).toBe(2025);
    expect(lc.month).toBe(12);
    expect(lc.day).toBe(31);
  });

  // hourOfDay는 항상 [0, 24) 범위.
  it('testLocalComponents_hourInRange', () => {
    const epoch = utcEpoch(2026, 1, 1, 0, 0, 0);
    expect(epoch).toBe(1767225600);
    const lc = localComponents(epoch, 32400);
    expect(lc.hourOfDay).toBe(9);
    expect(lc.hourOfDay).toBeGreaterThanOrEqual(0);
    expect(lc.hourOfDay).toBeLessThan(24);
  });

  // 함정 (4): 소수 epoch 입력은 컴포넌트 추출 전 내림(truncate)되어 동등 동작.
  it('소수 epochSeconds 는 추출 전 내림 — 같은 초로 취급', () => {
    const base = 1767276000; // 2026-01-01T14:00:00Z
    const lc0 = localComponents(base, 32400);
    const lcFraction = localComponents(base + 0.9, 32400);
    expect(lcFraction).toEqual(lc0); // 0.9초는 버려져 동일
  });

  // 함정 (3): 음수 shifted (1970 이전) 에서도 floorMod/floorDiv 로 올바른 컴포넌트.
  it('epoch 음수(1970 이전) 도 올바른 civil 컴포넌트', () => {
    // 1969-12-31T23:00:00Z → +0 offset → hour 23, 1969-12-31
    const epoch = utcEpoch(1969, 12, 31, 23, 0, 0);
    expect(epoch).toBe(-3600);
    const lc = localComponents(epoch, 0);
    expect(lc.hourOfDay).toBe(23);
    expect(lc.year).toBe(1969);
    expect(lc.month).toBe(12);
    expect(lc.day).toBe(31);
  });

  // 윤년 2월 29일 경계 — civil-from-days 정확도.
  it('윤년 2024-02-29 경계 정확', () => {
    // 2024-02-29T15:00:00Z, +9 → 2024-03-01 00:00 현지
    const epoch = utcEpoch(2024, 2, 29, 15, 0, 0);
    const lc = localComponents(epoch, 32400);
    expect(lc.hourOfDay).toBe(0);
    expect(lc.year).toBe(2024);
    expect(lc.month).toBe(3);
    expect(lc.day).toBe(1);
  });
});
