import { describe, it, expect } from 'vitest';
import {
  segment,
  makeSegmentConfig,
  hourOfDay,
  localDay,
  isNight,
  haversineMeters,
  type PhotoSample,
  type SegmentConfig,
} from '@/core/tripSegmenter';
import type { Coordinate } from '@/core/geoTypes';

// MARK: - 테스트 헬퍼 (Swift TripSegmenterTests 1:1 포트)
//
// 결정성을 위해 모든 시각은 epoch(UTC 절대초)로 직접 만든다. 시스템 Calendar/TimeZone 미사용.
// 한 "현지 날짜"는 (epoch + localTZoffset) 기준 86400초 버킷이다.

function coord(lat: number, lon: number): Coordinate {
  return { lat, lon };
}

/** 현지 날짜(localDay) + 현지 시(hour)로부터 절대 epoch초를 만든다.
 *  localDay=0 은 1970-01-01(현지). 주어진 tzOffset 으로 역산.
 *  Swift: localSeconds - Double(tzOffset). */
function localEpoch(day: number, hour: number, minute: number, tzOffset: number): number {
  const localSeconds = day * 86400 + hour * 3600 + minute * 60;
  return localSeconds - tzOffset;
}

function sample(
  id: string,
  lat: number,
  lon: number,
  epoch: number,
  tz = 32400, // KST(UTC+9) 기본
): PhotoSample {
  return { id, coordinate: coord(lat, lon), takenAt: epoch, localTZoffsetSeconds: tz };
}

// 주요 좌표(대략적 실제 위치).
const SEOUL = coord(37.5665, 126.978);
const SEOUL_NEAR = coord(37.57, 126.98);
const SEOUL_WORK = coord(37.5, 127.04);
const BUSAN = coord(35.1796, 129.0756);
const DAEJEON = coord(36.3504, 127.3845);

