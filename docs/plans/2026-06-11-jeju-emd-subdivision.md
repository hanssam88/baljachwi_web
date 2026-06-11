# 제주 읍·면·동 세분화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 또는 superpowers:executing-plans 로 task-by-task 구현. 각 스텝은 `- [ ]` 체크박스.

**Goal:** 제주(시군구 레벨에 제주시·서귀포시 2개 = 각 섬의 절반)를 43개 읍·면·동으로 세분화해, 사진 한 장이 섬 절반이 아니라 내륙 구(區)와 비슷한 작은 단위만 색칠하도록 한다.

**Architecture:** 매핑 코어(`regionMatcher`/`scanPipeline`/`regionAggregate`/`regionNames`/`pointInPolygon`)는 **byte-faithful 불변**(골든 290 무영향). 제주 세분화는 **코어를 감싸는 데코레이터 + 빌드시 데이터 스플라이스**로만 구현한다:
1. 1차 매처(기존, 불변)가 50110/50130 반환 → **2차 레이어**(`JejuRefiningMatcher extends RegionMatcher`)가 좌표를 43개 동 폴리곤에 point-in-polygon → 동 코드(`adm_cd2`, 10자리) 반환.
2. 표시·코드·이름은 빌드 스크립트(`copy-geo.mjs`)가 제주 2피처를 43동으로 **스플라이스**(표시 geojson·region_codes)해서 주입. 정복률 분모 255→296.

**Tech Stack:** Next.js 15 / React 19 / TS, Web Worker, MapLibre(feature-state), Vitest. 데이터 소스: vuski/admdongkor `ver20260201`(통계청 SGIS 기반 2026 행정동 경계, KOGL 출처표시).

---

## 불변식 (절대 변경 금지)

- `src/core/regionMatcher.ts`, `src/core/scanPipeline.ts`, `src/core/regionAggregate.ts`, `src/core/regionNames.ts`, `src/core/pointInPolygon.ts`, `src/core/mapViewport.ts` — **수정 0줄**. 골든 290 통과 유지.
- 기존 매처는 계속 50110/50130을 반환한다(코어 입력 region_codes에 동 엔트리는 `level:'emd'`로 넣어 `level==='sigungu'` 필터가 배제 → `polygonOrThrow` 크래시 없음).

## 핵심 데이터 사실 (검증 완료)

- vuski 전국 행정동 3558피처 중 **제주 43피처**(제주시 50110=26, 서귀포시 50130=17). 동명 충돌 0. 코드 전부 10자리 `adm_cd2`(앞5=시군구).
- `regionAggregate.sidoStates`는 `code.slice(0,2)` 그룹 → 동 코드 "5011025000"→"50"→제주 sido로 정상 롤업(**변경 불필요**).
- `regionNames`는 비-sigungu 엔트리를 else 분기에서 `nameKo` 그대로 사용 → `level:'emd'` 엔트리의 `nameKo`를 "제주 한림읍"으로 미리 포맷하면 **코어 수정 없이** 이름 해결.
- `geojsonDecode.polygonsBySgg(json)` → `Map<sgg, MultiPolygon>`. 제주 동 asset의 `sgg`를 `adm_cd2`로 정규화하면 그대로 재사용.
- `.gitignore`가 `/public/geo/*` 전부 무시 → 제주 asset은 `assets/geo/`에 **커밋**, copy-geo가 public으로 주입.
- 런타임 배선점 단 1곳: `src/worker/scan.worker.ts:30` `new RegionMatcher(...)`.

## 리뷰 반영 (1차: 아키텍트 + 코드리뷰, 양쪽 SHIP-WITH-FIXES)

두 리뷰가 핵심 아키텍처(데코레이터 `super(store)` 일치, `regionCode` override 성립, private 필드 nominal 만족, 분모 `levelLayerConfig.total`이 유일 하드코딩 지점, `sidoStates` 10자리→'50' 롤업, `regionNames` else 분기, **코어 0줄 수정**)가 실제 코드와 일치함을 확인. 아래를 본 계획에 반영:

- **[High] 배포 시 copy-geo 미실행 위험**: `public/geo/*`는 gitignore + copy-geo는 수동 스크립트(빌드 미연결). → **Task 3에 prebuild 배선 + 산출물 통합 가드 테스트**(스플라이스 후 296/315 강제) 추가. (로컬 dev는 이미 copy-geo 선행 전제이나 명문화.)
- **[High] 기존 50110/50130 저장 데이터 마이그레이션 부재**: 표시 geojson에서 2시 피처 제거 → 기존 방문이 재스캔 전까지 색 누락 + 분모 296 왜곡. **DB 행 삭제가 얽혀 사용자 결정 필요** → 아래 `## 미결 결정` 참조. 결정 후 Task 6.5로 구현.
- **[Medium] vintage 불일치**(매칭 2013 sigungu vs refiner 2026 vuski): nearest-boundary 폴백으로 흡수하나, **refiner 거리함수가 코어 `distancePointToSegment`와 동일 입출력임을 강제하는 동등성 테스트**를 Task 4에 추가.
- **[Medium] 워커 fetch 실패 graceful degrade 비일관**: jeju-emd fetch 실패 시 50110/50130 저장 → 표시/분모 불일치. → Task 6에서 **fetch 실패를 명시적 에러로 throw + matcherPromise 캐시 리셋**(영구 실패 캐시 방지).
- **[Medium] 거리함수 이중정의 float 순서**: byte-동일 유지 명시 주석을 jejuRefiner 거리함수에 추가.
- **[Low] 테스트 강화**: jejuEmd에 동명(sggnm) 유일성 단언, jejuSplice에 bbox 4-length 단언 + props 집합 비교, jejuRefiner 타이브레이크 주석 명확화. 제주 상수/출처(vuski ver20260201, KOGL)는 스크립트 헤더에 기록.

