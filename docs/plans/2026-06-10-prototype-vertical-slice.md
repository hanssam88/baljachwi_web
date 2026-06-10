# 프로토타입 수직 슬라이스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> 리뷰 이력: 아키텍트 리뷰 1회(2026-06-10) — Blocker 2·High 3·Medium 6·Low 5 전건 반영(개정 1).

**Goal:** 사진 가져오기(실제 EXIF) → 지역지도 색칠 → 경로지도 핀+경로선이 한 번에 동작하는 프로토타입 — 코어는 byte-faithful 골든 TDD, 본 구현의 기반.

**Architecture:** `파일선택 → exifr(메인) → scan.worker(12MB geojson + ScanPipeline) → repo.reconcile(Dexie rw) → liveQuery → 지도 리페인트`. 코어 로직(`src/core/*`)과 reconcile은 순수 함수로 포팅하고 Dexie는 IO 경계(`src/data/repo.ts`)에만 둔다.

**Tech Stack:** Next.js(App Router)·React·TypeScript, Dexie(+dexie-react-hooks), exifr, MapLibre GL, Vitest(+fake-indexeddb), piexifjs(샘플 생성).

**필수 참조 문서 (포팅의 단일 출처):**
- 스펙: `docs/specs/2026-06-10-prototype-vertical-slice-design.md` (범위·결정), `docs/specs/2026-06-10-web-port-design.md` (상수·매핑 표)
- **모듈 카드**: `docs/plans/2026-06-10-module-cards.json` — Swift 원본 15개 분석 단위별 {TS export 계약(exportsTs), 보존 상수(constants), 포팅할 테스트 인벤토리(testsToPort, 총 214건), 포팅 함정(notes)}. **각 코어 태스크는 자기 카드 + Swift 원본/테스트 파일이 코드 스펙이다** — 이 계획서에 함수 본문을 중복 전사하지 않는다(드리프트 방지).
- Swift 원본: `C:/Users/sengmin.hyun/Downloads/baljachwi/BaljachwiCore/Sources/BaljachwiCore/*.swift`, 테스트 `.../Tests/BaljachwiCoreTests/*.swift`

**전역 포팅 규칙 (모든 코어 태스크 공통):**
1. 카드의 `exportsTs` 시그니처를 그대로 export — **단, 아래 "카드 오버라이드 표"가 카드보다 우선한다**
2. 카드의 `constants` 전부 보존, `notes`의 함정 준수
3. 시간은 epoch **초** number 정수 산술만 — JS `Date` 객체·`getHours`·타임존 메서드 금지 (UI/exif 경계 제외)
4. Swift Optional → `| null` (undefined 금지), `Dictionary(uniquingKeysWith: first)` → `if (!map.has(k)) map.set(k,v)` (first-wins)
5. 정렬은 명시 비교자(숫자는 `(a,b)=>a-b`), tie-break 순서 그대로
6. TDD: 카드 `testsToPort` + Swift 테스트 원본에서 **테스트 먼저 작성 → 실패 확인 → 구현 → 통과**

**카드 오버라이드 표 (모든 에이전트 프롬프트에 그대로 주입할 것):**

| 카드 | 카드 내용 | 오버라이드 (이쪽이 정답) |
|---|---|---|
| photoScanFilter | 헤더가 `// src/lib/exif.ts` | 파일은 **`src/core/photoScan.ts`** — lib/exif.ts는 별도(추출 전용, Task 8) |
| models | VisitState를 db.ts에서 단일 정의, 전부 한 파일 | **`src/data/models.ts`(타입+팩토리) + `src/data/db.ts`(Dexie) 분리**. VisitState/RegionLevel은 **`src/core/visitState.ts`가 단일 정의** — models.ts는 re-export만 |
| models | Dexie 4테이블 | **5테이블** — `thumbs: '&localIdentifier'` 추가(썸네일 blob 저장, 스펙 v1). 인덱스 표기는 `photoRefs: '&localIdentifier, tripID'` 로 통일 |
| dataActorReconcile | `import … from "../geo/geoTypes"` / 레코드 타입 자체 정의 | 경로는 `../core/geoTypes`. **PhotoRefRecord 등 레코드 타입은 자체 정의 금지** — `src/data/models.ts`의 PhotoRef/RegionStatus/TripRecord를 import (필드 계약 동일) |
| regionMatcher | `import { … } from "./geoStores"` + `polygonFor()` "가정" | 카드의 가정 계약 무시 — **완성된 `src/core/geoDataStore.ts`의 실제 export를 따른다** (Task 3.5 프롬프트에 실물 인라인) |

---

## 의존성 그래프와 Wave 구성

