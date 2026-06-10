# 발자취(Baljachwi) iOS → 웹 포트 — 구현 스펙 & 계획

> 작성일: 2026-06-10 · 수정일: 2026-06-10 · 포팅 원본: `hanssam88/baljachwi` (private, iOS) · 웹 코드: **별도 repo `baljachwi-web`**
> 열람 범위: 내부용

## Context (왜 이 작업을 하는가)

발자취는 **사진의 GPS+촬영시간 EXIF를 읽어 ① 한국 시군구/시도 등고선 지도(방문/가고싶음/미방문 색칠) ② 여행 경로 지도(사진 핀+경로선)** 를 만드는 iOS 앱이다. 온디바이스·프라이버시 우선(업로드 없음)이 핵심 가치이고, iOS 7단계 개발이 거의 완료된 성숙한 앱(코어 알고리즘 순수·결정론적, 23개 단위 테스트 통과)이다.

목표는 이 앱을 **웹에서 동작하는 동등 기능 버전**으로 포팅하는 것이다. 결정적 이점: `BaljachwiCore`가 의도적으로 `Calendar.current`/`TimeZone.current`/시스템 클럭을 전혀 읽지 않고 정수 epoch 산술 + 주입식 임계값으로 작성돼 있어(`PhotoTime.swift`, `TripSegmenter`) **TypeScript로 골든 출력이 동일하게 포팅 가능**하다. 또한 iOS repo의 `design/` 폴더에 이미 iOS와 동일한 투영(equirectangular, refLat 36°)으로 시군구 SVG path를 생성하는 웹 프로토타입(`gen-choropleth.mjs`, `korea-sigungu.js` 216KB)과 디자인 토큰(`tokens.js`)이 존재해 지역지도의 절반 이상이 검증된 자산이다.

## 핵심 전략

1. `BaljachwiCore` 23개 모듈을 **임계값까지 그대로(byte-faithful)** TS로 포팅 → 23개 Swift 테스트를 Vitest 골든 테스트로 먼저 이식(TDD Red)
2. 12MB 매칭 GeoJSON 로드 + 점-다각형 매칭을 **Web Worker**로 격리(UI 비차단)
3. 영속화는 **Dexie(IndexedDB)** — SwiftData `@Query` ↔ Dexie `liveQuery`, `DataActor`(단일 writer) ↔ 모든 쓰기를 `repo.ts`의 `rw` 트랜잭션으로
4. 지역지도는 `gen-choropleth.mjs`를 포팅해 **사전생성 SVG path** 렌더(고충실·저위험), 경로지도는 **MapLibre GL**
5. iOS의 무음 자동 스캔 → 웹은 **명시적 "사진 가져오기" 온보딩 + 진행률**로 대체
6. 디자인 토큰(`tokens.js`)을 CSS 변수로 — 확정 조합 **nature(딥그린) + semantic(의미색)**

## 확정 결정사항

| 항목 | 결정 |
|------|------|
| 범위 | 전체 포트 — 지역지도 + 경로지도 + 여행 편집(분리/병합/제목/삭제) |
| 사진 입력 | 클라이언트 파일선택/드래그앤드롭, 브라우저 EXIF(exifr) 파싱, **업로드 없음** |
| 스택 | Next.js(App Router) + React + TypeScript |
| 지리 범위 | 한국 전용(기존 GeoJSON 번들) |
| 저장 | 100% 클라이언트 IndexedDB(Dexie) + JSON 백업 내보내기/가져오기 |
| 위치/배포 | **별도 repo `baljachwi-web`** (자립형), Vercel. iOS 클론은 `BALJACHWI_IOS_ROOT`로 geo·디자인 원본 참조 |
| UX | iOS 2탭 충실 재현(동일 한국어 라벨·색·흐름) + 가져오기 온보딩 추가 |
| 지도 라이브러리 | 경로지도 = MapLibre GL(기본맵 타일이 유일한 외부 호출) |
| EXIF | exifr(부분 읽기) — GPS·DateTimeOriginal·OffsetTimeOriginal |

## 아키텍처 개요

