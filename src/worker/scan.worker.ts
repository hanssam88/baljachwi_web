// src/worker/scan.worker.ts — UI 비차단 스캔 워커.
// 12MB 매칭 geojson을 worker에서 1회 fetch·파싱·캐시 → scanPhotos(필터) → buildScanPipeline.
// 결과는 plain object(PipelineResult)라 구조화 복제로 메인에 반환.

/// <reference lib="webworker" />

import { scanPhotos } from '@/core/photoScan';
import { GeoDataStore, type RegionCodeEntry } from '@/core/geoDataStore';
import { RegionMatcher } from '@/core/regionMatcher';
import { JejuRefiningMatcher } from '@/core/jejuRefiningMatcher';
import { polygonsBySgg } from '@/core/geojsonDecode';
import type { JejuDong } from '@/core/jejuRefiner';
import { buildScanPipeline } from '@/core/scanPipeline';
import type { ScanRequest, ScanResponse } from '@/worker/protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

// geojson은 한 번만 로드(여러 번 가져오기해도 재파싱 안 함).
let matcherPromise: Promise<RegionMatcher> | null = null;

async function getMatcher(): Promise<RegionMatcher> {
  if (matcherPromise === null) {
    matcherPromise = (async () => {
      const [entriesRes, geoRes, jejuRes] = await Promise.all([
        fetch('/geo/region_codes.json'),
        fetch('/geo/sigungu.geojson'),
        fetch('/geo/jeju-emd.geojson'),
      ]);
      if (!entriesRes.ok || !geoRes.ok) {
        throw new Error('geo 데이터 로드 실패');
      }
      // 제주 동 asset도 실패 시 throw(silent degrade 금지). 누락 시 50110/50130이 저장되는데
      // 표시 geojson엔 두 시 피처가 없어 색 누락 + 분모 296 왜곡 → 조용히 넘기면 안 됨.
      if (!jejuRes.ok) {
        throw new Error(`jeju-emd.geojson load failed: ${jejuRes.status}`);
      }
      const entries = (await entriesRes.json()) as RegionCodeEntry[];
      const geojson = await geoRes.json();
      const jejuJson = await jejuRes.json();
      const store = new GeoDataStore(entries, geojson);
      const map = polygonsBySgg(jejuJson); // Map<adm_cd2, MultiPolygon>
      const dongs: JejuDong[] = [...map.entries()].map(([code, mp]) => ({ code, mp }));
      return new JejuRefiningMatcher(store, dongs);
    })();
    // 실패 시 거부 promise를 영구 캐시하지 않도록 메모 리셋(다음 호출서 재시도). 반환은 원본 promise라 거부는 표면화.
    matcherPromise.catch(() => { matcherPromise = null; });
  }
  return matcherPromise;
}

function post(msg: ScanResponse) {
  ctx.postMessage(msg);
}

ctx.addEventListener('message', async (e: MessageEvent<ScanRequest>) => {
  const req = e.data;
  if (!req || req.type !== 'scan') return;

  try {
    post({ type: 'progress', stage: 'loading-geo', done: 0, total: 1 });
    const matcher = await getMatcher();
    post({ type: 'progress', stage: 'loading-geo', done: 1, total: 1 });

    // 필터·dedup(청크 진행 보고). RawPhotoAsset[] → ScannedPhoto[].
    const total = req.photos.length;
    const scan = scanPhotos(req.photos, 200, (done) => {
      post({ type: 'progress', stage: 'matching', done, total });
    });

    post({ type: 'progress', stage: 'segmenting', done: 0, total: scan.photos.length });
    const result = buildScanPipeline(
      scan.photos,
      matcher,
      req.deviceOffsetSeconds,
      undefined,
      undefined,
      new Set(req.excludedTripSampleIDs),
    );
    post({ type: 'progress', stage: 'segmenting', done: scan.photos.length, total: scan.photos.length });

    post({ type: 'done', result });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
});