```
Wave 1 (메인):       geoTypes(+visitState)
Wave 2 (병렬 ×9):    pointInPolygon  photoTime  mapProjection  mapViewport
                     geojsonDecode  photoScanFilter  models(+db.ts)  tripSegmenter  tripMetrics
Wave 3 (병렬 ×2):    geoStores(←geojsonDecode)  regionAggregate(←visitState)
Wave 3.5 (단독 ×1):  regionMatcher(←pointInPolygon,geoStores 완성 후)
Wave 4 (메인 순차):  scanPipeline → reconcile(에이전트) → repo(Dexie)
                     → 샘플 스크립트 → exif/worker/온보딩 → 지역지도 → 경로지도 → 검증 → 리뷰
```

병렬 wave는 Workflow 도구로 실행. 각 포팅 에이전트의 산출물은 메인이 `npm test`로 게이트(green 아니면 머지 안 함). 각 wave 완료 시 커밋.

**범위 메모:** setWantToGo·pruneMissingPins·pinnedPhotoIDs는 UI가 프로토 제외임에도 **로직은 의도적으로 포팅**한다(reconcile 카드 일괄 — visited-wins 불변식이 reconcile과 얽혀 있고 본 구현 기반이므로). UI 노출은 이후 세션.

---

## Task 0: 의존성 설치 + 계획 산출물 커밋

**Files:** Modify: `package.json`

- [ ] **Step 1:** 런타임/개발 의존성 설치

```bash
cd C:/Users/sengmin.hyun/Downloads/baljachwi-web
npm i dexie dexie-react-hooks exifr maplibre-gl
npm i -D piexifjs fake-indexeddb
```

⚠ `dexie-react-hooks`가 React 19 peer-dep으로 실패하면: `npm i dexie-react-hooks --legacy-peer-deps` 시도, 그래도 안 되면 설치 생략 — `queries.ts`의 liveQuery observable을 `useSyncExternalStore`로 감싸는 자체 훅(~15줄)으로 대체(Task 6에 폴백 명시).

- [ ] **Step 2:** 기존 테스트가 여전히 green인지 확인: `npm test` → 기존 tokens/RootTabs 테스트 PASS
- [ ] **Step 3:** 커밋

```bash
git add package.json package-lock.json docs/plans/
git commit -m "chore: 프로토타입 의존성 + 구현 계획/모듈 카드"
```

---

## Task 1 (Wave 1, 메인): core/geoTypes + visitState

**Files:**
- Create: `src/core/geoTypes.ts`, `src/core/visitState.ts`
- Test: `tests/core/geoTypes.test.ts`

**카드:** `geoTypes` (tests 3건). 핵심: `Coordinate{lat,lon}`, `Polygon{outer,holes}`(holes 옵셔널 금지 — 항상 `[]`), `MultiPolygon{polygons}`(래퍼 유지), `BBox` (Swift는 TripSegmenter.swift 정의지만 TS는 여기로 이전 — **다른 모듈에서 재정의 금지**), `makePolygon(outer, holes=[])`, `VisitState` 문자열 리터럴 유니언 + `VISIT_STATE_ALL_CASES`(선언 순서 보존) + `parseVisitState`(미지 문자열 → undefined).

- [ ] **Step 1:** 카드 testsToPort 3건으로 `tests/core/geoTypes.test.ts` 작성
- [ ] **Step 2:** `npx vitest run tests/core/geoTypes.test.ts` → FAIL (모듈 없음)
- [ ] **Step 3:** 카드 exportsTs 그대로 구현 (GeoTypes.swift의 "(x=lon, y=lat) 평면, MapProjection 비의존" 독스트링 주석 이식 포함)
- [ ] **Step 4:** `npx vitest run tests/core/geoTypes.test.ts` → PASS
- [ ] **Step 5:** 커밋 `feat(core): geoTypes + visitState 포팅`

---

## Task 2 (Wave 2, 병렬 워크플로우): 잎 모듈 9개

Workflow로 9개 에이전트 동시 실행. **각 에이전트 프롬프트에 공통으로 포함할 것:**
- 자기 카드(JSON에서 해당 key 추출해 전문 인라인), Swift 원본·테스트 절대경로, 전역 포팅 규칙(위 6개), **카드 오버라이드 표**, geoTypes 완성본 경로(`src/core/geoTypes.ts` — Wave 1 산출, import 해서 사용)
- 순서: 테스트 파일 먼저 작성 → `npx vitest run <테스트파일>` 실패 확인 → 구현 → 통과 확인 → **커밋은 하지 말 것**(메인이 wave 단위 게이트 후 커밋)
- 자기 Create 파일 외 다른 파일 생성·수정 금지 (파일 소유권)