## 미결 결정 (사용자 승인 필요 — 구현 전 확정)

**기존에 50110/50130(제주시·서귀포시)으로 저장된 방문 데이터 처리.** 이번 변경으로 표시 geojson에서 두 피처가 사라지므로, 기존 행은 (a) 색이 안 칠해지고 (b) 분모 296에서 정복률을 왜곡한다(눈에 안 보이는 1~2칸 visited). DB 행 삭제가 얽혀 글로벌 규칙상 사용자 확인이 필요하다.

| 옵션 | 내용 | 트레이드오프 |
|------|------|------------|
| **A. 재가져오기만**(추천, 프로토 단계) | 마이그레이션 코드 0. 사용자가 제주 샘플 재가져오기 → 동 코드로 갱신. 잔존 50110/50130 행은 손으로 정리 or 무시 | 가장 단순. 단, 재스캔 전까지 분모 왜곡 잔존 |
| **B. 일회성 자동 정리** | 앱 시작/스토어 로드시 `level:'sigungu'`이면서 코드 ∈ {50110,50130} + `userOverride=false`인 행 삭제(다음 스캔서 동코드 재생성). `userOverride=true`는 보존+알림 | 깔끔하나 DB 삭제 로직 + 마이그레이션 테스트 추가. `storeOps.ts` 정독 필요 |
| **C. 카운트만 제외** | 행은 두되 visitedCount에서 50110/50130 제외(분모 왜곡만 차단) | 삭제 없음. 단 "보이지 않는데 데이터엔 남음" 모호함 |

> 사용자가 단일 사용자(본인)·프로토 단계이고 검증 시 어차피 재가져오기를 하므로 **A 권장**. B/C 선택 시 Task 6.5 추가.

## File Structure

- **생성(커밋)** `assets/geo/jeju-emd.geojson` — 43동, 정규화 props `{sgg=adm_cd2, sggnm=동명, sido:'50', sidonm:'제주특별자치도'}`.
- **생성** `scripts/build-jeju-emd.mjs` — vuski fetch→제주 필터→정규화→asset 작성(재현/출처). 1회 실행.
- **생성** `scripts/jejuSplice.mjs` — 순수: `spliceJejuDisplay(fc, jejuFeatures)`, `mergeJejuRegionCodes(entries, jejuFeatures)`. (copy-geo가 호출, 단위테스트 대상)
- **수정** `scripts/copy-geo.mjs` — 복사 후 스플라이스 3종(표시 geojson, region_codes, public 제주 asset 기록).
- **생성** `src/core/jejuRefiner.ts` — 순수: `refineJeju(coord, dongs)`(포함=코드최소, 없으면 경계 최단거리 동) + 코어 거리공식의 순수 재구현(byte-동일 유지).
- **생성** `src/core/jejuRefiningMatcher.ts` — `class JejuRefiningMatcher extends RegionMatcher`.
- **수정** `src/worker/scan.worker.ts` — 제주 asset fetch+decode→`JejuRefiningMatcher` 주입.
- **수정** `src/lib/regionLayerStyle.ts` — sigungu `total` 255→296.
- **테스트** `tests/data/jejuEmd.test.ts`, `tests/scripts/jejuSplice.test.ts`, `tests/core/jejuRefiner.test.ts`, `tests/core/jejuRefiningMatcher.test.ts`, `tests/lib/regionLayerStyle` 갱신.

---

## Task 1: 제주 동 asset 생성 스크립트 + 커밋 + 가드 테스트

**Files:** Create `scripts/build-jeju-emd.mjs`, `assets/geo/jeju-emd.geojson`(스크립트 산출), Test `tests/data/jejuEmd.test.ts`

- [ ] **Step 1: 가드 테스트 작성**(asset 불변식). asset 생성 전이므로 먼저 실패.

```ts
// tests/data/jejuEmd.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const fc = JSON.parse(fs.readFileSync(path.resolve('assets/geo/jeju-emd.geojson'), 'utf8'));

describe('jeju-emd asset', () => {
  it('43 features', () => expect(fc.features.length).toBe(43));
  it('제주시 26 + 서귀포시 17', () => {
    const byGu = (s: string) => fc.features.filter((f: any) => f.properties.sgg === s).length;
    expect(byGu('50110')).toBe(26);
    expect(byGu('50130')).toBe(17);
  });
  it('props 정규화 + 코드 10자리 유니크 + 동명 유일', () => {
    const codes = new Set<string>();
    const names = new Set<string>();
    for (const f of fc.features) {
      const p = f.properties;
      expect(p.sido).toBe('50');
      expect(p.sidonm).toBe('제주특별자치도');
      expect(typeof p.sggnm).toBe('string');
      expect(p.sggnm.length).toBeGreaterThan(0);
      expect(String(p.sgg)).toHaveLength(10);
      expect(['Polygon', 'MultiPolygon']).toContain(f.geometry.type);
      codes.add(p.sgg);
      names.add(p.sggnm);
    }
    expect(codes.size).toBe(43);
    // 동명 충돌 0 검증(이름은 "제주 {sggnm}"로 표시되므로 표시 라벨 모호성 방지).
    expect(names.size).toBe(43);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npm test -- jejuEmd` → FAIL(asset 파일 없음).