describe('TripSegmenter', () => {
  // MARK: - degenerate / 경계

  it('testEmptyInput: 빈 입력 → 빈 결과, home null', () => {
    const result = segment([], makeSegmentConfig());
    expect(result.trips).toEqual([]);
    expect(result.home).toBeNull();
  });

  it('testSinglePhotoIsTrivial: 단일 사진 → trivial(사진<2)이므로 여행 0개', () => {
    const s = [sample('a', BUSAN.lat, BUSAN.lon, localEpoch(100, 10, 0, 32400))];
    const result = segment(s, makeSegmentConfig());
    expect(result.trips).toHaveLength(0);
  });

  // MARK: - 정렬

  it('testSortsByAbsoluteTime: 입력 역순이어도 절대시각 정렬 후 sampleIDs는 시간순', () => {
    const tz = 32400;
    const s = [
      sample('c', BUSAN.lat, BUSAN.lon, localEpoch(200, 14, 0, tz)),
      sample('a', BUSAN.lat, BUSAN.lon, localEpoch(200, 10, 0, tz)),
      sample('b', BUSAN.lat + 0.05, BUSAN.lon, localEpoch(200, 12, 0, tz)),
    ];
    const result = segment(s, makeSegmentConfig());
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0].sampleIDs).toEqual(['a', 'b', 'c']);
  });

  // MARK: - burst dedupe

  it('testBurstDedupeCollapsesToFirst: 같은 자리 1분 내 10장 → 대표 1점(첫 점)으로 축약', () => {
    const tz = 32400;
    const s: PhotoSample[] = [];
    for (let i = 0; i < 10; i++) {
      s.push(sample(`burst${i}`, BUSAN.lat, BUSAN.lon, localEpoch(300, 10, 0, tz) + i * 12));
    }
    s.push(sample('later', BUSAN.lat + 0.1, BUSAN.lon, localEpoch(300, 16, 0, tz)));
    const result = segment(s, makeSegmentConfig());
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0].sampleIDs).toEqual(['burst0', 'later']);
  });

  it('testBurstDoesNotCollapseLongStay: 장시간 체류(Δt>burstSeconds)는 축약 안 됨', () => {
    const tz = 32400;
    const s = [
      sample('a', BUSAN.lat, BUSAN.lon, localEpoch(310, 10, 0, tz)),
      sample('b', BUSAN.lat, BUSAN.lon, localEpoch(310, 11, 0, tz)),
      sample('c', BUSAN.lat, BUSAN.lon, localEpoch(310, 15, 0, tz)),
    ];
    const result = segment(s, makeSegmentConfig());
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0].sampleIDs).toEqual(['a', 'b', 'c']);
  });

  // MARK: - home 탐지

  it('testHomeDetectedFromNightClusters: 야간 home 근처 ≥3일 → home 탐지', () => {
    const tz = 32400;
    const s: PhotoSample[] = [];
    for (let day = 0; day < 3; day++) {
      s.push(sample(`night${day}`, SEOUL.lat, SEOUL.lon, localEpoch(400 + day, 23, 0, tz)));
    }
    const result = segment(s, makeSegmentConfig());
    expect(result.home).not.toBeNull();
    if (result.home) {
      expect(Math.abs(result.home.lat - SEOUL.lat)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(result.home.lon - SEOUL.lon)).toBeLessThanOrEqual(0.01);
    }
  });

  it('testHomeNilWhenInsufficientNights: 야간 클러스터<minHomeNights → home null', () => {
    const tz = 32400;
    const s = [
      sample('n0', SEOUL.lat, SEOUL.lon, localEpoch(500, 23, 0, tz)),
      sample('n1', SEOUL.lat, SEOUL.lon, localEpoch(501, 23, 0, tz)),
    ];
    const result = segment(s, makeSegmentConfig());
    expect(result.home).toBeNull();
  });

  it('testKST23IsNight: KST 23:30은 야간(nightStart=21)으로 인식 → home 성립', () => {
    const tz = 32400;
    const s: PhotoSample[] = [];
    for (let day = 0; day < 3; day++) {
      s.push(sample(`k${day}`, SEOUL.lat, SEOUL.lon, localEpoch(600 + day, 23, 30, tz)));
    }
    const result = segment(s, makeSegmentConfig());
    expect(result.home).not.toBeNull();
  });

  // MARK: - 골든: 부산 3박 → 1여행(야간 gap 비분리)

  it('testBusan3NightsSingleTrip', () => {
    const tz = 32400;
    const s: PhotoSample[] = [];
    for (let day = 0; day < 6; day++) {
      s.push(sample(`home_before${day}`, SEOUL.lat, SEOUL.lon, localEpoch(700 + day, 22, 0, tz)));
    }
    for (let day = 0; day < 4; day++) {
      s.push(sample(`busan_day${day}`, BUSAN.lat + day * 0.01, BUSAN.lon, localEpoch(710 + day, 13, 0, tz)));
      if (day < 3) {
        s.push(sample(`busan_night${day}`, BUSAN.lat, BUSAN.lon, localEpoch(710 + day, 22, 0, tz)));
      }
    }
    const result = segment(s, makeSegmentConfig());
    expect(result.home).not.toBeNull();
    if (result.home) {
      expect(Math.abs(result.home.lat - SEOUL.lat)).toBeLessThanOrEqual(0.1);
    }
    const busanTrips = result.trips.filter((trip) =>
      trip.sampleIDs.some((id) => id.startsWith('busan')),
    );
    expect(busanTrips).toHaveLength(1);
    expect(busanTrips[0].sampleIDs.filter((id) => id.startsWith('busan')).length).toBe(7);
  });

  // MARK: - 골든: 출퇴근 → 여행 아님 (백스톱 조건)

  it('testCommuteSuppressedWhenRealTripCoexists', () => {
    const tz = 32400;
    const s: PhotoSample[] = [];
    for (let day = 0; day < 5; day++) {
      s.push(sample(`home${day}`, SEOUL.lat, SEOUL.lon, localEpoch(800 + day, 22, 0, tz)));
      s.push(sample(`work_am${day}`, SEOUL_WORK.lat, SEOUL_WORK.lon, localEpoch(800 + day, 9, 0, tz)));
      s.push(sample(`work_pm${day}`, SEOUL_WORK.lat, SEOUL_WORK.lon, localEpoch(800 + day, 18, 0, tz)));
    }
    for (let day = 0; day < 3; day++) {
      s.push(sample(`busan_day${day}`, BUSAN.lat + day * 0.02, BUSAN.lon, localEpoch(810 + day, 13, 0, tz)));
      if (day < 2) {
        s.push(sample(`busan_night${day}`, BUSAN.lat, BUSAN.lon, localEpoch(810 + day, 22, 0, tz)));
      }
    }
    const result = segment(s, makeSegmentConfig());
    expect(Math.abs((result.home?.lat ?? 0) - SEOUL.lat)).toBeLessThanOrEqual(0.1);
    expect(
      result.trips.every((trip) => !trip.sampleIDs.some((id) => id.startsWith('work'))),
    ).toBe(true);
    expect(
      result.trips.some((trip) => trip.sampleIDs.some((id) => id.startsWith('busan'))),
    ).toBe(true);
  });

  // MARK: - 백스톱: 데이터를 통째로 지우지 않는다

  it('testResortOnlyLibraryNotDeletedToZero', () => {
    const tz = 32400;
    const s: PhotoSample[] = [];
    for (let day = 0; day < 4; day++) {
      s.push(sample(`r${day}_noon`, BUSAN.lat + day * 0.02, BUSAN.lon, localEpoch(100 + day, 13, 0, tz)));
      s.push(sample(`r${day}_pm`, BUSAN.lat + day * 0.02, BUSAN.lon + 0.03, localEpoch(100 + day, 16, 0, tz)));
      if (day < 3) {
        s.push(sample(`r${day}_night`, BUSAN.lat, BUSAN.lon, localEpoch(100 + day, 22, 0, tz)));
      }
    }
    const result = segment(s, makeSegmentConfig());
    expect(result.trips.length).toBeGreaterThan(0);
  });

  it('testNearHomeOnlyActivitySurfaces', () => {
    const tz = 32400;
    const s: PhotoSample[] = [];
    for (let d = 0; d < 5; d++) {
      s.push(sample(`home${d}`, SEOUL.lat, SEOUL.lon, localEpoch(200 + d, 23, 0, tz)));
    }
    for (let d = 0; d < 2; d++) {
      s.push(sample(`act${d}_a`, 37.66, 127.05, localEpoch(210 + d, 10, 0, tz)));
      s.push(sample(`act${d}_b`, 37.52, 127.1, localEpoch(210 + d, 14, 0, tz)));
      s.push(sample(`act${d}_c`, 37.6, 127.08, localEpoch(210 + d, 18, 0, tz)));
    }
    const result = segment(s, makeSegmentConfig());
    expect(Math.abs((result.home?.lat ?? 0) - SEOUL.lat)).toBeLessThanOrEqual(0.05);
    expect(result.trips.length).toBeGreaterThan(0);
  });

  it('testHomeTieBreakFirstAppearanceWins: 동률이면 첫 등장 클러스터가 home', () => {
    const tz = 32400;
    const s: PhotoSample[] = [];
    for (let d = 0; d < 3; d++) {
      s.push(sample(`a${d}`, SEOUL.lat, SEOUL.lon, localEpoch(300 + d, 23, 0, tz)));
    }
    for (let d = 0; d < 3; d++) {
      s.push(sample(`b${d}`, BUSAN.lat, BUSAN.lon, localEpoch(303 + d, 23, 0, tz)));
    }
    const result = segment(s, makeSegmentConfig());
    expect(Math.abs((result.home?.lat ?? 0) - SEOUL.lat)).toBeLessThanOrEqual(0.05);
  });

  // MARK: - 골든: 당일치기 (② > ④ 우선) → 비분할

  it('testDayTripSameDayTerminalHomeReturn', () => {
    const tz = 32400;
    const day = 900;
    const s: PhotoSample[] = [];
    for (let d = 0; d < 3; d++) {
      s.push(sample(`hn${d}`, SEOUL.lat, SEOUL.lon, localEpoch(890 + d, 23, 0, tz)));
    }
    s.push(sample('morning_home', SEOUL.lat, SEOUL.lon, localEpoch(day, 9, 0, tz)));
    s.push(sample('lunch_far', DAEJEON.lat, DAEJEON.lon, localEpoch(day, 12, 0, tz)));
    s.push(sample('evening_home', SEOUL.lat, SEOUL.lon, localEpoch(day, 20, 30, tz)));

    const result = segment(s, makeSegmentConfig());
    const lunchTrip = result.trips.find((t) => t.sampleIDs.includes('lunch_far'));
    expect(lunchTrip).not.toBeUndefined();
    expect(lunchTrip?.sampleIDs.includes('evening_home')).toBe(true);
  });

  // MARK: - 골든: home 억제 (야간 home 근처 새 여행 안 시작)

  it('testHomeSuppressionNoNewTripAtNight', () => {
    const tz = 32400;
    const s: PhotoSample[] = [];
    for (let d = 0; d < 3; d++) {
      s.push(sample(`h${d}`, SEOUL.lat, SEOUL.lon, localEpoch(1000 + d, 22, 0, tz)));
    }
    s.push(sample('night', SEOUL.lat, SEOUL.lon, localEpoch(1010, 22, 0, tz)));
    s.push(sample('morning', SEOUL_NEAR.lat, SEOUL_NEAR.lon, localEpoch(1011, 8, 0, tz)));
    const result = segment(s, makeSegmentConfig());
    expect(
      result.trips.every((trip) => !trip.sampleIDs.some((id) => id === 'night' || id === 'morning')),
    ).toBe(true);
  });

  // MARK: - 골든: 해외(UTC+1 야간) → localTZoffset로 정상 세그먼트

  it('testOverseasNightUsesLocalTZOffset', () => {
    const tzParis = 3600; // UTC+1
    const paris = coord(48.8566, 2.3522);
    const s: PhotoSample[] = [];
    for (let d = 0; d < 3; d++) {
      s.push(sample(`p_night${d}`, paris.lat, paris.lon, localEpoch(1100 + d, 21, 0, tzParis), tzParis));
    }
    const result = segment(s, makeSegmentConfig());
    expect(result.home).not.toBeNull();
    if (result.home) {
      expect(Math.abs(result.home.lat - paris.lat)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(result.home.lon - paris.lon)).toBeLessThanOrEqual(0.05);
    }
  });

  it('testOverseasTripSeparatesFromKoreanHome', () => {
    const tzKST = 32400;
    const tzParis = 3600;
    const paris = coord(48.8566, 2.3522);
    const s: PhotoSample[] = [];
    for (let d = 0; d < 3; d++) {
      s.push(sample(`kh${d}`, SEOUL.lat, SEOUL.lon, localEpoch(1100 + d, 22, 0, tzKST), tzKST));
    }
    s.push(sample('paris_a', paris.lat, paris.lon, localEpoch(1110, 10, 0, tzParis), tzParis));
    s.push(sample('paris_b', paris.lat + 0.08, paris.lon + 0.08, localEpoch(1110, 15, 0, tzParis), tzParis));
    const result = segment(s, makeSegmentConfig());
    const parisTrips = result.trips.filter((t) => t.sampleIDs.some((id) => id.startsWith('paris')));
    expect(parisTrips).toHaveLength(1);
  });

  // MARK: - 골든: home 미탐지 폴백 (STAY_SHIFT_KM + gap 분리)

  it('testHomeNilFallbackSplitsByStayShift', () => {
    const tz = 32400;
    const s = [
      sample('seoul_a', SEOUL.lat, SEOUL.lon, localEpoch(1200, 10, 0, tz)),
      sample('seoul_b', SEOUL.lat + 0.02, SEOUL.lon, localEpoch(1200, 14, 0, tz)),
      sample('busan_a', BUSAN.lat, BUSAN.lon, localEpoch(1205, 10, 0, tz)),
      sample('busan_b', BUSAN.lat + 0.02, BUSAN.lon, localEpoch(1205, 14, 0, tz)),
    ];
    const result = segment(s, makeSegmentConfig());
    expect(result.home).toBeNull();
    expect(result.trips).toHaveLength(2);
  });

  // MARK: - trivial AND-절

  it('testTrivialSmallShortClusterRemoved', () => {
    const tz = 32400;
    const s = [
      sample('a', BUSAN.lat, BUSAN.lon, localEpoch(1500, 10, 0, tz)),
      sample('b', BUSAN.lat + 0.005, BUSAN.lon, localEpoch(1500, 12, 0, tz)),
    ];
    expect(segment(s, makeSegmentConfig()).trips).toHaveLength(0);

    const cfg = makeSegmentConfig({ trivialRadiusKM: 0, trivialDurationHours: 0 });
    expect(segment(s, cfg).trips).toHaveLength(1);
  });

  // MARK: - Trip 메타데이터

  it('testTripMetadata: startAt/endAt/bbox', () => {
    const tz = 32400;
    const s = [
      sample('a', BUSAN.lat, BUSAN.lon, localEpoch(1300, 10, 0, tz)),
      sample('b', BUSAN.lat + 0.1, BUSAN.lon + 0.1, localEpoch(1300, 15, 0, tz)),
    ];
    const result = segment(s, makeSegmentConfig());
    expect(result.trips).toHaveLength(1);
    const trip = result.trips[0];
    expect(Math.abs(trip.startAt - localEpoch(1300, 10, 0, tz))).toBeLessThanOrEqual(0.5);
    expect(Math.abs(trip.endAt - localEpoch(1300, 15, 0, tz))).toBeLessThanOrEqual(0.5);
    expect(Math.abs(trip.bbox.minLat - BUSAN.lat)).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(trip.bbox.minLon - BUSAN.lon)).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(trip.bbox.maxLat - (BUSAN.lat + 0.1))).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(trip.bbox.maxLon - (BUSAN.lon + 0.1))).toBeLessThanOrEqual(1e-6);
  });

  // MARK: - config 주입 (③ 격리)

  it('testConfigInjectionJumpKMIsolatesRuleThree', () => {
    const tz = 32400;
    const day = 1410;
    const base: PhotoSample[] = [];
    for (let d = 0; d < 3; d++) {
      base.push(sample(`h${d}`, SEOUL.lat, SEOUL.lon, localEpoch(1400 + d, 22, 0, tz)));
    }
    base.push(sample('morning_home', SEOUL.lat, SEOUL.lon, localEpoch(day, 9, 0, tz)));
    base.push(sample('busan_noon', BUSAN.lat, BUSAN.lon, localEpoch(day, 12, 0, tz)));
    base.push(sample('busan_pm', BUSAN.lat + 0.1, BUSAN.lon, localEpoch(day, 16, 0, tz)));
    base.push(sample('busan_eve', BUSAN.lat + 0.2, BUSAN.lon, localEpoch(day, 20, 0, tz)));

    const def = segment(base, makeSegmentConfig());
    const defBusanStandalone = def.trips.some(
      (trip) =>
        trip.sampleIDs.every((id) => id.startsWith('busan')) && trip.sampleIDs.includes('busan_noon'),
    );
    expect(defBusanStandalone).toBe(true);

    const cfg = makeSegmentConfig({ jumpKM: 99999 });
    const big = segment(base, cfg);
    const bigBusanStandalone = big.trips.some((trip) =>
      trip.sampleIDs.every((id) => id.startsWith('busan')),
    );
    expect(bigBusanStandalone).toBe(false);
    const merged = big.trips.find((t) => t.sampleIDs.includes('busan_noon'));
    expect(merged?.sampleIDs.includes('morning_home')).toBe(true);
  });

  // MARK: - 핀 사진 트립 제외

  it('testExcludedSampleIDsDropTheirTripOnly', () => {
    const tz = 32400;
    const s = [
      sample('seoul_a', SEOUL.lat, SEOUL.lon, localEpoch(1200, 10, 0, tz)),
      sample('seoul_b', SEOUL.lat + 0.02, SEOUL.lon, localEpoch(1200, 14, 0, tz)),
      sample('busan_a', BUSAN.lat, BUSAN.lon, localEpoch(1205, 10, 0, tz)),
      sample('busan_b', BUSAN.lat + 0.02, BUSAN.lon, localEpoch(1205, 14, 0, tz)),
    ];
    expect(segment(s).trips).toHaveLength(2);

    const r = segment(s, undefined, new Set(['busan_a', 'busan_b']));
    expect(r.trips).toHaveLength(1);
    expect(r.trips.some((t) => t.sampleIDs.some((id) => id.startsWith('busan')))).toBe(false);
    expect(r.trips.some((t) => t.sampleIDs.includes('seoul_a'))).toBe(true);
  });

  it('testExcludedSampleIDsDoNotAffectHome', () => {
    const tz = 32400;
    const s: PhotoSample[] = [];
    for (let day = 0; day < 3; day++) {
      s.push(sample(`night${day}`, SEOUL.lat, SEOUL.lon, localEpoch(400 + day, 23, 0, tz)));
    }
    const full = segment(s);
    const excluded = segment(s, undefined, new Set(['night0']));
    expect(full.home).not.toBeNull();
    expect(excluded.home).toEqual(full.home);
  });

  // MARK: - internal static 헬퍼 직접 검증 (@testable 대응)

  it('hourOfDay: 현지 시(0~23), 음수 epoch도 안전', () => {
    const tz = 32400;
    expect(hourOfDay(sample('x', 0, 0, localEpoch(100, 23, 30, tz), tz))).toBe(23);
    expect(hourOfDay(sample('x', 0, 0, localEpoch(100, 0, 0, tz), tz))).toBe(0);
    // tzOffset 미적용시 야간 미인식: 파리 현지 21시 = UTC 20시
    const tzParis = 3600;
    expect(hourOfDay(sample('x', 0, 0, localEpoch(1, 21, 0, tzParis), tzParis))).toBe(21);
    // 음수 epoch (1970 이전 현지 날짜)
    expect(hourOfDay(sample('x', 0, 0, localEpoch(-1, 5, 0, tz), tz))).toBe(5);
  });

  it('localDay: 현지 날짜 버킷, 음수 epoch는 Math.floor', () => {
    const tz = 32400;
    expect(localDay(sample('x', 0, 0, localEpoch(100, 10, 0, tz), tz))).toBe(100);
    expect(localDay(sample('x', 0, 0, localEpoch(0, 0, 0, tz), tz))).toBe(0);
    expect(localDay(sample('x', 0, 0, localEpoch(-1, 12, 0, tz), tz))).toBe(-1);
  });

  it('isNight: wrap 경계 (start 포함, end 미포함)', () => {
    const cfg = makeSegmentConfig(); // start=21, end=6 (wrap)
    expect(isNight(21, cfg)).toBe(true); // start 포함
    expect(isNight(23, cfg)).toBe(true);
    expect(isNight(0, cfg)).toBe(true);
    expect(isNight(5, cfg)).toBe(true);
    expect(isNight(6, cfg)).toBe(false); // end 미포함
    expect(isNight(20, cfg)).toBe(false);
    expect(isNight(12, cfg)).toBe(false);
    // non-wrap 설정: start<=end
    const cfg2 = makeSegmentConfig({ nightStartHour: 1, nightEndHour: 5 });
    expect(isNight(1, cfg2)).toBe(true);
    expect(isNight(4, cfg2)).toBe(true);
    expect(isNight(5, cfg2)).toBe(false);
    expect(isNight(0, cfg2)).toBe(false);
  });

  it('haversineMeters: 거리(m), 동일점은 0', () => {
    expect(haversineMeters(SEOUL, SEOUL)).toBe(0);
    // 서울↔부산 약 325km
    const d = haversineMeters(SEOUL, BUSAN) / 1000;
    expect(Math.abs(d - 325)).toBeLessThanOrEqual(10);
    // 위도 1도 ≈ 111.19km (R=6371000)
    const oneDeg = haversineMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) / 1000;
    expect(Math.abs(oneDeg - 111.19)).toBeLessThanOrEqual(0.5);
  });

  it('makeSegmentConfig: 기본 상수 전부 보존', () => {
    const c = makeSegmentConfig();
    expect(c.jumpKM).toBe(90);
    expect(c.gapHours).toBe(8);
    expect(c.homeSuppressionRadiusKM).toBe(18);
    expect(c.stayShiftKM).toBe(40);
    expect(c.nightStartHour).toBe(21);
    expect(c.nightEndHour).toBe(6);
    expect(c.minHomeNights).toBe(3);
    expect(c.burstMeters).toBe(50);
    expect(c.burstSeconds).toBe(120);
    expect(c.homeClusterRadiusKM).toBe(18);
    expect(c.trivialMinPhotos).toBe(2);
    expect(c.trivialRadiusKM).toBe(5);
    expect(c.trivialDurationHours).toBe(4);
    // partial 오버라이드
    const c2 = makeSegmentConfig({ jumpKM: 99999 });
    expect(c2.jumpKM).toBe(99999);
    expect(c2.gapHours).toBe(8);
  });
});
