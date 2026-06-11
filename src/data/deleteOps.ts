// src/data/deleteOps.ts — 사용자 단건/일괄 사진 삭제(골든 reconcile에 없는 신규 경로).
// 골든 scanPipeline 5)단계 지역 집계 공식을 생존 PhotoRef에 그대로 적용해 sigungu RegionStatus 재계산.
// trips/home은 현재 UI 비노출 → 미터치(다음 스캔에서 정합화). 코어/reconcile/storeOps/db 미변경.
import type { PhotoRef } from '@/data/models';
import type { DataStore } from '@/data/storeOps';

const LEVEL_SIGUNGU = 'sigungu';

export interface RegionAgg {
  photoCount: number;
  firstVisit: number;
  lastVisit: number;
}

/** 생존 사진 → regionCode별 집계(count/min/max takenAt). regionCode=null 제외.
 *  scanPipeline.ts:157-181 공식과 동일(매처 재실행 없이 PhotoRef.regionCode 재사용). */
export function aggregateSigunguRegions(photos: ReadonlyArray<PhotoRef>): Map<string, RegionAgg> {
  const byRegion = new Map<string, RegionAgg>();
  for (const p of photos) {
    const code = p.regionCode;
    if (code === null) continue;
    const t = p.takenAt;
    const agg = byRegion.get(code);
    if (agg !== undefined) {
      agg.photoCount += 1;
      agg.firstVisit = Math.min(agg.firstVisit, t);
      agg.lastVisit = Math.max(agg.lastVisit, t);
    } else {
      byRegion.set(code, { photoCount: 1, firstVisit: t, lastVisit: t });
    }
  }
  return byRegion;
}

/** ids 사진 삭제 + sigungu 지역 재계산(생존0·비override→행 삭제, 생존有→카운트 갱신).
 *  userOverride(가고싶음)·sido·기타 level·trips·home은 보존. store 직접 변형. prune(storeOps:236-249) 계약 차용. */
export function deletePhotosFromStore(store: DataStore, ids: string[]): void {
  if (ids.length === 0) return;
  const toDelete = new Set(ids);

  store.photos = store.photos.filter((p) => !toDelete.has(p.localIdentifier));

  const agg = aggregateSigunguRegions(store.photos);

  store.regions = store.regions.filter((r) => {
    if (r.level !== LEVEL_SIGUNGU) return true; // sido 등 비후보 보존
    // userOverride 면제: 현 코드상 override는 setWantToGo의 '가고싶음'(photoCount=0)만 생성 → 삭제/재계산 모두 면제.
    // (storeOps.prune은 '삭제'만 면제하나, 여기선 visited+override 생성 경로가 없어 동일 결과.)
    if (r.userOverride) return true;
    const a = agg.get(r.regionCode);
    if (a === undefined) return false; // 생존 사진 0 → 삭제
    r.state = 'visited'; // 골든 upsert 불변식(storeOps:146): 사진 있는 sigungu = 항상 visited(방어적 명시)
    r.photoCount = a.photoCount; // 생존 有 → 재계산
    r.firstVisit = a.firstVisit;
    r.lastVisit = a.lastVisit;
    return true;
  });
}
