// TripMetrics(순수 헬퍼) 골든 테스트 — Swift TripMetricsTests.swift 의 byte-faithful 포트.
// 대표코드 tie-break는 ScanPipeline 시나리오6(11140/11110 동률→11110)과 동일해야 한다(공유 진실).
import { describe, it, expect } from 'vitest';
import {
  computeTripMetrics,
  representativeRegionCode,
  type TripMetricsInput,
} from '@/core/tripMetrics';

/** Swift testcase helper: input(lat, lon, t, region) — takenAt은 epoch 초(number). */
function input(
  lat: number,
  lon: number,
  t: number,
  region: string | null,
): TripMetricsInput {
  return { lat, lon, takenAt: t, regionCode: region };
}

describe('computeTripMetrics', () => {
  // 빈 입력 → null(호출부 가드 후 unwrap 계약).
  it('computeEmptyReturnsNil', () => {
    expect(computeTripMetrics([])).toBeNull();
  });

  // bbox = lat/lon min·max, startAt/endAt = takenAt min·max, 대표코드 = 최빈(null 제외).
  // 입력을 시간 역순·좌표 뒤섞어 줘도 min/max로 정규화됨을 본다.
  it('computeMetricsFromPhotos', () => {
    const photos = [
      input(37.4, 127.1, 100, '11140'),
      input(37.6, 126.9, 300, null), // null regionCode → 대표코드 집계서 제외
      input(37.5, 127.0, 200, '11140'),
    ];
    const m = computeTripMetrics(photos);
    expect(m).not.toBeNull();
    expect(m!.bbox).toEqual({
      minLat: 37.4,
      minLon: 126.9,
      maxLat: 37.6,
      maxLon: 127.1,
    });
    expect(m!.startAt).toBe(100);
    expect(m!.endAt).toBe(300);
    expect(m!.representativeRegionCode).toBe('11140'); // null 제외 후 최빈
  });

  // 전부 null regionCode → 대표코드 null(bbox/dates는 정상).
  it('computeAllNilRegionGivesNilRep', () => {
    const m = computeTripMetrics([
      input(35.1, 129.0, 10, null),
      input(35.2, 129.1, 20, null),
    ]);
    expect(m).not.toBeNull();
    expect(m!.representativeRegionCode).toBeNull();
    expect(m!.startAt).toBe(10);
    expect(m!.endAt).toBe(20);
    // bbox도 정상 산출됨을 함께 단언.
    expect(m!.bbox).toEqual({
      minLat: 35.1,
      minLon: 129.0,
      maxLat: 35.2,
      maxLon: 129.1,
    });
  });
});

describe('representativeRegionCode (canonical tie-break)', () => {
  // 동률 → regionCode 오름차순 최소. ScanPipeline 시나리오6과 동일 진실(11140:11110 = 2:2 → 11110).
  it('representativeTieBreakSmallestCode', () => {
    expect(
      representativeRegionCode(['11140', '11140', '11110', '11110']),
    ).toBe('11110');
  });

  // 명확한 최빈은 빈도 우선.
  it('representativeMostFrequentWins', () => {
    expect(representativeRegionCode(['26170', '26170', '11110'])).toBe('26170');
  });

  // 빈 입력 → null.
  it('representativeEmptyReturnsNil', () => {
    expect(representativeRegionCode([])).toBeNull();
  });
});
