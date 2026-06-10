// PhotoScanService.swift → photoScan.ts 의 byte-faithful 포트 검증.
// Swift Tests/PhotoScanServiceTests.swift 의 9개 테스트 전건 포팅 + 카드 testsToPort.
//
// 시간은 epoch 초 정수 산술만 (JS Date 객체 금지).

import { describe, it, expect } from 'vitest';
import {
  scanPhotos,
  ORIGIN_EPSILON,
  DEFAULT_CHUNK_SIZE,
  type RawPhotoAsset,
} from '@/core/photoScan';

// 기준 시각(결정적). takenAt 비교용. Swift: Date(timeIntervalSince1970: 1_700_000_000).
const t0 = 1_700_000_000;

describe('scanPhotos — 보존 상수', () => {
  it('ORIGIN_EPSILON == 1e-7', () => {
    expect(ORIGIN_EPSILON).toBe(1e-7);
  });
  it('DEFAULT_CHUNK_SIZE == 1000', () => {
    expect(DEFAULT_CHUNK_SIZE).toBe(1000);
  });
});

describe('scanPhotos — 필터/dedup', () => {
  // testFiltersNonGeotaggedAndOrigin
  it('filtersNonGeotaggedAndOrigin: GPS 있는 1건만 통과', () => {
    const assets: RawPhotoAsset[] = [
      { localIdentifier: 'gps', latitude: 37.5, longitude: 127.0, takenAtEpoch: t0 },
      { localIdentifier: 'noloc', latitude: null, longitude: null, takenAtEpoch: t0 },
      { localIdentifier: 'origin', latitude: 0, longitude: 0, takenAtEpoch: t0 },
    ];
    const photos = scanPhotos(assets).photos;
    expect(photos.length).toBe(1);
    expect(photos[0]).toEqual({
      localIdentifier: 'gps',
      lat: 37.5,
      lon: 127.0,
      takenAt: 1_700_000_000,
    });
  });

  // testRawAssetIDsIncludesPreFilterIDs
  it('rawAssetIDsIncludesPreFilterIDs: rawAssetIDs 는 필터 전 전체 id', () => {
    const assets: RawPhotoAsset[] = [
      { localIdentifier: 'gps', latitude: 37.5, longitude: 127.0, takenAtEpoch: t0 },
      { localIdentifier: 'nogps', latitude: null, longitude: null, takenAtEpoch: t0 },
      { localIdentifier: 'nodate', latitude: 37.5, longitude: 127.0, takenAtEpoch: null },
      { localIdentifier: 'origin', latitude: 0, longitude: 0, takenAtEpoch: t0 },
    ];
    const output = scanPhotos(assets);
    // photos = 필터 통과(gps 1건).
    expect(output.photos.map((p) => p.localIdentifier)).toEqual(['gps']);
    // rawAssetIDs = pre-filter 전체 4건(필터 탈락분 포함). 집합 멤버십 비교(순서 무관).
    expect([...output.rawAssetIDs].sort()).toEqual(
      ['gps', 'nodate', 'nogps', 'origin'].sort()
    );
    expect(output.rawAssetIDs.size).toBe(4);
    expect(output.rawAssetIDs.has('gps')).toBe(true);
    expect(output.rawAssetIDs.has('nogps')).toBe(true);
    expect(output.rawAssetIDs.has('nodate')).toBe(true);
    expect(output.rawAssetIDs.has('origin')).toBe(true);
  });

  // testDedupKeepsFirstOccurrence
  it('dedupKeepsFirstOccurrence: 같은 id 첫 등장 값 유지', () => {
    const assets: RawPhotoAsset[] = [
      { localIdentifier: 'dup', latitude: 37.5, longitude: 127.0, takenAtEpoch: t0 },
      { localIdentifier: 'dup', latitude: 38.0, longitude: 128.0, takenAtEpoch: t0 + 60 },
    ];
    const photos = scanPhotos(assets).photos;
    expect(photos.length).toBe(1);
    // 첫 등장 값 유지 — 두 번째(38.0/128.0/t0+60)가 아니라 첫 번째(37.5/127.0/t0).
    expect(photos[0].lat).toBe(37.5);
    expect(photos[0].lon).toBe(127.0);
    expect(photos[0].takenAt).toBe(t0);
  });

  // testSkipsNilCreationDate
  it('skipsNilCreationDate: takenAt null 이면 좌표 유효해도 스킵', () => {
    const assets: RawPhotoAsset[] = [
      { localIdentifier: 'nodate', latitude: 37.5, longitude: 127.0, takenAtEpoch: null },
      { localIdentifier: 'ok', latitude: 36.0, longitude: 128.0, takenAtEpoch: t0 },
    ];
    const photos = scanPhotos(assets).photos;
    expect(photos.map((p) => p.localIdentifier)).toEqual(['ok']);
  });

  // testOriginFilterIsAndNotOr
  it('originFilterIsAndNotOr: (0,0)만 스킵, 한쪽만 0은 생존 (AND)', () => {
    const assets: RawPhotoAsset[] = [
      { localIdentifier: 'zerozero', latitude: 0, longitude: 0, takenAtEpoch: t0 },
      { localIdentifier: 'zerolon', latitude: 0, longitude: 50, takenAtEpoch: t0 },
      { localIdentifier: 'zerolat', latitude: 50, longitude: 0, takenAtEpoch: t0 },
    ];
    const photos = scanPhotos(assets).photos;
    expect(photos.map((p) => p.localIdentifier)).toEqual(['zerolon', 'zerolat']);
  });

  // testPreservesInputOrder
  it('preservesInputOrder: 입력 순서 보존', () => {
    const assets: RawPhotoAsset[] = Array.from({ length: 5 }, (_, i) => ({
      localIdentifier: `p${i}`,
      latitude: 37.0 + i,
      longitude: 127.0,
      takenAtEpoch: t0 + i,
    }));
    const photos = scanPhotos(assets).photos;
    expect(photos.map((p) => p.localIdentifier)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
  });

  // testEmptyLibraryReturnsEmpty
  it('emptyLibraryReturnsEmpty: 빈 입력 → 빈 결과 + progress 0회', () => {
    const reports: Array<{ processed: number; total: number }> = [];
    const output = scanPhotos([], DEFAULT_CHUNK_SIZE, (processed, total) => {
      reports.push({ processed, total });
    });
    expect(output.photos.length).toBe(0);
    expect(output.rawAssetIDs.size).toBe(0);
    // while index<0 진입 안 함 → progress(0,0) 호출하지 않음.
    expect(reports.length).toBe(0);
  });
});

describe('scanPhotos — 청크 진행보고', () => {
  // testChunkedProgressReporting
  it('chunkedProgressReporting: 2500건/1000 → [1000,2000,2500]', () => {
    const assets: RawPhotoAsset[] = Array.from({ length: 2500 }, (_, i) => ({
      localIdentifier: `p${i}`,
      latitude: 37.5,
      longitude: 127.0,
      takenAtEpoch: t0 + i,
    }));
    const reports: Array<{ processed: number; total: number }> = [];
    const photos = scanPhotos(assets, 1000, (processed, total) => {
      reports.push({ processed, total });
    }).photos;
    // progress 3회.
    expect(reports.length).toBe(3);
    // 모든 total == 2500.
    expect(reports.every((r) => r.total === 2500)).toBe(true);
    // 경계: 1000, 2000, 2500.
    expect(reports.map((r) => r.processed)).toEqual([1000, 2000, 2500]);
    // 최종 processed == total.
    expect(reports[reports.length - 1].processed).toBe(reports[reports.length - 1].total);
    // 모든 asset 유효 → 2500건, 순서 보존.
    expect(photos.length).toBe(2500);
    expect(photos.map((p) => p.localIdentifier)).toEqual(
      Array.from({ length: 2500 }, (_, i) => `p${i}`)
    );
  });

  // testProcessedCountsRawAssetsEvenWhenFiltered
  it('processedCountsRawAssetsEvenWhenFiltered: processed 는 raw 순회 수', () => {
    const assets: RawPhotoAsset[] = Array.from({ length: 1500 }, (_, i) => {
      const geotagged = i % 2 === 0;
      return {
        localIdentifier: `p${i}`,
        latitude: geotagged ? 37.5 : null,
        longitude: geotagged ? 127.0 : null,
        takenAtEpoch: t0,
      };
    });
    const reports: Array<{ processed: number; total: number }> = [];
    scanPhotos(assets, 1000, (processed, total) => {
      reports.push({ processed, total });
    });
    // 경계: 1000, 1500(마지막 부분 청크는 total로 캡).
    expect(reports.map((r) => r.processed)).toEqual([1000, 1500]);
    expect(reports[reports.length - 1].processed).toBe(1500);
    expect(reports[reports.length - 1].total).toBe(1500);
  });
});

describe('scanPhotos — chunkSize 보정 (MIN_CHUNK_STEP)', () => {
  it('chunkSize < 1 은 1로 보정 (step=max(1,chunkSize)) — 0/음수 무한루프 방지', () => {
    const assets: RawPhotoAsset[] = Array.from({ length: 3 }, (_, i) => ({
      localIdentifier: `p${i}`,
      latitude: 37.5,
      longitude: 127.0,
      takenAtEpoch: t0 + i,
    }));
    const reports: number[] = [];
    const photos = scanPhotos(assets, 0, (processed) => {
      reports.push(processed);
    }).photos;
    // step=1 보정 → 청크 경계 [1,2,3].
    expect(reports).toEqual([1, 2, 3]);
    expect(photos.length).toBe(3);
  });
});