| # | key | Create | Test | 비고 |
|---|-----|--------|------|------|
| 2a | pointInPolygon | `src/core/pointInPolygon.ts` | `tests/core/pointInPolygon.test.ts` | 34건. crossing-number, half-open `(vi.y>p.y)!==(vj.y>p.y)`, strict `p.x<xIntersect`, 링<3→false, epsilon 추가 금지 |
| 2b | photoTime | `src/core/photoTime.ts` | `tests/core/photoTime.test.ts` | 14건. Korea bbox lat∈[33.0,38.9] lon∈[124.6,132.0]→+32400, 정수 epoch 산술만 |
| 2c | mapProjection | `src/core/mapProjection.ts` | `tests/core/mapProjection.test.ts` | 9건. refLat=36.0, Y-flip |
| 2d | mapViewport | `src/core/mapViewport.ts` | `tests/core/mapViewport.test.ts` | 6건. affine translate·scale·translate + invert |
| 2e | geojsonDecode | `src/core/geojsonDecode.ts` | `tests/core/geojsonDecode.test.ts` | 12건. `[lon,lat]→{lat,lon}` 단일 변환점, Polygon→MultiPolygon 승격 |
| 2f | photoScanFilter | `src/core/photoScan.ts` | `tests/core/photoScan.test.ts` | 9건. **오버라이드: 파일은 core/photoScan.ts**. 필터 순서 (1)lat/lon null (2)`|lat|<1e-7&&|lon|<1e-7` strict AND (3)takenAt null (4)dedup — 순서 변경 금지. progress=청크 끝 인덱스 |
| 2g | models | `src/data/models.ts`, `src/data/db.ts` | `tests/data/models.test.ts` | 8건. **오버라이드: 2파일 분리, VisitState는 core/visitState re-export, thumbs 포함 5테이블** — `photoRefs:'&localIdentifier, tripID'`, `tripRecords:'&id, startAt'`, `regionStatuses:'&regionCode, level'`, `homeCache:'&id'`, `thumbs:'&localIdentifier'`. plain interface+팩토리(클래스/getter 금지), HOME_CACHE_ROW_ID=1. 테스트는 fake-indexeddb |
| 2h | tripSegmenter | `src/core/tripSegmenter.ts` | `tests/core/tripSegmenter.test.ts` | 23건. **최대 모듈(426줄)**. jumpKM=90, gapHours=8, homeSuppressionRadiusKM=18, stayShiftKM=40, nightStartHour=21, nightEndHour=6, minHomeNights=3, burstMeters=50, burstSeconds=120, homeClusterRadiusKM=18, trivialMinPhotos=2, trivialRadiusKM=5, trivialDurationHours=4, Haversine R=6371000, 정렬 takenAt asc tie id asc, 분할규칙 ①~⑤ 순서, excludedTripSampleIDs. BBox는 geoTypes에서 import |
| 2i | tripMetrics | `src/core/tripMetrics.ts` | `tests/core/tripMetrics.test.ts` | 6건. representativeRegionCode=최빈 tie 최소 코드 |

**데이터 테스트 환경(2g·이후 Task 5/6 공통):** 파일 최상단 `import 'fake-indexeddb/auto'` + 독블록 `// @vitest-environment node` (DOM 불필요 + jsdom 호스트 객체는 structured clone 불가). **Blob을 fake-indexeddb에 넣는 테스트 금지** — thumbs 동작은 Task 11 브라우저 검증.

- [ ] **Step 1:** Workflow 실행 (9 에이전트, 카드+오버라이드 표 인라인)
- [ ] **Step 2:** 전체 게이트: `npm test` → Wave 1~2 테스트 전부 PASS. 실패 모듈은 해당 에이전트 재실행 또는 메인이 직접 수정
- [ ] **Step 3:** `npx tsc --noEmit` → 타입 에러 0
- [ ] **Step 4:** 커밋 `feat(core): Wave 2 잎 모듈 9개 골든 TDD 포팅`

---

## Task 3 (Wave 3, 병렬 워크플로우 ×2): geoStores + regionAggregate

| # | key | Create | Test | 비고 |
|---|-----|--------|------|------|
| 3a | geoStores | `src/core/geoDataStore.ts`, `src/core/displayGeoStore.ts`, `src/core/regionNames.ts` | `tests/core/geoStores.test.ts` | 19건. 생성자가 **파싱된 JSON을 받음**(Bundle/fetch 금지 — IO 경계 분리). RegionNames "부산 연제구" 합성 규칙 |
| 3b | regionAggregate | `src/core/regionAggregate.ts` | `tests/core/regionAggregate.test.ts` | 5건. `code.slice(0,2)` 그룹, rank visited2>wantToGo1>notVisited0. VisitState는 **core/visitState에서 import** (오버라이드 표) |

- [ ] **Step 1:** Workflow 실행 (2 에이전트)
- [ ] **Step 2:** 게이트: `npm test` PASS + `npx tsc --noEmit` 0 에러
- [ ] **Step 3:** 커밋 `feat(core): geoStores + regionAggregate 포팅`

---

## Task 3.5 (Wave 3.5, 에이전트 1개 단독): regionMatcher