```
파일선택/드래그 → exifr(메인) → ScannedPhoto[]
   → [scan.worker] 12MB geojson 1회 파싱 + ScanPipeline(tz→매칭→여행분할→집계)
   → repo.reconcile(메인, Dexie rw 트랜잭션) + 썸네일(256px blob) 저장
   → liveQuery → 지역지도/경로지도 자동 리페인트
```

원본 사진은 **저장하지 않음**(메타데이터 + 사진당 작은 썸네일 blob만). 프라이버시 보장 + IndexedDB 경량화.

## 폴더 구조 (repo 루트 = 웹 앱)

```
baljachwi-web/
├── public/geo/                 region_codes.json(35KB) · sigungu.geojson(12MB 매칭, worker 전용)
│                               sigungu_display.geojson(3.2MB) · sido_display.geojson(1.5MB)
│                               korea-sigungu.paths.json (사전생성 SVG path) + korea-sido.paths.json
├── scripts/                    copy-geo.mjs(코어 Resources→public 복사) · gen-choropleth.mjs(포팅)
├── src/
│   ├── core/                   ← BaljachwiCore의 byte-faithful TS 포트 (No React/DOM/IO)
│   ├── data/                   db.ts(Dexie) · repo.ts(쓰기 API) · reconcile.ts · backup.ts · queries.ts
│   ├── worker/                 scan.worker.ts · protocol.ts · thumbs.ts
│   ├── lib/                    exif.ts(exifr) · filePick.ts · thumbnail.ts · format.ts · tokens.ts
│   ├── hooks/                  useScan · useRegionStatuses · useTrips · usePhotosForTrip
│   ├── components/             region/* · trip/* · shared/* · ImportOnboarding · ScanStateGate · RootTabs
│   ├── styles/                 globals.css · tokens.css(라이트/다크 [data-appearance])
│   └── app/                    layout.tsx · page.tsx (클라이언트 SPA, 서버 라우트 없음)
└── tests/                      core/(골든) · data/(fake-indexeddb) · components/(RTL) · e2e/(Playwright)
```

## Swift → TS 포트 매핑 (임계값 그대로 보존)

| Swift 소스 | TS 타겟 | 보존 상수 / 비고 |
|---|---|---|
| `GeoTypes.swift` | `core/geoTypes.ts` | Coordinate{lat,lon}, Polygon{outer,holes}, MultiPolygon, BBox |
| `PointInPolygon.swift` | `core/pointInPolygon.ts` | crossing-number, half-open `(vi.y>p.y)!==(vj.y>p.y)`, strict `p.x<xIntersect`(leftBottomInclusive), 링<3→false, `inOuter && !inAnyHole` |
| `PhotoTime.swift` | `core/photoTime.ts` | Korea bbox lat∈[33.0,38.9] lon∈[124.6,132.0]→**+32400s**; else exif; else device. **정수 epoch 산술만**(`Date.getHours()` 금지) |
| `RegionMatcher.swift` | `core/regionMatcher.ts` | prefilter 동일 bbox, `boundaryAbsorbMeters=100.0`, tie-break **최소 regionCode**, planar `kx=cos(lat)·deg2rad·R, ky=deg2rad·R, R=6_371_000`, sigungu 후보만 |
| `TripSegmenter.swift` | `core/tripSegmenter.ts` | **jumpKM=90, gapHours=8, homeSuppressionRadiusKM=18, stayShiftKM=40, nightStartHour=21, nightEndHour=6, minHomeNights=3, burstMeters=50, burstSeconds=120, homeClusterRadiusKM=18, trivialMinPhotos=2, trivialRadiusKM=5, trivialDurationHours=4**. Haversine R=6_371_000. 정렬 takenAt asc, tie id asc. 분할규칙 ①~⑤ 순서. `excludedTripSampleIDs` |
| `TripMetrics.swift` | `core/tripMetrics.ts` | representativeRegionCode=최빈, tie 최소 코드; compute→start/end/bbox/rep |
| `RegionAggregate.swift` | `core/regionAggregate.ts` | `code.slice(0,2)` 그룹, rank visited2>wantToGo1>notVisited0 |
| `ScanPipeline.swift` | `core/scanPipeline.ts` | tripID=`"${trunc(startAtSec)}_${firstSampleID}"`, regions/trips 코드·startAt asc, exifOffset 전달 |
| `MapProjection.swift` | `core/mapProjection.ts` | refLat=36.0, `x=(lon-minLon)·cos36·scale, y=(maxLat-lat)·scale`(Y-flip) |
| `MapViewport.swift` | `core/mapViewport.ts` | affine translate·scale·translate, invert; SVG 줌/팬 + 탭 |
| `GeoJSONDecode.swift` | `core/geojsonDecode.ts` | `[lon,lat]→{lat,lon}` 단일 변환점, Polygon→MultiPolygon, 첫 링 outer |
| `GeoDataStore/DisplayGeoStore/RegionNames` | `core/*.ts` | **생성자가 파싱된 JSON을 받음**(Bundle 대신) — IO를 경계로 격리. RegionNames "부산 연제구" |
| `VisitState.swift` | `core/visitState.ts` | `'visited'\|'wantToGo'\|'notVisited'` |
| `DataActor.swift` | `data/repo.ts`+`reconcile.ts` | upsert/prune/userOverride 면제/visited-wins/단일행 home/merge·split·title·delete 가드 그대로 |