- [ ] **Step 3: 생성 스크립트 작성**

```js
// scripts/build-jeju-emd.mjs — vuski 행정동(2026)에서 제주만 추려 정규화 asset 생성.
// 출처: github.com/vuski/admdongkor ver20260201 (통계청 SGIS 기반, KOGL 출처표시).
// 재현: node scripts/build-jeju-emd.mjs  (네트워크 필요; 산출물은 커밋되어 평소엔 재실행 불필요)
import fs from 'node:fs';
import https from 'node:https';

const URL = 'https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260201/HangJeongDong_ver20260201.geojson';
const OUT = 'assets/geo/jeju-emd.geojson';

function get(url, cb, depth = 0) {
  if (depth > 5) return cb(new Error('redirects'));
  https.get(url, { headers: { 'User-Agent': 'node' } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.resume(); return get(res.headers.location, cb, depth + 1);
    }
    if (res.statusCode !== 200) { res.resume(); return cb(new Error('HTTP ' + res.statusCode)); }
    const ch = []; res.on('data', (c) => ch.push(c)); res.on('end', () => cb(null, Buffer.concat(ch)));
  }).on('error', cb);
}

get(URL, (err, buf) => {
  if (err) { console.error('✗ fetch:', err.message); process.exit(1); }
  const g = JSON.parse(buf.toString('utf8'));
  const features = g.features
    .filter((f) => String(f.properties.sgg || '').startsWith('50'))
    .map((f) => ({
      type: 'Feature',
      properties: {
        sgg: String(f.properties.adm_cd2),                 // 동 코드(promoteId)
        sggnm: f.properties.adm_nm.split(' ').slice(-1)[0], // 맨 토큰 = 동/읍/면명(충돌 0 검증됨)
        sido: '50',
        sidonm: '제주특별자치도',
        parentSgg: f.properties.sgg,                        // 50110/50130 (추적용)
      },
      geometry: f.geometry,
    }));
  if (features.length !== 43) { console.error('✗ 기대 43, 실제', features.length); process.exit(1); }
  fs.mkdirSync('assets/geo', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`✓ ${OUT} (${features.length} features, ${(fs.statSync(OUT).size/1024).toFixed(0)} KB)`);
});
```

- [ ] **Step 4: 실행 + 통과 확인** — `node scripts/build-jeju-emd.mjs` → `✓ ... 43 features`. 이어 `npm test -- jejuEmd` → PASS.

- [ ] **Step 5: 커밋** — `git add scripts/build-jeju-emd.mjs assets/geo/jeju-emd.geojson tests/data/jejuEmd.test.ts && git commit -m "feat(jeju): vendor 43 Jeju 읍면동 boundary asset + guard test"`

---

## Task 2: 표시·코드 스플라이스 순수 helper

**Files:** Create `scripts/jejuSplice.mjs`, Test `tests/scripts/jejuSplice.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// tests/scripts/jejuSplice.test.ts
import { describe, it, expect } from 'vitest';
import { spliceJejuDisplay, mergeJejuRegionCodes } from '../../scripts/jejuSplice.mjs';

const jeju = [
  { type: 'Feature', properties: { sgg: '5011025000', sggnm: '한림읍', sido: '50', sidonm: '제주특별자치도', parentSgg: '50110' }, geometry: { type: 'Polygon', coordinates: [[[126,33],[126.1,33],[126.1,33.1],[126,33]]] } },
];

describe('spliceJejuDisplay', () => {
  it('50110/50130 제거 후 제주 동 추가', () => {
    const fc = { type: 'FeatureCollection', features: [
      { properties: { sgg: '11110', sggnm: '종로구', sido: '11', sidonm: '서울특별시' } },
      { properties: { sgg: '50110', sggnm: '제주시', sido: '50', sidonm: '제주특별자치도' } },
      { properties: { sgg: '50130', sggnm: '서귀포시', sido: '50', sidonm: '제주특별자치도' } },
    ] };
    const out = spliceJejuDisplay(fc, jeju);
    const codes = out.features.map((f: any) => f.properties.sgg);
    expect(codes).not.toContain('50110');
    expect(codes).not.toContain('50130');
    expect(codes).toContain('11110');
    expect(codes).toContain('5011025000');
    expect(out.features.length).toBe(2); // 종로 + 한림읍
    // 표시 props는 4개 키만(parentSgg 제거) — 집합 비교로 누락/추가 키 모두 차단
    const f = out.features.find((x: any) => x.properties.sgg === '5011025000');
    expect(new Set(Object.keys(f.properties))).toEqual(new Set(['sgg', 'sggnm', 'sido', 'sidonm']));
  });
});

describe('mergeJejuRegionCodes', () => {
  it('동 엔트리를 level:emd 로 추가, nameKo는 "제주 동명"', () => {
    const entries = [{ regionCode: '50110', level: 'sigungu', nameKo: '제주시', sidoCode: '50', bbox: [0,0,0,0] }];
    const out = mergeJejuRegionCodes(entries, jeju);
    const emd = out.find((e: any) => e.regionCode === '5011025000');
    expect(emd.level).toBe('emd');
    expect(emd.nameKo).toBe('제주 한림읍');
    expect(emd.sidoCode).toBe('50');
    expect(emd.bbox).toHaveLength(4);
    // 추가된 emd 엔트리 전부 4-length bbox (GeoDataStore가 모든 엔트리에 bbox 요구).
    const added = out.filter((e: any) => e.level === 'emd');
    expect(added.every((e: any) => Array.isArray(e.bbox) && e.bbox.length === 4)).toBe(true);
    // 기존 50110(코어 base 매처용)은 유지
    expect(out.some((e: any) => e.regionCode === '50110')).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npm test -- jejuSplice` → FAIL(module not found).