**Files:** Create: `src/core/regionMatcher.ts` / Test: `tests/core/regionMatcher.test.ts`

geoStores **완성 후** 실행 — 에이전트 프롬프트에 `src/core/geoDataStore.ts`의 **실제 export 전문을 인라인**하고, regionMatcher 카드 안의 "가정 계약"(`./geoStores`, `polygonFor()`)은 무시하라고 명시.

12건. **골든 좌표는 실제 12MB geojson** — 테스트에서 `node:fs`로 `public/geo/sigungu.geojson` + `region_codes.json` 로드(이미 copy-geo 완료). 서울시청→11140, 부산역→26170, 제주공항→50110, 백령도→28720, 경계흡수 울릉→47940, Paris/(0,0)→null. boundaryAbsorbMeters=100.0, tie-break 최소 regionCode, planar kx=cos(lat)·deg2rad·R, R=6371000. 골든 로드 실패 시 skip 처리 금지 — 명시 throw.

- [ ] **Step 1:** 에이전트 실행 → 게이트: `npx vitest run tests/core/regionMatcher.test.ts` PASS
- [ ] **Step 2:** 커밋 `feat(core): regionMatcher 골든 포팅 (실 geojson)`

---

## Task 4 (Wave 4, 메인): core/scanPipeline

**Files:** Create: `src/core/scanPipeline.ts` / Test: `tests/core/scanPipeline.test.ts`

**카드:** `scanPipeline` (8건). tripID=`` `${trunc(startAtSec)}_${firstSampleID}` ``, regions/trips 정렬 코드·startAt asc, exifOffset 전달, `PipelineResult`는 구조화 복제 가능 plain object (worker 경계 통과).

- [ ] **Step 1:** 카드 testsToPort + Swift ScanPipelineTests.swift로 테스트 작성 → FAIL 확인
- [ ] **Step 2:** 구현 (photoTime→regionMatcher→tripSegmenter→tripMetrics→regionAggregate 조립) → PASS
- [ ] **Step 3:** 커밋 `feat(core): scanPipeline 통합 포팅 — 코어 골든 전체 green`

---

## Task 5 (Wave 4, 에이전트 1개): data/reconcile 순수 로직

**Files:** Create: `src/data/reconcile.ts`, `src/data/storeOps.ts`(DataStore·apply·deleteAll 등 순수 부분) / Test: `tests/data/reconcile.test.ts`

**카드:** `dataActorReconcile` (46건 — T1~11, R1~13, H1~8, WT1~6, PIN, P1~7). 인메모리 `DataStore{photos,regions,trips,home}` 위의 순수 함수: `apply`(home 미터치), `reconcile`(upsert+prune 사진→지역→여행 순+home 단일행 동기화), `setWantToGo`(visited-wins, on/off 양쪽 visited 보존), `pinnedPhotoIDs`, `pruneMissingPins`(제자리 recalc — id/title/userOverride 보존). merge/split/title/delete는 **포팅하지 않음**(DataActor.swift 207~418행 제외).

**오버라이드(표 참조):** import 경로 `../core/geoTypes`, 레코드 타입은 `src/data/models.ts`에서 import — 자체 재정의 금지.

핵심 함정(카드 notes): touchedTripIDs는 override 스킵 trip도 포함 / first-wins 사전 / trip prune 3중 AND(`!tIDs.has && !userOverride && !survivingTripRefs.has`) / sido 행은 upsert·prune 비후보 / homeChanged는 엄밀 float 동치.

- [ ] **Step 1:** 에이전트 실행 (카드 전문 + 오버라이드 표 + DataActor.swift + 테스트 2파일 경로 + 전역 규칙)
- [ ] **Step 2:** 게이트: `npx vitest run tests/data/reconcile.test.ts` → 46건 PASS
- [ ] **Step 3:** 커밋 `feat(data): reconcile/apply/setWantToGo/pruneMissingPins 순수 로직 포팅`

---

## Task 6 (Wave 4, 메인): data/repo.ts — Dexie IO 경계 + queries

**Files:** Create: `src/data/repo.ts`, `src/data/queries.ts` / Test: `tests/data/repo.test.ts`

순수 reconcile을 Dexie 트랜잭션으로 감싼다. **모든 쓰기는 이 파일 경유** (단일 writer). **`db.ts`는 인스턴스 생성만** — 모듈 스코프에서 `db.open()` 호출 금지(SSR 가드, 첫 트랜잭션이 자동 open).

