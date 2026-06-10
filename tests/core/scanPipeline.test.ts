// @vitest-environment node
//
// Swift BaljachwiCore ScanPipelineTests 의 byte-faithful 포트.
//
// 통합 배선 검증: 스캔 결과(ScannedPhoto) → 타임존 + 지역매칭 + 여행분리 + 지역집계를 묶어
// plain 값타입(PipelineResult)을 반환하는 순수·결정적 파이프라인의 배선 정확성을 단언한다.
// (개별 알고리즘 동작은 RegionMatcher/TripSegmenter 기존 테스트가 커버하므로
//  여기서는 통합/조립/결정성에 집중한다.)
//
// IO 경계 분리: 실데이터(12MB sigungu.geojson) 기반 RegionMatcher가 필요하다.
// node 환경에서 fs로 실데이터 파일(public/geo/*)을 읽어 GeoDataStore → RegionMatcher를
// beforeAll에서 1회만 생성·공유한다(디코드 비용 때문에 매 테스트 재로드 금지).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';

import { GeoDataStore, type RegionCodeEntry } from '@/core/geoDataStore';
import { RegionMatcher } from '@/core/regionMatcher';
import type { ScannedPhoto } from '@/core/photoScan';
import { buildScanPipeline } from '@/core/scanPipeline';

// ── 실데이터 기반 RegionMatcher (1회만 로드) ───────────────────────
const GEO_DIR = fileURLToPath(new URL('../../public/geo/', import.meta.url));

function loadJSON(name: string): unknown {
  return JSON.parse(readFileSync(GEO_DIR + name, 'utf8'));
}

let matcher: RegionMatcher;

beforeAll(() => {
  const regionCodes = loadJSON('region_codes.json') as RegionCodeEntry[];
  const sigunguGeoJSON = loadJSON('sigungu.geojson');
  const store = new GeoDataStore(regionCodes, sigunguGeoJSON);
  matcher = new RegionMatcher(store);
});

// ── 골든 좌표(RegionMatcher 기존 테스트로 사전 검증된 ground-truth) ──
const seoulCityHall = { lat: 37.5663, lon: 126.9779 }; // → "11140"(중구)
const gwanghwamun = { lat: 37.5759, lon: 126.9769 }; // → "11110"(종로구)
const busanStation = { lat: 35.1151, lon: 129.0413 }; // → "26170"
const jejuAirport = { lat: 33.5070, lon: 126.4927 }; // → "50110"
const paris = { lat: 48.8566, lon: 2.3522 }; // → null(해외)

// 디바이스 오프셋은 KST(+9h). 한국 좌표는 tzOffset이 bbox로 항상 KST를 반환하지만,
// 해외 좌표 폴백을 위해 명시한다.
const deviceKST = 32400;

// 결정적 기준 epoch. 2024-01-01 00:00:00 UTC.
const base = 1_704_067_200;

/** 결정적 epoch로 ScannedPhoto 생성. */
function photo(
  id: string,
  coord: { lat: number; lon: number },
  epoch: number,
): ScannedPhoto {
  return { localIdentifier: id, lat: coord.lat, lon: coord.lon, takenAt: epoch };
}