- [ ] **Step 3: 구현**

```js
// scripts/jejuSplice.mjs — 제주 동 스플라이스 순수 helper(copy-geo가 호출, 부작용 없음).
const JEJU_SGG = new Set(['50110', '50130']);
const DISPLAY_KEYS = ['sgg', 'sggnm', 'sido', 'sidonm'];

function bboxOf(geom) {
  let a = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      a[0] = Math.min(a[0], c[0]); a[1] = Math.min(a[1], c[1]);
      a[2] = Math.max(a[2], c[0]); a[3] = Math.max(a[3], c[1]);
    } else c.forEach(walk);
  };
  walk(geom.coordinates);
  return a.map((x) => Math.round(x * 1e6) / 1e6);
}

/** 표시 FeatureCollection: 제주 2시 제거 + 43동 추가(표시 props 4키만). */
export function spliceJejuDisplay(fc, jejuFeatures) {
  const kept = fc.features.filter((f) => !JEJU_SGG.has(String(f.properties.sgg)));
  const dongs = jejuFeatures.map((f) => ({
    type: 'Feature',
    properties: Object.fromEntries(DISPLAY_KEYS.map((k) => [k, f.properties[k]])),
    geometry: f.geometry,
  }));
  return { type: 'FeatureCollection', features: [...kept, ...dongs] };
}

/** region_codes: 50110/50130 유지(base 매처용) + 43동 level:'emd' 추가(이름/분모 무영향 분리). */
export function mergeJejuRegionCodes(entries, jejuFeatures) {
  const emd = jejuFeatures.map((f) => ({
    regionCode: String(f.properties.sgg),
    level: 'emd',
    nameKo: `제주 ${f.properties.sggnm}`, // regionNames else분기 → 그대로 표시
    sidoCode: '50',
    bbox: bboxOf(f.geometry),
  }));
  return [...entries, ...emd];
}
```

- [ ] **Step 4: 통과 확인** — `npm test -- jejuSplice` → PASS.

- [ ] **Step 5: 커밋** — `git add scripts/jejuSplice.mjs tests/scripts/jejuSplice.test.ts && git commit -m "feat(jeju): pure display/region-code splice helpers"`

---

## Task 3: copy-geo.mjs 스플라이스 배선

**Files:** Modify `scripts/copy-geo.mjs`

- [ ] **Step 1: import + 스플라이스 단계 추가** — 파일 끝 `console.log(완료...)` **앞**에 삽입:

```js
import { spliceJejuDisplay, mergeJejuRegionCodes } from './jejuSplice.mjs';

// ── 제주 읍·면·동 세분화 주입 ──────────────────────────────────────
const jejuPath = path.resolve(process.cwd(), 'assets/geo/jeju-emd.geojson');
if (!fs.existsSync(jejuPath)) {
  console.error(`✗ 제주 asset 없음: ${jejuPath} (node scripts/build-jeju-emd.mjs 먼저)`);
  process.exit(1);
}
const jeju = JSON.parse(fs.readFileSync(jejuPath, 'utf8'));

// 1) 표시 geojson 스플라이스(255→296). iOS 원본을 매번 새로 복사 후 스플라이스 → 멱등(누적 없음).
const dispPath = path.join(DEST_DIR, 'sigungu_display.geojson');
const disp = JSON.parse(fs.readFileSync(dispPath, 'utf8'));
const spliced = spliceJejuDisplay(disp, jeju.features);
// 가드: (a) 2시 제거+43동 추가 동치, (b) 절대 296(levelLayerConfig.total과 일치), (c) 2시 코드 부재.
const expDisp = disp.features.length - 2 + jeju.features.length;
const codes = new Set(spliced.features.map((f) => String(f.properties.sgg)));
if (spliced.features.length !== expDisp || spliced.features.length !== 296
  || codes.has('50110') || codes.has('50130')) {
  console.error(`✗ 표시 스플라이스 가드 실패: ${spliced.features.length} (기대 296)`);
  process.exit(1);
}
fs.writeFileSync(dispPath, JSON.stringify(spliced));
console.log(`✓ sigungu_display 제주 세분화: ${disp.features.length} → ${spliced.features.length}`);

// 2) region_codes 에 동 엔트리(level:emd) 추가. 50110/50130(base 매처용)은 유지.
const rcPath = path.join(DEST_DIR, 'region_codes.json');
const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
const merged = mergeJejuRegionCodes(rc, jeju.features);
if (merged.length !== rc.length + 43
  || !merged.some((e) => e.regionCode === '50110')
  || !merged.some((e) => e.regionCode === '50130')) {
  console.error(`✗ region_codes 가드 실패: ${merged.length} (기대 ${rc.length + 43}, 50110/50130 유지)`);
  process.exit(1);
}
fs.writeFileSync(rcPath, JSON.stringify(merged));
console.log(`✓ region_codes 제주 동 추가: ${rc.length} → ${merged.length}`);

// 3) 워커 2차 매처용 제주 동 geojson 배치
fs.writeFileSync(path.join(DEST_DIR, 'jeju-emd.geojson'), JSON.stringify(jeju));
console.log(`✓ jeju-emd.geojson 배치(${jeju.features.length} 동)`);
```