```ts
// src/data/repo.ts — 핵심 형태
import { db } from './db';
import type { PipelineResult } from '@/core/scanPipeline';
import { reconcile, type ReconcileResult } from './reconcile';
import { createEmptyStore } from './storeOps';

export async function reconcileScan(result: PipelineResult): Promise<ReconcileResult> {
  return db.transaction('rw', db.photoRefs, db.regionStatuses, db.tripRecords, db.homeCache, async () => {
    // 1) 전 테이블 → 인메모리 DataStore 로드
    const store = createEmptyStore();
    store.photos = await db.photoRefs.toArray();
    store.regions = await db.regionStatuses.toArray();
    store.trips = await db.tripRecords.toArray();
    store.home = (await db.homeCache.toArray()).map(h => ({ lat: h.lat, lon: h.lon }));
    // 2) 순수 reconcile 적용
    const res = reconcile(store, result);
    // 3) clear + bulkPut 라이트백 (트랜잭션 원자성으로 안전)
    await Promise.all([db.photoRefs.clear(), db.regionStatuses.clear(), db.tripRecords.clear(), db.homeCache.clear()]);
    await Promise.all([
      db.photoRefs.bulkPut(store.photos),
      db.regionStatuses.bulkPut(store.regions),
      db.tripRecords.bulkPut(store.trips),
      db.homeCache.bulkPut(store.home.map(h => ({ id: 1 as const, lat: h.lat, lon: h.lon }))),
    ]);
    return res;
  });
}
export async function saveThumb(localIdentifier: string, blob: Blob): Promise<void>;   // db.thumbs.put
export async function thumbFor(localIdentifier: string): Promise<Blob | null>;        // db.thumbs.get
export async function pinnedPhotoIDs(): Promise<Set<string>>;  // userOverride=true PhotoRef id 집합
export async function resetAll(): Promise<void>;               // 5테이블 clear (thumbs 포함)
```

```ts
// src/data/queries.ts — liveQuery 구독 (읽기 전용)
import { liveQuery } from 'dexie';
export const regionStatuses$ = () => liveQuery(() => db.regionStatuses.toArray());
export const trips$ = () => liveQuery(() => db.tripRecords.orderBy('startAt').reverse().toArray());
export const photosForTrip = (tripID: string) =>
  liveQuery(() => db.photoRefs.where('tripID').equals(tripID).sortBy('sortIndex'));
```

dexie-react-hooks 미설치 폴백(Task 0): `src/hooks/useLive.ts` — liveQuery observable을 `useSyncExternalStore(subscribe, getSnapshot)`로 감싸는 훅.

- [ ] **Step 1:** fake-indexeddb 왕복 테스트 작성(`@vitest-environment node`, 3건: reconcileScan 멱등 + trips$ 정렬 반영 + resetAll. **Blob 테스트 금지**) → FAIL
- [ ] **Step 2:** 구현 → PASS
- [ ] **Step 3:** 커밋 `feat(data): Dexie repo(rw 단일 writer) + liveQuery queries`

---

## Task 7: 샘플 지오태그 사진 생성 스크립트 (코어 비의존 — 가져오기 전에 준비)

**Files:** Create: `scripts/make-geotagged.mjs`, `tests/fixtures/geotagged-seoul-1.jpg`(커밋) / Output: `samples/*.jpg`(gitignore)

piexifjs로 베이스 JPEG(스크립트 내장 base64, 단색 64×64)에 GPS+DateTimeOriginal 주입. **7장 구성** (golden 좌표와 교차 검증 가능):

| 파일 | 좌표 (장소) | 기대 regionCode | 촬영시각(KST) |
|---|---|---|---|
| seoul-1.jpg | 37.5663, 126.9779 (서울시청) | 11140 중구 | 2024-04-05 10:00 |
| seoul-2.jpg | 37.5796, 126.9770 (경복궁) | 11110 종로구 | 2024-04-05 11:30 |
| seoul-3.jpg | 37.5512, 126.9882 (남산) | 11170 용산구 | 2024-04-05 14:00 |
| busan-1.jpg | 35.1151, 129.0403 (부산역) | 26170 동구 | 2024-04-07 10:00 |
| busan-2.jpg | 35.1587, 129.1604 (해운대) | 26350 해운대구 | 2024-04-07 12:00 |
| jeju-1.jpg | 33.5070, 126.4930 (제주공항) | 50110 제주시 | 2024-04-09 10:00 |
| jeju-2.jpg | 33.4587, 126.9423 (성산일출봉) | 50130 서귀포시 | 2024-04-09 11:00 |

→ 기대 결과: **여행 3개**(날짜 간 gap 44h > 8h·도시 간 jump > 90km로 분할), **시군구 7곳 visited**, 시도 3곳(서울·부산·제주).

⚠ **OffsetTimeOriginal(0x9011)은 EXIF 2.31 태그라 piexifjs TAGS 사전에 없을 수 있다** — `piexif.TAGS.Exif[0x9011] = {name:'OffsetTimeOriginal', type:'Ascii'}` 런타임 패치 후 주입을 시도하고, 실패하면 생략한다(Korea bbox라 photoTime이 KST(+32400) 강제 → 검증 결과 동일. 단 이 경우 exif.ts의 deviceOffset 폴백 경로가 작동함을 스크립트 주석에 남길 것).

