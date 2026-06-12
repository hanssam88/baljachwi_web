// tests/data/repo.setWantToGo.test.ts
// @vitest-environment node
import 'fake-indexeddb/auto'; // jsdom 전역엔 IndexedDB 없음 — 누락 시 즉시 FAIL
import { describe, it, expect, beforeEach } from 'vitest';
import { BaljachwiDB } from '@/data/db';
import { makeRepo } from '@/data/repo';
import { makeRegionStatus } from '@/data/models';

let counter = 0; // 모듈 스코프 counter로 고유 DB명(performance.now 금지)
let db: BaljachwiDB;
let r: ReturnType<typeof makeRepo>;

beforeEach(async () => {
  db = new BaljachwiDB(`test-want-${counter++}`);
  r = makeRepo(db);
  await db.regionStatuses.bulkPut([
    makeRegionStatus({ regionCode: 'V1', level: 'sigungu', state: 'visited', photoCount: 2, firstVisit: 100, lastVisit: 300 }),
    makeRegionStatus({ regionCode: 'W1', level: 'sigungu', state: 'wantToGo', userOverride: true }),
  ]);
});

describe('repo.setWantToGo', () => {
  it('미방문(행 없음) + on=true → wantToGo 신규행 생성(override, photoCount 0)', async () => {
    await r.setWantToGo('N1', true);
    const row = (await r.allRegions()).find((x) => x.regionCode === 'N1');
    expect(row).toMatchObject({ state: 'wantToGo', level: 'sigungu', photoCount: 0, firstVisit: null, lastVisit: null, userOverride: true });
  });
  it('가고싶음 + on=false → 행 제거', async () => {
    await r.setWantToGo('W1', false);
    expect((await r.allRegions()).find((x) => x.regionCode === 'W1')).toBeUndefined();
  });
  it('방문 지역 + on=true → 변화 없음(visited 보존)', async () => {
    await r.setWantToGo('V1', true);
    expect((await r.allRegions()).find((x) => x.regionCode === 'V1')).toMatchObject({ state: 'visited', photoCount: 2 });
  });
  it('방문 지역 + on=false → 삭제 안 됨(데이터 손실 방지)', async () => {
    await r.setWantToGo('V1', false);
    expect((await r.allRegions()).find((x) => x.regionCode === 'V1')).toMatchObject({ state: 'visited' });
  });
});