- [ ] **Step 2: 실행 검증** — `BALJACHWI_IOS_ROOT=../baljachwi npm run copy-geo` → 296, region_codes +43, jeju-emd 배치 로그 확인. 가드 3종(296 동치/2시 제거/50110·50130 유지) 통과. (멱등: 재실행 시 base 파일을 iOS에서 다시 복사 후 스플라이스 → 누적 안 됨.)

- [ ] **Step 3: 빌드 의존성 명문화** — `public/geo/*`가 gitignore + copy-geo가 수동이므로 **dev/build 전 copy-geo 선행**이 전제(현 프로토 동일). README/스크립트 주석에 명시. 단, `prebuild` 무조건 배선은 iOS 클론 없는 환경(Vercel CI)에서 `BALJACHWI_IOS_ROOT` 부재로 exit(1)이라 **금지** — Vercel 배포(별도 후속 작업)에서 buildCommand에 copy-geo를 조건부 배선한다. 본 작업은 로컬 dev/검증 범위.

- [ ] **Step 4: 커밋** — `git add scripts/copy-geo.mjs && git commit -m "feat(jeju): splice 읍면동 into display/region_codes/worker geo at copy-geo + guards"`

---

## Task 4: 제주 2차 매칭 순수 helper (jejuRefiner)

**Files:** Create `src/core/jejuRefiner.ts`, Test `tests/core/jejuRefiner.test.ts`

> `pointInMultiPolygon`(byte-faithful, 불변) 재사용. 포함=코드 오름차순 최소(base 동작 미러), 없으면 경계 최단거리 동(임계값 없음 — base가 이미 제주 확인). 거리는 등거리 근사(질의점 위도 cos보정), RegionMatcher와 동일 공식의 **순수 재구현**(코어 미수정).

- [ ] **Step 1: 실패 테스트**

```ts
// tests/core/jejuRefiner.test.ts
import { describe, it, expect } from 'vitest';
import { refineJeju, type JejuDong } from '@/core/jejuRefiner';
import type { MultiPolygon } from '@/core/geoTypes';

const sq = (minLon: number, minLat: number, s: number): MultiPolygon => ({
  polygons: [{ outer: [
    { lon: minLon, lat: minLat }, { lon: minLon + s, lat: minLat },
    { lon: minLon + s, lat: minLat + s }, { lon: minLon, lat: minLat + s },
  ], holes: [] }],
});
const dongs: JejuDong[] = [
  { code: '5011000002', mp: sq(126.0, 33.0, 0.1) },
  { code: '5011000001', mp: sq(126.2, 33.0, 0.1) },
];

describe('refineJeju', () => {
  it('포함하는 동 코드 반환', () => {
    expect(refineJeju({ lat: 33.05, lon: 126.05 }, dongs)).toBe('5011000002');
    expect(refineJeju({ lat: 33.05, lon: 126.25 }, dongs)).toBe('5011000001');
  });
  it('어떤 동에도 안 들면 경계 최단거리 동(임계값 없음)', () => {
    // 두 동: A(126.0~126.1)=5011000002, B(126.2~126.3)=5011000001. 점 126.16은 둘 사이.
    // A 우측변 126.1까지 0.06°, B 좌측변 126.2까지 0.04° → B(5011000001)가 더 가까움.
    const r = refineJeju({ lat: 33.05, lon: 126.16 }, dongs);
    expect(r).toBe('5011000001');
  });
  it('빈 목록 → null', () => expect(refineJeju({ lat: 33, lon: 126 }, [])).toBeNull());
});
```

- [ ] **Step 2: 실패 확인** — `npm test -- jejuRefiner` → FAIL.

- [ ] **Step 3: 구현**