**충실성 가드**: 위 상수는 전부 이식한 골든 테스트로 검증 → 드리프트 시 CI 실패. Swift Double·JS number 모두 float64이며 골든은 이산 출력(regionCode 문자열·여행 그룹)을 단언하므로 안전(파생 float는 tolerance).

## 데이터 레이어 (Dexie / IndexedDB)

`idb` 대신 **Dexie** 선택 — `liveQuery`(=SwiftData `@Query`), 복합 인덱스, 트랜잭션, `dexie-react-hooks` 제공.

```ts
db.version(1).stores({
  photos:  '&localIdentifier, tripID, regionCode, takenAt, userOverride',
  regions: '&[regionCode+level], level, state, userOverride',
  trips:   '&id, startAt, userOverride',
  home:    '++id',          // 코드로 단일행 강제
  thumbs:  '&localIdentifier', // blob 분리(백업 제외 옵션)
  meta:    '&key',          // schemaVersion, deviceOffsetSeconds, appearance
});
```

- `localIdentifier`(웹) = `hash(file.name:size:lastModified)` — PHAsset id 없음, dedup+썸네일 키
- **단일 writer**: 모든 변경은 `repo.ts`의 `db.transaction('rw', …)` 경유(원자성). `reconcile`(전체 가져오기=upsert+prune+syncHome, userOverride 면제·visited-wins), `apply`(추가 가져오기=prune 없음), `merge/split/setTitle/delete/pruneMissingPins` 가드 이식
- `pinnedPhotoIDs()`(userOverride=1) → 다음 스캔의 `excludedTripSampleIDs`(편집 영속성)

## 사진 가져오기 파이프라인

1. **메인**: `input[webkitdirectory]` + 다중파일 fallback + 드래그드롭 → `File[]`
2. **메인 exifr**: GPS + DateTimeOriginal + OffsetTimeOriginal → `PhotoScanService.swift` 필터 그대로(GPS 없으면 skip, `|lat|<1e-7&&|lon|<1e-7` skip, 날짜 없으면 skip, localIdentifier dedup)
3. **worker**(geojson 보유) `postMessage` → `ScanPipeline.build` → `PipelineResult`(구조화 복제 가능 plain object)
4. **메인** `repo.reconcile(result)` + 썸네일 `createImageBitmap`→OffscreenCanvas(≤256px)→`convertToBlob(jpeg,0.7)`→`db.thumbs`
5. `liveQuery` 발화 → 지도 리페인트

**Worker 프로토콜**: `{type:'scan', photos, deviceOffsetSeconds, excludedTripSampleIDs}` → `progress(loading-geo|matching|segmenting)` / `done(result)` / `error`. 진행률: 메인 EXIF 루프(파일당) + worker 매칭(배치 200) 청크 보고.

## 지역지도 렌더링 — SVG path(사전생성)

iOS repo `design/gen-choropleth.mjs`가 **이미 iOS 투영과 동일**(`x=(lon-minLon)·cos36·scale, y=(maxLat-lat)·scale`)하게 시군구 path를 생성 → `scripts/gen-choropleth.mjs`로 포팅해 `korea-sigungu.paths.json`(+sido) 생성. (Canvas/react-simple-maps 대비 hit-test·접근성·충실도 우수)

