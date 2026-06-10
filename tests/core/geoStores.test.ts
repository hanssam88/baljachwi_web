// @vitest-environment node
//
// Swift BaljachwiCore GeoDataStoreTests / DisplayGeoStoreTests / RegionNamesTests 의 byte-faithful 포트.
//
// IO 경계 분리: Swift init은 Bundle.module에서 직접 읽지만, TS 코어는 파싱된 JSON을 생성자 인자로 받는다.
// 따라서 테스트가 로더 역할을 맡아 실제 데이터 파일(public/geo/*)을 fs로 읽어 JSON.parse 후 주입한다.
// 11MB sigungu.geojson 파싱은 node 환경에서 수행(jsdom 미사용).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { GeoDataStore, type RegionCodeEntry } from '@/core/geoDataStore';
import { DisplayGeoStore } from '@/core/displayGeoStore';
import { RegionNames, shorten } from '@/core/regionNames';

// ── 픽스처 로더 ───────────────────────────────────────────────────
// 매칭=11MB sigungu.geojson, 표시=sigungu_display/sido_display, 코드=region_codes.json.
// Swift Resources/와 동일 파일을 웹 레포 public/geo/에 두고 읽는다.
const GEO_DIR = fileURLToPath(new URL('../../public/geo/', import.meta.url));

function loadJSON(name: string): unknown {
  return JSON.parse(readFileSync(GEO_DIR + name, 'utf8'));
}

const regionCodes = loadJSON('region_codes.json') as RegionCodeEntry[];
// 매칭용 원본(11.9MB) — GeoDataStore + perf 테스트용. 한 번만 파싱해 재사용.
const sigunguGeoJSON = loadJSON('sigungu.geojson');
const sigunguDisplayGeoJSON = loadJSON('sigungu_display.geojson');
const sidoDisplayGeoJSON = loadJSON('sido_display.geojson');

// ──────────────────────────────────────────────────────────────────
// GeoDataStore
// ──────────────────────────────────────────────────────────────────

describe('geoDataStore', () => {
  // 11MB 디코드는 무겁기에 store를 한 번만 만든다(Swift는 매 테스트 new지만 결과 동일).
  const store = new GeoDataStore(regionCodes, sigunguGeoJSON);

  it('initDoesNotThrow — 실제 픽스처로 생성 시 throw 없음', () => {
    expect(() => new GeoDataStore(regionCodes, sigunguGeoJSON)).not.toThrow();
  });

  it('entryCounts — 272 = 255 sigungu + 17 sido', () => {
    expect(store.entries.length).toBe(272);
    expect(store.entries.filter((e) => e.level === 'sigungu').length).toBe(255);
    expect(store.entries.filter((e) => e.level === 'sido').length).toBe(17);
  });

  it('sigunguPolygonCount — sigungu 엔트리 255개 전부 디코드됨', () => {
    let decoded = 0;
    for (const entry of store.entries) {
      if (entry.level === 'sigungu' && store.polygon(entry.regionCode) !== undefined) {
        decoded += 1;
      }
    }
    expect(decoded).toBe(255);
  });

  it('regionCodeEntryFields — 종로구(11110) 필드 round-trip', () => {
    const jongno = store.entries.find((e) => e.regionCode === '11110');
    expect(jongno).toBeDefined();
    expect(jongno!.level).toBe('sigungu');
    expect(jongno!.nameKo).toBe('종로구');
    expect(jongno!.sidoCode).toBe('11');
    // bbox = [minLon, minLat, maxLon, maxLat] 4원소.
    expect(jongno!.bbox.length).toBe(4);
    expect(jongno!.bbox[0]).toBeLessThan(jongno!.bbox[2]); // minLon < maxLon
    expect(jongno!.bbox[1]).toBeLessThan(jongno!.bbox[3]); // minLat < maxLat
  });

  it('shinanMultiPolygonCount — 신안군 46910 = 191 polygon (실측)', () => {
    const mp = store.polygon('46910');
    expect(mp).toBeDefined();
    expect(mp!.polygons.length).toBe(191);
  });

  it('ongjinMultiPolygonCount — 옹진군 28720 = 77 polygon', () => {
    const mp = store.polygon('28720');
    expect(mp).toBeDefined();
    expect(mp!.polygons.length).toBe(77);
  });

  it('ulleungMultiPolygonCount — 울릉군 47940 = 5 polygon', () => {
    const mp = store.polygon('47940');
    expect(mp).toBeDefined();
    expect(mp!.polygons.length).toBe(5);
  });

  it('singlePolygonNormalizedToOne — 종로구 Polygon → MultiPolygon(1개)', () => {
    const mp = store.polygon('11110');
    expect(mp).toBeDefined();
    expect(mp!.polygons.length).toBe(1);
    expect(mp!.polygons[0].outer.length).toBeGreaterThanOrEqual(3);
  });

  it('coordinateOrdering — [lon,lat]→{lat,lon} 뒤집힘 회귀 방어', () => {
    const mp = store.polygon('11110');
    const first = mp!.polygons[0].outer[0];
    expect(first.lat).toBeGreaterThanOrEqual(37.0);
    expect(first.lat).toBeLessThanOrEqual(38.0);
    expect(first.lon).toBeGreaterThanOrEqual(126.0);
    expect(first.lon).toBeLessThanOrEqual(128.0);
  });

  it('unknownRegionReturnsUndefined — 미지 코드·시도 코드는 undefined', () => {
    expect(store.polygon('00000')).toBeUndefined();
    // 시도 코드는 시군구 폴리곤 맵에 없다.
    expect(store.polygon('11')).toBeUndefined();
  });

  it('decodePerformanceUnder2Seconds — 파싱+생성+접근 < 2.0초', () => {
    // Swift는 Bundle 읽기까지 포함하나 TS는 IO 분리 — 파싱+생성+접근만 측정.
    const start = performance.now();
    const s = new GeoDataStore(regionCodes, sigunguGeoJSON);
    // 폴리곤 디코드가 lazy가 아님을 보장하기 위해 실제 접근.
    void s.polygon('46910');
    const elapsed = (performance.now() - start) / 1000;
    expect(elapsed).toBeLessThan(2.0);
  });
});