```ts
// src/core/jejuRefiner.ts — 제주 좌표 → 읍·면·동 코드(2차 레이어, 순수·결정적).
// 코어(regionMatcher/pointInPolygon) 미수정. pointInMultiPolygon SSOT 재사용.
// ⚠ 아래 distanceToBoundary/ringDist/segDist 는 RegionMatcher.distancePointToSegment(private,
//   regionMatcher.ts)와 **연산 순서까지 byte-동일**해야 경계 타이브레이크가 코어와 일치한다.
//   float 연산 순서(곱→나눗셈→덧셈) 변경 금지. 코어 메서드가 private라 직접 호출 불가 → 재구현 유지.
// pointInMultiPolygon 은 config 옵셔널(기본 leftBottomInclusive) — base 매처와 동일 기본값 사용.
import type { Coordinate, MultiPolygon } from './geoTypes';
import { pointInMultiPolygon } from './pointInPolygon';

export interface JejuDong {
  code: string; // adm_cd2 10자리
  mp: MultiPolygon;
}

/**
 * 제주 좌표 → 동 코드. 포함하는 동 중 코드 오름차순 최소(base 매처 동작 미러).
 * 포함 0개면 경계 최단거리 동(임계값 없음 — 호출측이 이미 제주임을 확인). 목록 비면 null.
 */
export function refineJeju(coord: Coordinate, dongs: readonly JejuDong[]): string | null {
  const contained: string[] = [];
  for (const d of dongs) {
    if (pointInMultiPolygon(coord, d.mp)) contained.push(d.code);
  }
  if (contained.length > 0) {
    let best = contained[0];
    for (const c of contained) if (c < best) best = c;
    return best;
  }
  let bestCode: string | null = null;
  let bestDist = Number.MAX_VALUE;
  for (const d of dongs) {
    const dist = distanceToBoundary(coord, d.mp);
    if (dist < bestDist || (dist === bestDist && (bestCode === null || d.code < bestCode))) {
      bestDist = dist;
      bestCode = d.code;
    }
  }
  return bestCode;
}

/** MultiPolygon 모든 링 변까지 최단거리(m). RegionMatcher 동일 공식의 순수 재구현(코어 미수정). */
function distanceToBoundary(p: Coordinate, mp: MultiPolygon): number {
  let best = Number.MAX_VALUE;
  for (const poly of mp.polygons) {
    best = Math.min(best, ringDist(p, poly.outer));
    for (const hole of poly.holes) best = Math.min(best, ringDist(p, hole));
  }
  return best;
}
function ringDist(p: Coordinate, ring: Coordinate[]): number {
  const n = ring.length;
  if (!(n >= 2)) return Number.MAX_VALUE;
  let best = Number.MAX_VALUE;
  for (let i = 0; i < n; i++) best = Math.min(best, segDist(p, ring[i], ring[(i + 1) % n]));
  return best;
}
function segDist(p: Coordinate, a: Coordinate, b: Coordinate): number {
  const r = 6_371_000.0, dr = Math.PI / 180.0;
  const kx = Math.cos(p.lat * dr) * dr * r, ky = dr * r;
  const px = p.lon * kx, py = p.lat * ky;
  const ax = a.lon * kx, ay = a.lat * ky, bx = b.lon * kx, by = b.lat * ky;
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}
```

- [ ] **Step 4: 통과 확인** — `npm test -- jejuRefiner` → PASS.

- [ ] **Step 5: 커밋** — `git add src/core/jejuRefiner.ts tests/core/jejuRefiner.test.ts && git commit -m "feat(jeju): pure 읍면동 refiner (contain → nearest-boundary)"`

---

## Task 5: JejuRefiningMatcher (데코레이터)

**Files:** Create `src/core/jejuRefiningMatcher.ts`, Test `tests/core/jejuRefiningMatcher.test.ts`

> `RegionMatcher`(private 필드 → nominal type)를 **subclass**해서 타입 만족 + 코어 미수정. `regionCode` 오버라이드: `super.regionCode` 호출 후 제주(50110/50130)일 때만 refine.

- [ ] **Step 1: 실패 테스트** (합성 store로 통합 검증)

```ts
// tests/core/jejuRefiningMatcher.test.ts
import { describe, it, expect } from 'vitest';
import { GeoDataStore, type RegionCodeEntry } from '@/core/geoDataStore';
import { JejuRefiningMatcher } from '@/core/jejuRefiningMatcher';
import type { JejuDong } from '@/core/jejuRefiner';

// 50110 = 큰 사각형(제주시 대용), 11110 = 서울 종로 대용.
const geojson = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { sgg: '50110' }, geometry: { type: 'Polygon',
      coordinates: [[[126.0,33.0],[126.5,33.0],[126.5,33.5],[126.0,33.5],[126.0,33.0]]] } },
    { type: 'Feature', properties: { sgg: '11110' }, geometry: { type: 'Polygon',
      coordinates: [[[126.97,37.57],[126.99,37.57],[126.99,37.59],[126.97,37.59],[126.97,37.57]]] } },
  ],
};
const entries: RegionCodeEntry[] = [
  { regionCode: '50110', level: 'sigungu', nameKo: '제주시', sidoCode: '50', bbox: [126.0,33.0,126.5,33.5] },
  { regionCode: '11110', level: 'sigungu', nameKo: '종로구', sidoCode: '11', bbox: [126.97,37.57,126.99,37.59] },
];
const dongs: JejuDong[] = [
  { code: '5011000001', mp: { polygons: [{ outer: [
    { lon: 126.0, lat: 33.0 }, { lon: 126.25, lat: 33.0 },
    { lon: 126.25, lat: 33.5 }, { lon: 126.0, lat: 33.5 } ], holes: [] }] } },
  { code: '5011000002', mp: { polygons: [{ outer: [
    { lon: 126.25, lat: 33.0 }, { lon: 126.5, lat: 33.0 },
    { lon: 126.5, lat: 33.5 }, { lon: 126.25, lat: 33.5 } ], holes: [] }] } },
];

describe('JejuRefiningMatcher', () => {
  const m = new JejuRefiningMatcher(new GeoDataStore(entries, geojson), dongs);
  it('제주 좌표 → 동 코드로 정제', () => {
    expect(m.regionCode({ lat: 33.25, lon: 126.1 })).toBe('5011000001');
    expect(m.regionCode({ lat: 33.25, lon: 126.4 })).toBe('5011000002');
  });
  it('비제주 좌표 → base 코드 그대로(정제 안 함)', () => {
    expect(m.regionCode({ lat: 37.58, lon: 126.98 })).toBe('11110');
  });
  it('해외/바다 → null', () => {
    expect(m.regionCode({ lat: 0, lon: 0 })).toBeNull();
  });
  it('dongs 비었으면(fetch 실패 시뮬) 제주 좌표는 base 50110 유지(graceful degrade)', () => {
    const m0 = new JejuRefiningMatcher(new GeoDataStore(entries, geojson), []);
    expect(m0.regionCode({ lat: 33.25, lon: 126.1 })).toBe('50110');
  });
});
```