- `Choropleth.tsx`: region당 `<path data-state data-code>`, 색은 **순수 CSS**(`--st-*` × `data-state`) → 테마/레벨 토글 시 0 리렌더
- 줌/팬: `MapViewport` affine을 `<g transform=matrix>`, zoom∈[1,12], +/− `zoomBy(1.8)`, stroke `0.3/zoom`
- **탭→regionCode**: 네이티브 SVG hit-test(`evt.target.dataset.code`) — 메인 스레드에 matcher 불필요
- 색칠: `useLiveQuery(db.regions, level)` → 시도는 `RegionAggregate.sidoStates`로 파생
- 시군구/시도 토글: path 아티팩트 교체 + `key={level}`로 줌 리셋, 시도는 탭 비활성(표시 전용)
- 헤더: `"{시군구|시도} {n}/{total} 정복 · {pct}%"`, total **255/17**
- 접근성: path마다 `aria-label="부산 연제구, 방문, 24장"`(WCAG SC 1.4.11)

## 경로지도 — MapLibre GL

- 사진 핀: `PhotoRef`(sortIndex 순) 썸네일 blob `URL.createObjectURL`을 Marker, accent 링, 언마운트 시 revoke
- 경로선: sortIndex 순 LineString, `line` 레이어 `--accent` width 3, coords≥2일 때만
- 카메라: `fitBounds(trip.bbox, padding)` + **최소 span≈0.01°**(과확대 방지)
- **기본맵 타일 = 유일한 외부 호출**: CARTO positron / OpenFreeMap(무키, 프라이버시 친화). 최초 진입 시 고지("경로지도는 지도 타일을 외부에서 불러옵니다 — 사진/위치 데이터는 전송되지 않습니다"). MapLibre는 경로탭 진입 시 **지연 로드**(지역탭·가져오기는 100% 오프라인). 사진/GPS/식별자는 절대 전송 안 함, 표준 XYZ 타일 요청만
- 빈 상태: "이 여행의 사진을 찾을 수 없습니다"

## 컴포넌트 ↔ iOS 화면 매핑 (한국어 라벨 그대로)