// ──────────────────────────────────────────────────────────────────
// DisplayGeoStore
// ──────────────────────────────────────────────────────────────────

describe('displayGeoStore', () => {
  it('decodesAllSigungu — sigungu_display = 255', () => {
    const store = new DisplayGeoStore(sigunguDisplayGeoJSON);
    expect(store.polygons.size).toBe(255);
  });

  it('knownRegionPolygonsPresentAndNonEmpty — 서울 중구(11140)·부산 동구(26170)', () => {
    const store = new DisplayGeoStore(sigunguDisplayGeoJSON);
    const junggu = store.polygons.get('11140');
    const busanDonggu = store.polygons.get('26170');
    expect(junggu).toBeDefined();
    expect(busanDonggu).toBeDefined();
    expect(junggu!.polygons[0].outer.length).toBeGreaterThan(0);
  });

  it('bboxInKoreaRange — 한국 경위도 범위 + min<max', () => {
    const b = new DisplayGeoStore(sigunguDisplayGeoJSON).bbox;
    expect(b.minLon).toBeGreaterThan(124);
    expect(b.maxLon).toBeLessThan(132.5);
    expect(b.minLat).toBeGreaterThan(33);
    expect(b.maxLat).toBeLessThan(39);
    expect(b.minLat).toBeLessThan(b.maxLat);
    expect(b.minLon).toBeLessThan(b.maxLon);
  });

  it('dokdoAndArchipelagoPreserved — 독도/다도서 보존 회귀 방어', () => {
    const store = new DisplayGeoStore(sigunguDisplayGeoJSON);
    // 동쪽 경계가 독도(≈131.87)까지 — 130.9대로 잘리면 실패.
    expect(store.bbox.maxLon).toBeGreaterThan(131.8);
    // 울릉군은 독도 islet 포함 다중 polygon.
    const ulleung = store.polygons.get('47940');
    expect(ulleung).toBeDefined();
    expect(ulleung!.polygons.length).toBeGreaterThanOrEqual(3);
    // 신안·옹진 군도(섬 대량 누락 방어). 주의: display의 신안 키는 46900(매칭은 46910).
    expect(store.polygons.get('46900')!.polygons.length).toBeGreaterThan(20);
    expect(store.polygons.get('28720')!.polygons.length).toBeGreaterThan(20);
  });

  it('sidoLevelDecodes17 — sido_display + level="sido" = 17', () => {
    const store = new DisplayGeoStore(sidoDisplayGeoJSON, 'sido');
    expect(store.polygons.size).toBe(17);
    expect(store.polygons.get('11')).toBeDefined(); // 서울
    expect(store.polygons.get('26')).toBeDefined(); // 부산
    expect(store.bbox.maxLon).toBeGreaterThan(131.8); // 시도층도 독도 보존
  });
});

// ──────────────────────────────────────────────────────────────────
// RegionNames
// ──────────────────────────────────────────────────────────────────

describe('regionNames', () => {
  it('decodesDisambiguatedSigunguNames — "시도약칭 시군구명"', () => {
    const rn = new RegionNames(regionCodes);
    expect(rn.names.size).toBeGreaterThan(0);
    expect(rn.names.get('26470')).toBe('부산 연제구');
    expect(rn.names.get('11140')).toBe('서울 중구');
    expect(rn.names.get('11680')).toBe('서울 강남구');
  });

  it('sidoEntryKeepsFullName — 시도는 nameKo 그대로', () => {
    const rn = new RegionNames(regionCodes);
    expect(rn.names.get('26')).toBe('부산광역시');
  });

  it('shortenStripsAdministrativeSuffix — 접미사 제거 + 순서 보존', () => {
    expect(shorten('서울특별시')).toBe('서울');
    expect(shorten('부산광역시')).toBe('부산');
    expect(shorten('경기도')).toBe('경기');
    expect(shorten('강원특별자치도')).toBe('강원');
    // 아래 두 케이스가 접미사 순서 보존 검증 — '도'/'시'가 먼저 매칭되면 실패.
    expect(shorten('세종특별자치시')).toBe('세종');
    expect(shorten('제주특별자치도')).toBe('제주');
  });
});