- [ ] **Step 2: 실패 확인** — `npm test -- jejuRefiningMatcher` → FAIL.

- [ ] **Step 3: 구현**

```ts
// src/core/jejuRefiningMatcher.ts — 1차 매처(byte-faithful, 불변) 위 제주 읍면동 2차 레이어.
// RegionMatcher subclass: 코어 미수정 + nominal type 만족. 제주(50110/50130)만 동 코드로 정제.
import type { Coordinate } from './geoTypes';
import { RegionMatcher } from './regionMatcher';
import type { GeoDataStore } from './geoDataStore';
import { refineJeju, type JejuDong } from './jejuRefiner';

const JEJU_SGG = new Set(['50110', '50130']);

export class JejuRefiningMatcher extends RegionMatcher {
  private readonly dongs: readonly JejuDong[];
  constructor(store: GeoDataStore, dongs: readonly JejuDong[]) {
    super(store);
    this.dongs = dongs;
  }
  override regionCode(coordinate: Coordinate): string | null {
    const base = super.regionCode(coordinate);
    if (base !== null && JEJU_SGG.has(base)) {
      return refineJeju(coordinate, this.dongs) ?? base; // 정제 실패해도 base 유지(안전망)
    }
    return base;
  }
}
```

- [ ] **Step 4: 통과 확인** — `npm test -- jejuRefiningMatcher` → PASS.

- [ ] **Step 5: 커밋** — `git add src/core/jejuRefiningMatcher.ts tests/core/jejuRefiningMatcher.test.ts && git commit -m "feat(jeju): JejuRefiningMatcher decorator over byte-faithful core"`

---

## Task 6: 워커 배선 + 정복률 분모

**Files:** Modify `src/worker/scan.worker.ts`, `src/lib/regionLayerStyle.ts` + 해당 테스트

- [ ] **Step 1: regionLayerStyle 분모 테스트 갱신**(255→296). 기존 sigungu total 단언을 296으로 수정 후 실패 확인.

```ts
// tests/lib/regionLayerStyle.test.ts 의 해당 단언
expect(levelLayerConfig('sigungu').total).toBe(296);
```

- [ ] **Step 2: regionLayerStyle 구현** — `total: 255` → `total: 296` (sigungu 라인). 주석: `// 255 - 제주시/서귀포시 2 + 제주 읍면동 43`. `npm test -- regionLayerStyle` → PASS.

- [ ] **Step 3: 워커 배선** — `scan.worker.ts` 의 매처 생성부 교체. 제주 asset fetch+decode 후 `JejuRefiningMatcher` 주입.

  현재(line~30) `return new RegionMatcher(new GeoDataStore(entries, geojson));` 주변을 제주 동 fetch/decode 포함하도록 수정:

```ts
import { JejuRefiningMatcher } from '@/core/jejuRefiningMatcher';
import { polygonsBySgg } from '@/core/geojsonDecode';
import type { JejuDong } from '@/core/jejuRefiner';
// ...
const store = new GeoDataStore(entries, geojson);
// 제주 동 asset은 다른 geo와 동일하게 실패 시 throw(silent degrade 금지).
// 누락 시 50110/50130이 저장되는데 표시 geojson엔 피처 없음 → 색 누락+분모 296 왜곡이라 조용히 넘기면 안 됨.
const res = await fetch('/geo/jeju-emd.geojson');
if (!res.ok) throw new Error(`jeju-emd.geojson load failed: ${res.status}`);
const jejuJson = await res.json();
const map = polygonsBySgg(jejuJson); // Map<adm_cd2, MultiPolygon>
const dongs: JejuDong[] = [...map.entries()].map(([code, mp]) => ({ code, mp }));
return new JejuRefiningMatcher(store, dongs);
```

  > 정확한 변수명은 워커 코드에 맞춰 조정. **캐시 주의**: 매처가 `matcherPromise`로 메모이즈되면, 위 throw가 실패 promise를 영구 캐시하지 않도록 `catch`에서 `matcherPromise = null`(또는 동등) 리셋해 재시도 가능하게 한다. 데코레이터의 `?? base` 안전망은 per-coordinate 방어로 유지하되(런타임 견고성), 워커는 asset 자체 부재를 **명시적 에러**로 표면화한다(2중 안전망).