```js
// scripts/make-geotagged.mjs — 골격
import piexif from 'piexifjs';
import fs from 'node:fs';
const BASE_JPEG_B64 = '...'; // 64x64 단색 JPEG (구현 시 1회 생성해 상수로 내장)
function dms(deg) { /* piexif.GPSHelper.degToDmsRational(deg) */ }
function make(name, lat, lon, dt /* 'YYYY:MM:DD HH:MM:SS' */) {
  const exif = {
    GPS: { [piexif.GPSIFD.GPSLatitude]: dms(Math.abs(lat)), [piexif.GPSIFD.GPSLatitudeRef]: lat >= 0 ? 'N' : 'S',
           [piexif.GPSIFD.GPSLongitude]: dms(Math.abs(lon)), [piexif.GPSIFD.GPSLongitudeRef]: lon >= 0 ? 'E' : 'W' },
    Exif: { [piexif.ExifIFD.DateTimeOriginal]: dt /* + OffsetTimeOriginal 패치 성공 시 '+09:00' */ },
  };
  const jpeg = Buffer.from(BASE_JPEG_B64, 'base64').toString('binary');
  fs.writeFileSync(`samples/${name}`, Buffer.from(piexif.insert(piexif.dump(exif), jpeg), 'binary'));
}
```

- [ ] **Step 1:** 스크립트 작성 + `node scripts/make-geotagged.mjs` → samples/ 7장 생성
- [ ] **Step 2:** seoul-1.jpg을 `tests/fixtures/geotagged-seoul-1.jpg`로 복사·커밋 (Task 8 exif 테스트 픽스처 — 클린 체크아웃에서도 테스트 자급)
- [ ] **Step 3:** `.gitignore`에 `samples/` 추가, 커밋 `feat(scripts): 지오태그 샘플 생성기 + 테스트 픽스처`

---

## Task 8: 가져오기 파이프라인 — exif·worker·썸네일·온보딩

**Files:**
- Create: `src/lib/exif.ts`, `src/lib/filePick.ts`, `src/lib/thumbnail.ts`, `src/worker/protocol.ts`, `src/worker/scan.worker.ts`, `src/hooks/useScan.ts`, `src/components/ImportOnboarding.tsx`
- Modify: `src/components/RootTabs.tsx` (EmptyImportState → ImportOnboarding 연결, liveQuery로 빈/채움 분기)
- Test: `tests/lib/exif.test.ts`

**SSR 가드 (App Router 필수):** db·worker를 만지는 컴포넌트는 `'use client'` + **mounted 가드**(또는 `next/dynamic` ssr:false). `new Worker(new URL('../worker/scan.worker.ts', import.meta.url))`는 **useScan 훅 내부에서 lazy 생성** — 모듈 스코프 금지. db 접근도 effect/핸들러 안에서만.

**worker 프로토콜 (확정):**

```ts
// src/worker/protocol.ts
import type { RawPhotoAsset } from '@/core/photoScan';
import type { PipelineResult } from '@/core/scanPipeline';
export type ScanRequest = {
  type: 'scan';
  photos: RawPhotoAsset[];               // exifr 산출(메인) — 구조화 복제 가능
  deviceOffsetSeconds: number;           // new Date().getTimezoneOffset() * -60 (UI 경계라 Date 허용)
  excludedTripSampleIDs: string[];       // 프로토는 항상 [] (pinnedPhotoIDs 연결만)
};
export type ScanProgress = { type: 'progress'; stage: 'loading-geo' | 'matching' | 'segmenting'; done: number; total: number };
export type ScanDone = { type: 'done'; result: PipelineResult };
export type ScanError = { type: 'error'; message: string };
export type ScanResponse = ScanProgress | ScanDone | ScanError;
```

**worker 동작:** 최초 scan 메시지에서 `fetch('/geo/sigungu.geojson')`+`/geo/region_codes.json` → geojsonDecode → GeoDataStore 1회 생성·캐시 → ScanPipeline 실행, 매칭 배치 200건마다 progress postMessage.

**exif.ts (시간 계약 명문화):** `exifr.parse(file, { reviveValues: false, ... })`로 **원문 문자열을 직접 파싱** — exifr의 Date revive는 실행 머신 로컬 TZ 해석이라 금지. `takenAt = parse('YYYY:MM:DD HH:MM:SS' wall time) − offsetSeconds` (OffsetTimeOriginal 있으면 그것, 없으면 deviceOffsetSeconds 폴백). GPS는 옵션 조합에 따라 pick이 GPS 태그를 걸러낼 수 있으니 `{gps:true}` 블록과 별도로 추출되는지 픽스처 테스트로 단언. `RawPhotoAsset` 필드명·형태는 photoScan 카드의 계약 그대로 — localIdentifier는 `hash(name:size:lastModified)` (FNV-1a, 별도 라이브러리 금지). 필터는 core/photoScan의 `scanPhotos`가 worker 쪽에서 수행 — exif.ts는 추출만.