// ── 시나리오 1: 서울 지역 사진 여러 장 집계 ──
describe('ScanPipeline — 통합 배선', () => {
  it('testSeoulRegionAggregation — 서울 5장 전원 11140, regions 집계 정확', () => {
    const scanned = [
      photo('s1', seoulCityHall, base + 0 * 3600),
      photo('s2', seoulCityHall, base + 1 * 3600),
      photo('s3', seoulCityHall, base + 2 * 3600),
      photo('s4', seoulCityHall, base + 3 * 3600),
      photo('s5', seoulCityHall, base + 5 * 3600), // 지속 5h → 비사소
    ];
    const result = buildScanPipeline(scanned, matcher, deviceKST);

    expect(result.photos).toHaveLength(5);
    expect(result.photos.every((p) => p.regionCode === '11140')).toBe(true);

    const seoul = result.regions.find((r) => r.regionCode === '11140');
    expect(seoul).toBeDefined();
    expect(seoul!.photoCount).toBe(5);
    expect(seoul!.firstVisit).toBe(base + 0 * 3600);
    expect(seoul!.lastVisit).toBe(base + 5 * 3600); // 1704085200
  });

  // ── 시나리오 2: 해외(파리) 사진 → regionCode null, regions 미포함 ──
  it('testOverseasPhotoExcludedFromRegions — 해외 사진 regionCode null, regions 빈 배열', () => {
    const scanned = [
      photo('p1', paris, base + 0 * 3600),
      photo('p2', paris, base + 2 * 3600),
    ];
    const result = buildScanPipeline(scanned, matcher, deviceKST);

    expect(result.photos.every((p) => p.regionCode === null)).toBe(true);
    expect(result.regions).toEqual([]);
  });

  // ── 시나리오 3: 여행 분리(서울 home + 부산 원거리 여행) ──
  it('testBusanTripWithSeoulHome — 서울 home 탐지, 부산 trip 1개', () => {
    const scanned: ScannedPhoto[] = [];

    // 서울 home: 3일치 야간 사진(KST 23시대). base = KST 09:00, KST 23:00 = base + 14*3600.
    for (let d = 0; d < 3; d++) {
      const nightEpoch = base + 14 * 3600 + d * 86400; // KST 23:00, day d
      scanned.push(photo(`h${d}a`, seoulCityHall, nightEpoch));
      scanned.push(photo(`h${d}b`, seoulCityHall, nightEpoch + 1800)); // +30m, 같은 밤
    }

    // 부산 여행: 4일째에 부산으로 점프. 비사소(지속 ≥4h) + home에서 >90km.
    const tripDay = base + 4 * 86400;
    scanned.push(photo('b1', busanStation, tripDay + 0 * 3600));
    scanned.push(photo('b2', busanStation, tripDay + 1 * 3600));
    scanned.push(photo('b3', busanStation, tripDay + 2 * 3600));
    scanned.push(photo('b4', busanStation, tripDay + 5 * 3600)); // 지속 5h → 비사소

    const result = buildScanPipeline(scanned, matcher, deviceKST);

    // home은 서울 근처로 탐지되어야 한다.
    expect(result.home).not.toBeNull();

    // 부산 여행 1개만 남는다(서울 home-area 억제).
    expect(result.trips).toHaveLength(1);
    const trip = result.trips[0];
    expect(trip.representativeRegionCode).toBe('26170');
    expect(trip.sampleIDs).toEqual(['b1', 'b2', 'b3', 'b4']);

    // 부산 사진의 tripID/sortIndex 정확(시간순 0,1,2,3).
    const tripID = trip.id;
    const byID = new Map(result.photos.map((p) => [p.localIdentifier, p]));
    ['b1', 'b2', 'b3', 'b4'].forEach((sid, i) => {
      expect(byID.get(sid)!.tripID).toBe(tripID);
      expect(byID.get(sid)!.sortIndex).toBe(i);
    });

    // 서울 home 사진은 여행에 속하지 않음 → tripID null, sortIndex 0.
    for (let d = 0; d < 3; d++) {
      for (const suffix of ['a', 'b']) {
        const id = `h${d}${suffix}`;
        expect(byID.get(id)!.tripID).toBeNull();
        expect(byID.get(id)!.sortIndex).toBe(0);
      }
    }
  });

  // ── 시나리오 4: trip id 결정성(같은 입력 2회 → 동일 id) ──
  it('testTripIDDeterminism — trip id 결정적, 포맷 검증', () => {
    const scanned = [
      photo('d1', busanStation, base + 0 * 3600),
      photo('d2', busanStation, base + 1 * 3600),
      photo('d3', busanStation, base + 2 * 3600),
      photo('d4', busanStation, base + 5 * 3600),
    ];
    const r1 = buildScanPipeline(scanned, matcher, deviceKST);
    const r2 = buildScanPipeline(scanned, matcher, deviceKST);

    expect(r1.trips.length).toBeGreaterThan(0);
    expect(r1.trips.map((t) => t.id)).toEqual(r2.trips.map((t) => t.id));

    const trip = r1.trips[0];
    const expectedID = `${Math.trunc(trip.startAt)}_${trip.sampleIDs[0] ?? ''}`;
    expect(trip.id).toBe(expectedID);
    expect(trip.id).toBe('1704067200_d1');
  });

  // ── 시나리오 5: 입력 순서 보존 + regions 오름차순 정렬 ──
  it('testInputOrderPreservedAndRegionsSorted — photos 입력순, regions 오름차순', () => {
    // 입력 순서를 일부러 부산 → 서울 → 제주로 섞는다.
    const scanned = [
      photo('x1', busanStation, base + 10 * 3600),
      photo('x2', seoulCityHall, base + 0 * 3600),
      photo('x3', jejuAirport, base + 5 * 3600),
    ];
    const result = buildScanPipeline(scanned, matcher, deviceKST);

    expect(result.photos.map((p) => p.localIdentifier)).toEqual(['x1', 'x2', 'x3']);

    const codes = result.regions.map((r) => r.regionCode);
    expect(codes).toEqual([...codes].sort());
    expect(codes).toEqual(['11140', '26170', '50110']);
  });

  // ── 시나리오 6: representativeRegionCode 동률 → regionCode 오름차순 ──
  it('testRepresentativeRegionCodeTieBreak — 2:2 동률 시 오름차순 최소(11110)', () => {
    const scanned = [
      photo('t1', seoulCityHall, base + 0 * 3600), // 11140
      photo('t2', gwanghwamun, base + 2 * 3600), // 11110
      photo('t3', seoulCityHall, base + 4 * 3600), // 11140
      photo('t4', gwanghwamun, base + 6 * 3600), // 11110, 지속 6h → 비사소
    ];
    const result = buildScanPipeline(scanned, matcher, deviceKST);

    expect(result.trips).toHaveLength(1);
    // codes = [11140,11140,11110,11110] → 2:2 동률 → 오름차순 최소 11110.
    expect(result.trips[0].representativeRegionCode).toBe('11110');
  });

  // ── localTZoffsetSeconds 배선(한국 좌표는 KST) ──
  it('testKoreaCoordinateGetsKST — 한국 좌표는 deviceOffset 무관 KST', () => {
    const scanned = [photo('k1', seoulCityHall, base)];
    // deviceOffset을 일부러 UTC(0)로 줘도 한국 bbox 좌표는 KST(+9h).
    const result = buildScanPipeline(scanned, matcher, 0);
    expect(result.photos[0].localTZoffsetSeconds).toBe(32400);
  });

  // ── excludedTripSampleIDs: 핀 사진은 트립에서만 제외, regions/photos/home 유지 ──
  it('testExcludedTripSampleIDsKeepRegionsPhotosHome — 핀 제외해도 regions/photos/home 유지', () => {
    const scanned: ScannedPhoto[] = [];
    for (let d = 0; d < 3; d++) {
      const nightEpoch = base + 14 * 3600 + d * 86400;
      scanned.push(photo(`h${d}a`, seoulCityHall, nightEpoch));
      scanned.push(photo(`h${d}b`, seoulCityHall, nightEpoch + 1800));
    }
    const tripDay = base + 4 * 86400;
    scanned.push(photo('b1', busanStation, tripDay + 0 * 3600));
    scanned.push(photo('b2', busanStation, tripDay + 1 * 3600));
    scanned.push(photo('b3', busanStation, tripDay + 2 * 3600));
    scanned.push(photo('b4', busanStation, tripDay + 5 * 3600));

    const r = buildScanPipeline(scanned, matcher, deviceKST, undefined, undefined, new Set(['b1', 'b2', 'b3', 'b4']));

    expect(r.trips).toEqual([]); // 핀된 부산 사진 → 유령 trip 없음
    expect(r.home).not.toBeNull(); // home은 전체 스캔 기준 유지(서울)
    expect(r.photos).toHaveLength(10); // photos는 전체(핀 포함) 유지
    expect(r.regions.find((rg) => rg.regionCode === '26170')).toBeDefined(); // 부산 집계 유지
  });
});