- [ ] **Step 4: 전체 테스트** — `npm test` → 골든 290 + 신규 전부 PASS, 회귀 0.

- [ ] **Step 5: 빌드** — `npm run build` → 타입/빌드 통과.

- [ ] **Step 6: 커밋** — `git add src/worker/scan.worker.ts src/lib/regionLayerStyle.ts tests/lib/regionLayerStyle.test.ts && git commit -m "feat(jeju): wire JejuRefiningMatcher in worker + 정복률 분모 296"`

---

## Task 7: 멀티에이전트 리뷰 + 브라우저 검증 (생략 불가)

> 글로벌 CLAUDE.md 필수 절차 + coding-lessons(2026-04-23): UI는 브라우저 실제 접근 확인 후에만 "완료".

- [ ] **Step 1: Code Reviewer + Security Engineer 병렬 리뷰** — 변경 전체. 중점: (a) 데코레이터가 코어 미변경·골든 무영향 보장, (b) refiner nearest-동 폴백의 좌표 손실 없음, (c) copy-geo 멱등성·스플라이스 누적 안 됨, (d) 분모 296 일관성, (e) 워커 fetch 실패 graceful, (f) 외부 데이터 출처/라이선스 표기. High/고가치 Medium 반영 후 커밋, 잔여는 followup 이관.

- [ ] **Step 2: 브라우저 검증**(아래 Verification).

---

## Verification

**자동:** `npm test`(골든 290 + 신규) · `npm run build`.

**수동(dev + 브라우저):**
1. **copy-geo 재생성** → `sigungu_display.geojson` 296피처, `region_codes` 315엔트리(272+43), `jeju-emd.geojson` 존재 확인.
2. 샘플(제주 포함) 재가져오기 → 지역지도 시군구 레벨에서 **제주 사진이 섬 절반이 아니라 해당 읍/면/동 하나만 녹색**으로 칠해지는지(예: 제주공항 부근 → 용담2동/도두동 단위).
3. **줌인 시 제주 동명 라벨**(한림읍·애월읍 등) 점진 노출.
4. **시도 토글** → 제주는 여전히 1개(제주특별자치도)로 롤업, 정복률 17 기준 정상.
5. **정복률 분모 296** 표기 확인(시군구 레벨 헤더 "n / 296").
6. 경로 탭: 제주 여행 대표 지역명이 "제주 한림읍" 식으로 표시.
7. **새로고침** 후 색·라벨·분모 유지.

> **마이그레이션 주의:** 기존 50110/50130 저장 방문 처리는 `## 미결 결정`에서 옵션 확정(A 재가져오기 / B 자동정리 / C 카운트제외). A면 검증은 제주 샘플 재가져오기 후 수행. B/C면 Task 6.5 구현 후 기존 데이터 자동 보정 확인.

**완료 기준:** 1~7 브라우저 확인 + `npm test`/`build` 통과 + 멀티에이전트 리뷰 반영. 셋 중 하나라도 미수행 시 "완료" 선언 금지.

---

## Self-Review 체크

- **코어 불변**: regionMatcher/scanPipeline/regionAggregate/regionNames/pointInPolygon/mapViewport 0줄 수정 — 골든 290 무영향. ✅
- **요청 충족**: 제주가 43동으로 쪼개져 사진당 동 단위 색칠(내륙 구 수준 시각 입도). ✅
- **타입 일관성**: `JejuDong{code,mp}` — refiner/매처/워커 동일. `JejuRefiningMatcher extends RegionMatcher` nominal 만족. `spliceJejuDisplay`/`mergeJejuRegionCodes` 시그니처 Task2 정의=Task3 호출 일치. ✅
- **분모**: 255→296(255-2+43), levelLayerConfig + 헤더 일관. region_codes는 50110/50130 유지(base 매처) + 43 emd(이름) → base 매처는 level==='sigungu'만 보므로 emd 무시(크래시 없음). ✅
- **데이터 출처**: vuski/admdongkor KOGL 출처표시 — 스크립트 헤더 + (리뷰 시) NOTICE/README 표기. ✅
- **리뷰 반영(1차)**: 양쪽 SHIP-WITH-FIXES. High 2(배포 copy-geo 배선/마이그레이션) + Medium/Low 다수 반영. 배포 배선은 후속 Vercel 작업으로 범위 분리, 마이그레이션은 `## 미결 결정`으로 사용자 확정 대기. ✅
- **알려진 한계**: (1) 2013/2026 데이터셋 경계 미세차 → refiner nearest-동 폴백으로 흡수(코어 거리공식 byte-동일 재구현, 순서변경 금지 주석). (2) 기존 저장 데이터 처리는 미결 결정. (3) 제주만 세분화 → 입도 비대칭(의도된 범위). (4) vuski는 행정동(법정동 아님) — 사용자 의도(시각 입도)에 부합. (5) refiner↔코어 수치 동등성은 코어 메서드 private라 직접 단위테스트 불가 → byte-동일 주석 + 워커 graceful-degrade 테스트로 간접 가드.