**thumbnail.ts:** `createImageBitmap(file)` → OffscreenCanvas ≤256px → `convertToBlob({type:'image/jpeg', quality:0.7})`. HEIC 등 디코드 실패 시 null(placeholder). 동시 4개 제한(간단 세마포어). **단위 테스트 없음** — jsdom에 createImageBitmap/OffscreenCanvas 부재. Task 11 브라우저 검증으로 커버.

**useScan 오케스트레이션:** 파일들 → exif.ts(진행률 n/m) → worker scan → `reconcileScan(result)` → **썸네일 생성 후 `saveThumb()`로 db.thumbs 저장**(reconcile 이후, 실패해도 플로우 계속) → 완료 상태.

**ImportOnboarding.tsx:** "아직 가져온 사진이 없습니다" + **사진 가져오기** 버튼(`input multiple accept="image/*"` + `webkitdirectory` 폴백) + 드래그앤드롭존 + 진행률 바(EXIF 읽기 → 지역 매칭 → 여행 분할).

- [ ] **Step 1:** `tests/lib/exif.test.ts` 작성 — `tests/fixtures/geotagged-seoul-1.jpg`를 Node에서 읽어(File 폴리필 또는 Buffer 직접) GPS(37.5663, 126.9779 ±1e-4)·takenAt(2024-04-05 10:00 KST = 1712278800) 단언 → FAIL → exif.ts 구현 → PASS
- [ ] **Step 2:** worker + useScan + ImportOnboarding + RootTabs 분기 구현
- [ ] **Step 3:** `npm run build` → 빌드 성공 (worker 번들·SSR 가드 확인)
- [ ] **Step 4:** 커밋 `feat(import): exif→worker→reconcile 가져오기 파이프라인 + 온보딩`

---

## Task 9: 지역지도

**Files:**
- Create: `src/components/region/RegionMapScreen.tsx`, `src/components/region/Choropleth.tsx`, `src/components/region/StatHeader.tsx`, `src/components/region/LevelToggle.tsx`, `src/components/region/Legend.tsx`, `src/hooks/useRegionStatuses.ts`
- Modify: `src/components/RootTabs.tsx`, `src/styles/globals.css`(`.region[data-state]` 색 규칙)

**Choropleth 계약:** `/geo/korea-{level}.paths.json` fetch → `{viewBox, regions:[{code,name,d}]}` → region당 `<path data-code data-state d>`. 색은 순수 CSS: `path[data-state="visited"]{fill:var(--st-visited)}` 등. state 결정: `useRegionStatuses`(liveQuery)에서 `Map<code,state>`, 시도 레벨은 `regionAggregate.sidoStates`로 파생. 줌팬: core/mapViewport의 affine을 `<g transform>`에 적용, wheel/drag/+− 버튼, zoom∈[1,12], stroke-width `0.3/zoom`.

**StatHeader:** `"{시군구|시도} {n}/{total} 정복 · {pct}%"` — total 255/17. ⚠ **pct 라운딩 규칙은 iOS 원본(App/Views의 StatHeader 해당 뷰)에서 확인 후 테스트 기대값 확정** — 반올림/내림에 따라 7/255가 3% 또는 2%.

**빈 상태:** 사진 0장이면 "아직 분석된 지역이 없습니다" + 가져오기 버튼.

- [ ] **Step 1:** iOS 원본에서 정복률 라운딩 규칙 확인 → StatHeader·state 매핑 RTL 테스트 2건 작성 → FAIL → 구현 → PASS
- [ ] **Step 2:** Choropleth/줌팬/토글/Legend 구현, RootTabs 연결
- [ ] **Step 3:** 커밋 `feat(region): SVG choropleth 지역지도 + 정복률 헤더 + 레벨 토글`

---

## Task 10: 경로지도

**Files:**
- Create: `src/components/trip/TripListScreen.tsx`, `src/components/trip/TripRow.tsx`, `src/components/trip/TripMapView.tsx`, `src/hooks/useTrips.ts`
- Modify: `src/components/RootTabs.tsx`

**TripList:** trips$ liveQuery 최신순(startAt desc). TripRow: 제목(title ?? 자동: 대표지역 표시명 — **regionNames 합성 규칙("부산 연제구" 형식)을 그대로 따르고 RTL 테스트 기대값도 그 규칙으로 작성**, "지역1 · 지역2 외 N곳", 없으면 "위치 미상") + 날짜 범위 + 사진 수. 빈 상태 "아직 여행이 없습니다".

