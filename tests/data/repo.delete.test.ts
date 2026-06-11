// tests/data/repo.delete.test.ts
// @vitest-environment node
import 'fake-indexeddb/auto'; // ← 기존 repo.test.ts와 동일(jsdom 전역 환경엔 IndexedDB 없음, 누락 시 즉시 FAIL)
import { describe, it, expect, beforeEach } from 'vitest';
import { BaljachwiDB } from '@/data/db';
import { makeRepo } from '@/data/repo';
import { makePhotoRef, makeRegionStatus } from '@/data/models';

const KST = 32400;
let counter = 0; // 기존 repo.test.ts 격리 컨벤션: 모듈 스코프 counter로 고유 DB명(performance.now 금지).
let db: BaljachwiDB;
let r: ReturnType<typeof makeRepo>;

beforeEach(async () => {
  db = new BaljachwiDB(`test-delete-${counter++}`);
  r = makeRepo(db);
  await db.photoRefs.bulkPut([
    makePhotoRef({ localIdentifier: 'a', lat: 33, lon: 126, takenAt: 100, localTZoffsetSeconds: KST, regionCode: 'R1' }),
    makePhotoRef({ localIdentifier: 'b', lat: 33, lon: 126, takenAt: 300, localTZoffsetSeconds: KST, regionCode: 'R1' }),
    makePhotoRef({ localIdentifier: 'c', lat: 33, lon: 126, takenAt: 200, localTZoffsetSeconds: KST, regionCode: 'R2' }),
  ]);
  await db.regionStatuses.bulkPut([
    makeRegionStatus({ regionCode: 'R1', level: 'sigungu', state: 'visited', photoCount: 2, firstVisit: 100, lastVisit: 300 }),
    makeRegionStatus({ regionCode: 'R2', level: 'sigungu', state: 'visited', photoCount: 1, firstVisit: 200, lastVisit: 200 }),
  ]);
  // 썸네일 행(fake-indexeddb structured-clone 제약 회피 위해 Blob 대신 빈 객체 캐스팅 — db.ts:20 주석 패턴).
  await db.thumbs.bulkPut([{ localIdentifier: 'c', data: {} as Blob }]);
});

describe('repo.deletePhotos', () => {
  it('사진 + 빈 지역 삭제, 생존 지역 재계산', async () => {
    await r.deletePhotos(['c']);
    expect((await r.allPhotos()).map((p) => p.localIdentifier).sort()).toEqual(['a', 'b']);
    expect((await r.allRegions()).map((x) => x.regionCode).sort()).toEqual(['R1']);
  });
  it('삭제 사진의 썸네일도 제거', async () => {
    await r.deletePhotos(['c']);
    expect(await db.thumbs.get('c')).toBeUndefined();
  });
  it('빈 배열 no-op', async () => {
    await r.deletePhotos([]);
    expect(await r.allPhotos()).toHaveLength(3);
  });
});
