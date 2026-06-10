// @vitest-environment node
// 샘플 7장으로 전체 가져오기 파이프라인을 헤드리스 검증(브라우저 검증의 데이터 기반 보강).
// exif 추출 → 필터 → 실 geojson 매칭 → 여행분할 → reconcile(인메모리 store).
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractExif, fileLocalIdentifier } from '@/lib/exif';
import { scanPhotos, type RawPhotoAsset } from '@/core/photoScan';
import { GeoDataStore, type RegionCodeEntry } from '@/core/geoDataStore';
import { RegionMatcher } from '@/core/regionMatcher';
import { buildScanPipeline } from '@/core/scanPipeline';
import { createEmptyStore } from '@/data/storeOps';
import { reconcile } from '@/data/reconcile';

const SAMPLE_DIR = resolve(__dirname, '../../samples');
const GEO_DIR = resolve(__dirname, '../../public/geo');

const SAMPLES = [
  'seoul-1.jpg', 'seoul-2.jpg', 'seoul-3.jpg',
  'busan-1.jpg', 'busan-2.jpg', 'jeju-1.jpg', 'jeju-2.jpg',
];

// samples/ 는 gitignore — 없으면 스킵(스크립트 미실행 환경). 로컬 검증 시 node scripts/make-geotagged.mjs.
const haveSamples = SAMPLES.every((s) => existsSync(resolve(SAMPLE_DIR, s)));
const d = haveSamples ? describe : describe.skip;

d('샘플 파이프라인(전체 골든패스)', () => {
  let matcher: RegionMatcher;

  beforeAll(() => {
    const entries = JSON.parse(readFileSync(resolve(GEO_DIR, 'region_codes.json'), 'utf8')) as RegionCodeEntry[];
    const geojson = JSON.parse(readFileSync(resolve(GEO_DIR, 'sigungu.geojson'), 'utf8'));
    matcher = new RegionMatcher(new GeoDataStore(entries, geojson));
  });

  it('7장 → 시군구 7곳 visited + 여행 3개(서울/부산/제주)', async () => {
    // 1) exif 추출(메인 경로 그대로). deviceOffset 0(EXIF 오프셋 우선).
    const assets: RawPhotoAsset[] = [];
    for (const name of SAMPLES) {
      const buf = readFileSync(resolve(SAMPLE_DIR, name));
      const { latitude, longitude, takenAtEpoch } = await extractExif(buf, 0);
      assets.push({
        localIdentifier: fileLocalIdentifier({ name, size: buf.length, lastModified: 0 }),
        latitude,
        longitude,
        takenAtEpoch,
      });
    }

    // 2) 필터 → 3) 매칭·여행분할.
    const scan = scanPhotos(assets);
    expect(scan.photos).toHaveLength(7); // 전부 지오태그+시간 보유

    const result = buildScanPipeline(scan.photos, matcher, 0);

    // 시군구 7곳 색칠.
    const visitedCodes = result.regions.map((r) => r.regionCode).sort();
    expect(visitedCodes).toEqual(['11110', '11140', '11170', '26170', '26350', '50110', '50130']);

    // 여행 3개(날짜 gap 44h·도시 jump>90km로 분할).
    expect(result.trips).toHaveLength(3);
    // 대표지역 시도(앞 2자리) 집합 = 서울11·부산26·제주50.
    const sidos = result.trips.map((t) => t.representativeRegionCode?.slice(0, 2)).sort();
    expect(sidos).toEqual(['11', '26', '50']);

    // 4) reconcile(인메모리) → 지역지도 색칠 소스 확인.
    const store = createEmptyStore();
    const rec = reconcile(store, result);
    expect(rec.applied.insertedPhotos).toBe(7);
    const sigunguVisited = store.regions.filter((r) => r.level === 'sigungu' && r.state === 'visited');
    expect(sigunguVisited).toHaveLength(7);
    // 정복률 7/255 → Math.round(7/255*100) = 3%
    expect(Math.round((sigunguVisited.length / 255) * 100)).toBe(3);
  });
});