| iOS | 웹 | 비고 |
|---|---|---|
| `RootTabView` | `RootTabs.tsx` | 탭 **지역지도/경로지도**; 빈 DB→`ImportOnboarding` |
| (신규) | `ImportOnboarding.tsx` | **사진 가져오기** CTA+드롭존+진행률(무음 자동스캔 대체) |
| `ScanStateGate` | `ScanStateGate.tsx` | 권한분기→**가져오기-빈 상태**("아직 가져온 사진이 없습니다"), scanning/error 유지 |
| `RegionMapScreen` | `region/RegionMapScreen.tsx` | 빈: "아직 분석된 지역이 없습니다" |
| `ChoroplethCanvasView` | `region/Choropleth.tsx` + StatHeader/LevelToggle/Legend | SVG |
| `RegionDetailView` | `region/RegionDetailSheet.tsx` | BottomSheet(.medium), 뱃지 방문/가고싶음/방문 기록 없음, "{n}장"+날짜범위, "가고싶음에 추가"(방문 시 숨김) |
| `TripListView`/`TripRow` | `trip/TripListScreen.tsx`/`TripRow.tsx` | 최신순, "지역1 · 지역2 외 N곳"/"위치 미상", 빈: "아직 여행이 없습니다" |
| `TripMapView` | `trip/TripMapView.tsx` | MapLibre, 툴바 **분리**(<2 비활성)/**제목** |
| `SplitTripView` | `trip/SplitTripView.tsx` | "여행 나누기", "여기서 나누기"/"여기서 나눌까요?" |
| 병합/삭제 | `TripEditToolbar.tsx`/스와이프 | **선택/완료/병합**, "이 여행을 삭제할까요?" |
| (신규) | `settings/BackupPanel.tsx` | 백업 내보내기/가져오기/초기화 |

## 디자인 시스템 — 토큰 포팅

iOS repo `design/tokens.js` → `lib/tokens.ts` + `styles/tokens.css`. 확정 **nature+semantic**. `<html data-appearance>`로 라이트/다크.

```css
[data-appearance="light"]{--accent:#2E7D5B;--st-visited:#3A9D6B;--st-want:#E0982E;--st-unvisited:#DDDDE3;--bg:#F2F2F7;--surface:#FFF;--label:#1C1C1E;--label2:#6E6E73;--separator:#D7D7DC;}
[data-appearance="dark"] {--accent:#5BC08A;--st-visited:#4FB888;--st-want:#F0B84E;--st-unvisited:#38383E;--bg:#000;--surface:#1C1C1E;--label:#F5F5F7;--label2:#9A9AA0;--separator:#3A3A3C;}
```

SPACE=[4,8,12,16,20,24], RADIUS={sm:8,md:12,lg:16}, 타입스케일 이식. 기본은 `prefers-color-scheme`, 수동 override는 `db.meta`.

## 백업 & 스키마 버전

- **내보내기**: 전 테이블 → `baljachwi-backup-YYYYMMDD.json`. 썸네일은 용량 지배적이라 **"기록만(작음)" 기본** / "썸네일 포함(큼)" 옵션
- **가져오기**: zod 검증 → 마이그레이션 체인 → `rw` bulkPut(클린 복원은 confirm 후 clear)
- **스키마 버전**: iOS 가산식(V1→V2 HomeCache, V2→V3 title) 그대로. `meta.schemaVersion`, Dexie `version(n).upgrade`, 백업은 vN→v현재 전진 마이그레이션
- **초기화**: "데이터 초기화" = `db.delete()` 재생성(`DataActor.deleteAll`)

## 테스트 전략 (TDD — 실패 테스트 먼저)

- **골든(Vitest `tests/core/`)**: Swift 픽스처 1:1 이식. RegionMatcher 골든좌표(서울시청 11140, 부산역 26170, 제주공항 50110, 백령도 멀티섬 28720, 경계흡수 울릉 47940; Paris/(0,0)→null) — 실제 12MB geojson을 Node `fs`로 로드. TripSegmenter(다일/당일/홈점프/시간갭/버스트/홈억제/홈nil fallback), PointInPolygon(홀/멀티섬/leftBottom), PhotoTime(KST/롤오버/음수오프셋), ScanPipeline/TripMetrics/RegionAggregate/MapProjection/MapViewport
- **데이터(Vitest + fake-indexeddb)**: DataActor* 이식 — upsert 멱등, userOverride 보존, prune, visited-wins, merge/split 가드, pruneMissing, 단일행 home
- **컴포넌트(RTL)**: RegionDetailSheet(뱃지/장수/날짜, 방문 시 want 숨김), TripRow(외 N곳), SplitTripView, ScanStateGate 분기, StatHeader 텍스트
- **E2E(Playwright)**: 가져오기→진행률→지역 녹색→탭→상세→경로지도→여행→지도/핀→이름변경/분리/병합 라운드트립; 백업→초기화→복원

## 단계별 마일스톤 (각 단계 배포 가능·테스트 게이트)

| 단계 | 범위 | 게이트 |
|---|---|---|
| **0 스캐폴드+토큰** | Next/TS/Vitest/Playwright, copy-geo+gen-choropleth, tokens→CSS, RootTabs 빈 2탭 | 빌드·탭 렌더·토큰 존재 |
| **1 코어 포트+골든(TDD)** | `core/*` 전부, 골든 먼저(Red→Green) | 전 골든 green(실제 geojson) |
| **2 가져오기+worker+데이터** | exifr, filePick, scan.worker+protocol, Dexie+repo.reconcile/apply, 썸네일 | 데이터 단위테스트 green, 픽스처 가져오기 채움 |
| **3 지역지도** | Choropleth(SVG/줌팬/CSS색), StatHeader/Legend/LevelToggle, liveQuery | 컴포넌트 테스트 + E2E 녹색 지역 |
| **3b 지역상세+가고싶음** | RegionDetailSheet, setWantToGo(visited-wins/방문 시 숨김) | RTL + 데이터 테스트 |
| **4 경로지도** | 지연 MapLibre, TripList/Row, TripMapView(핀+선+bbox), PhotoThumbnail, 타일 고지 | 컴포넌트 + E2E 지도 |
| **4b 여행 편집** | merge/split/title/delete, excludedTripSampleIDs 영속 | merge/split/delete/title 데이터 테스트 + E2E |
| **5 백업+다듬기** | BackupPanel, 스키마버전+zod, 다크모드, 접근성, 모바일 picker | export→reset→import E2E |
| **6 배포** | Vercel, `/geo/*` 캐시헤더, 12MB 검증, 성능 | 배포 URL 스모크 |

## 리스크 & 완화

- **12MB geojson**: worker에서 가져오기 시점에만 로드(지역탭은 사전생성 path 사용), 1회 파싱 캐시, gzip+장기 캐시, 빌드 후 raw null
- **대량 사진 성능**: exifr 부분읽기, worker bbox prefilter+좌표 메모이즈, 청크 진행, 동시 디코드 4개 제한(iOS autoreleasepool 대응)
- **썸네일 용량/쿼터**: 256px q0.7 ≈10~30KB, 5k장≈50~150MB. `storage.persist()`/`estimate()` 경고, thumbs 분리 저장(백업 제외·공간확보), 기록만 백업 안전망
- **MapLibre 타일 프라이버시**: 유일 외부 호출, 경로 기본맵 한정, 지연로드, 무키 프라이버시 제공자, 인앱 고지, 사진/GPS 절대 미전송
- **EXIF 엣지**: GPS 없음→skip(+추후 "위치정보 없음 N장"), tz 없음→device fallback(Korea bbox는 KST 강제). **HEIC**: exifr가 메타데이터는 읽어 지역/여행은 동작, 썸네일은 placeholder 또는 heic2any/libheif-wasm 지연 opt-in
- **Vercel 정적자산**: 12MB는 public/ 정적 서빙 한도 내(serverless 번들 아님), 문제 시 별도 CDN fetch 경로만 변경
- **모바일 picker**: webkitdirectory는 모바일 Safari 불안정 → 다중파일 input fallback + 데스크톱 드래그드롭
- **float 결정성**: 둘 다 float64, 골든은 이산 출력 단언(파생 float는 tolerance)

## 검증 방법 (End-to-End)

1. `npm run dev` → 빈 상태에서 **사진 가져오기**로 지오태그 JPEG 폴더(예: iOS `scripts/make_geotagged.swift` 산출물) 선택 → 진행률 표시
2. **지역지도** 탭: 알려진 지역(예 서울 11140)이 녹색 색칠, 헤더 "시군구 n/255 정복 · m%", 시군구↔시도 토글, 지역 탭→상세 시트(장수·날짜·가고싶음)
3. **경로지도** 탭: 여행 목록(최신순)→여행 열기→지도에 핀+경로선, **분리/병합/제목/삭제** 라운드트립
4. **백업**: 내보내기→데이터 초기화→가져오기로 상태 복원
5. **자동화**: `npm test`(Vitest 골든+데이터+컴포넌트 전부 green) + `npm run e2e`(Playwright 가져오기→지도 흐름)
6. 배포 후 production URL에서 양 지도 렌더 스모크

## 재사용 자산 (iOS 클론 경로 — BALJACHWI_IOS_ROOT 기준)

- 알고리즘: `BaljachwiCore/Sources/BaljachwiCore/{TripSegmenter,RegionMatcher,PointInPolygon,PhotoTime,ScanPipeline,DataActor,MapProjection,MapViewport,GeoJSONDecode,RegionAggregate,TripMetrics,RegionNames}.swift`
- 테스트(이식 원본): `BaljachwiCore/Tests/BaljachwiCoreTests/*.swift` (23개)
- 지역지도 프로토타입: `design/gen-choropleth.mjs`, `design/korea-sigungu.js`, `design/app.js`, `design/index.html`
- 디자인 토큰: `design/tokens.js`, `App/Theme/Tokens.swift`
- 데이터: `BaljachwiCore/.../Resources/{region_codes.json, sigungu.geojson, sigungu_display.geojson, sido_display.geojson}`
- iOS UI 참조: `App/Views/*.swift` (라벨·흐름 그대로)

## 실행 시 워크플로우 노트

- 각 단계는 글로벌 CLAUDE.md 워크플로우 준수: **실패 테스트 먼저(TDD Red) → 최소 구현(Green) → Code Reviewer + Security Engineer 병렬 리뷰 → 전체 테스트 통과 후 커밋**
- 한 세션 = 한 단계 권장. 단계 완료 시 `/clear` 후 다음 단계
