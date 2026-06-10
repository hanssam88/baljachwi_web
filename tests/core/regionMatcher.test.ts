// @vitest-environment node
//
// Swift BaljachwiCore RegionMatcherTests 의 byte-faithful 포트.
//
// IO 경계 분리: Swift는 GeoDataStore()가 Bundle.module에서 직접 읽지만, TS 코어는 파싱된 JSON을
// 생성자 인자로 받는다. 따라서 테스트가 로더 역할을 맡아 실제 데이터 파일(public/geo/*)을 fs로 읽어
// JSON.parse 후 주입한다. 12MB sigungu.geojson 파싱은 node 환경에서 수행(jsdom 미사용).
//
// 골든셋 12개 전부 실데이터 의존(합성 픽스처 금지) — 경계 흡수 33m 케이스는 실제 울릉도 해안선에 의존.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { GeoDataStore, type RegionCodeEntry } from '@/core/geoDataStore';
import { RegionMatcher } from '@/core/regionMatcher';

// ── 픽스처 로더 ───────────────────────────────────────────────────
// Swift Resources/와 동일 파일을 웹 레포 public/geo/에 두고 읽는다.
const GEO_DIR = fileURLToPath(new URL('../../public/geo/', import.meta.url));

function loadJSON(name: string): unknown {
  // 골든 로드 실패 시 skip 금지 — readFileSync가 throw하면 그대로 전파.
  return JSON.parse(readFileSync(GEO_DIR + name, 'utf8'));
}

const regionCodes = loadJSON('region_codes.json') as RegionCodeEntry[];
const sigunguGeoJSON = loadJSON('sigungu.geojson');

const store = new GeoDataStore(regionCodes, sigunguGeoJSON);
const matcher = new RegionMatcher(store);

// ──────────────────────────────────────────────────────────────────
// 골든셋(내부 매칭)
// ──────────────────────────────────────────────────────────────────

describe('regionMatcher — 골든셋 내부 매칭', () => {
  it('seoulCityHall — 서울시청 → 11140 (서울 중구)', () => {
    expect(matcher.regionCode({ lat: 37.5663, lon: 126.9779 })).toBe('11140');
  });

  it('gwanghwamun — 광화문 → 11110 (종로구)', () => {
    expect(matcher.regionCode({ lat: 37.5759, lon: 126.9769 })).toBe('11110');
  });

  it('busanStation — 부산역 → 26170 (부산 동구)', () => {
    expect(matcher.regionCode({ lat: 35.1151, lon: 129.0413 })).toBe('26170');
  });

  it('jejuAirport — 제주공항 → 50110 (제주시)', () => {
    expect(matcher.regionCode({ lat: 33.5070, lon: 126.4927 })).toBe('50110');
  });

  it('baengnyeongdoMultiIsland — 백령도 → 28720 (옹진군, 다도서 매칭)', () => {
    expect(matcher.regionCode({ lat: 37.9660, lon: 124.7050 })).toBe('28720');
  });

  it('gunwi — 군위 → 27720 (군위군)', () => {
    expect(matcher.regionCode({ lat: 36.2428, lon: 128.5728 })).toBe('27720');
  });
});

// ──────────────────────────────────────────────────────────────────
// 거부(null)
// ──────────────────────────────────────────────────────────────────

describe('regionMatcher — 거부(null)', () => {
  it('parisReturnsNil — Paris → null (한국 bbox 밖)', () => {
    expect(matcher.regionCode({ lat: 48.8566, lon: 2.3522 })).toBeNull();
  });

  it('originReturnsNil — (0,0) → null (프리필터 배제)', () => {
    expect(matcher.regionCode({ lat: 0, lon: 0 })).toBeNull();
  });

  it('outsideKoreaBboxReturnsNil — lat 40.0 > maxLat 38.9 → null', () => {
    expect(matcher.regionCode({ lat: 40.0, lon: 128.0 })).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// sanity bridge (regionCode → nameKo)
// ──────────────────────────────────────────────────────────────────

describe('regionMatcher — sanity bridge', () => {
  it('sanityBridgeSeoulJunggu — 11140 ↔ nameKo === "중구"', () => {
    const code = matcher.regionCode({ lat: 37.5663, lon: 126.9779 });
    expect(code).toBe('11140');
    const name = store.entries.find((e) => e.regionCode === code)?.nameKo;
    expect(name).toBe('중구');
  });

  it('sanityBridgeBusanDonggu — 부산역 코드의 nameKo가 "동구" 포함', () => {
    const code = matcher.regionCode({ lat: 35.1151, lon: 129.0413 });
    expect(code).not.toBeNull();
    const name = store.entries.find((e) => e.regionCode === code)?.nameKo;
    expect(name).toBeDefined();
    expect(name!.includes('동구')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// 경계 흡수(≤100m) — secondary (4-b 경로)
// ──────────────────────────────────────────────────────────────────

describe('regionMatcher — 경계 흡수', () => {
  it('boundaryAbsorptionNearUlleung — 울릉 해안 약 33m 바다 위 점 → 47940', () => {
    // 어떤 폴리곤에도 미포함, 경계 거리 ≤100m이므로 가장 가까운 울릉군(47940)으로 흡수.
    expect(matcher.regionCode({ lat: 37.532649, lon: 130.908069 })).toBe('47940');
  });
});