**TripMapView:** 행 탭 → 지도 화면. `maplibre-gl`은 **이 컴포넌트에서만 dynamic import**(`next/dynamic` ssr:false 또는 useEffect 내 import — 지역탭은 100% 오프라인 유지). **`import 'maplibre-gl/dist/maplibre-gl.css'` 필수**(누락 시 마커 깨짐). 스타일: `https://tiles.openfreemap.org/styles/positron` (무키). 핀: photosForTrip(tripID) sortIndex 순 — **`thumbFor(localIdentifier)`로 db.thumbs에서 blob 로드** → `URL.createObjectURL` Marker(accent 링), 언마운트 시 revoke·blob 없으면 placeholder 점. 경로선: coords≥2일 때 LineString(accent 해석값, width 3). 카메라: `fitBounds(trip bbox, {padding: 40})` + 최소 span 0.01°. **최초 진입 1회 고지**(localStorage 플래그): "경로지도는 지도 타일을 외부에서 불러옵니다 — 사진·위치 데이터는 전송되지 않습니다."

- [ ] **Step 1:** TripRow 라벨 RTL 테스트 2건(regionNames 규칙 합성, "위치 미상" 폴백) 작성 → FAIL → 구현 → PASS
- [ ] **Step 2:** TripMapView 구현 (지연 로드: 지역탭만 열 때 maplibre 네트워크 요청 없음 확인)
- [ ] **Step 3:** 커밋 `feat(trip): 여행 목록 + MapLibre 경로지도(핀·경로선·타일 고지)`

---

## Task 11: 수동 골든패스 검증 (완료 선언 게이트)

**전부 통과해야 "완료" 보고 가능 (coding-lessons 2026-04-23):**

- [ ] **Step 1:** `npm test` → 코어 골든 + 데이터 + 컴포넌트 전부 PASS, `npm run build` 성공
- [ ] **Step 2:** `npm run dev` → 브라우저(Claude in Chrome 또는 사용자)로:
  1. 첫 화면 = 가져오기 온보딩("아직 가져온 사진이 없습니다")
  2. samples/ 7장 선택 → 진행률 표시 → 완료. **드래그앤드롭 경로도 1회 확인**
  3. 지역지도: 시군구 7곳 색칠 + 헤더 "시군구 7/255 정복 · {규칙대로}%" + **Legend 표시** + 시도 토글 시 3곳/17
  4. 지역 줌팬 동작
  5. **지역지도 탭만 사용하는 동안 외부 네트워크 요청 0건** (DevTools Network — 프라이버시 약속 런타임 검증)
  6. 경로지도 탭: 여행 3개 최신순(제주→부산→서울) + 행 라벨(regionNames 규칙)
  7. 여행 열기: 타일 고지 1회 → 지도에 핀(썸네일) + 경로선 + bbox 카메라. **재진입 시 고지 다시 안 뜸**
  8. 새로고침 → 데이터 유지(Dexie) + **여행 재진입 시 핀 썸네일 유지(db.thumbs)**
- [ ] **Step 3:** 어긋나는 항목은 즉시 수정 후 재검증 (코어 의심 시 골든 테스트로 회귀)

---

## Task 12: 멀티에이전트 리뷰 + 최종 커밋

- [ ] **Step 1:** Code Reviewer + Security Engineer **병렬** 실행 (diff 전체 — 프라이버시 약속 "업로드 없음" 검증 포함: 외부 호출이 타일 fetch뿐인지)
- [ ] **Step 2:** High 이상 지적 반영 → `npm test` 재실행 green. Medium/Low는 todos에 이관 기록
- [ ] **Step 3:** README의 기능 현황 갱신(프로토 범위·제외 항목 명시), 최종 커밋 `feat: 프로토타입 수직 슬라이스 완성 — 가져오기→지역지도→경로지도`

---

## 리스크 메모 (실행 중 참조)

- **워크플로우 에이전트 충돌**: 파일 단위 소유권 — 각 에이전트는 자기 Create 파일만 생성, 오버라이드 표를 모든 프롬프트에 주입(카드 자체의 경로/정의 드리프트가 실질 충돌 벡터).
- **regionMatcher 골든 실패 시**: 좌표→코드 불일치는 대부분 geojsonDecode의 [lon,lat] 순서 또는 bbox prefilter 누락 — pointInPolygon부터 역추적.
- **worker 번들**: Next/webpack `new Worker(new URL(...))` 패턴 필수(파일 경로 문자열 금지). jsdom 테스트에선 worker 직접 테스트 대신 ScanPipeline을 단위로 검증(Task 4).
- **스키마 개정 기록**: 기반 스펙 v1 대비 — 테이블명 변경, regions PK `regionCode` 단순화(시도 2자리/시군구 5자리 비충돌), meta 테이블 제거(타일 고지는 localStorage). 델타 스펙에 1줄 반영 완료.
