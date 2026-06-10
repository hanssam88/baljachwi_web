# 프로토타입 수직 슬라이스 — 압축 실행 스펙 (델타)

> 작성일: 2026-06-10 · 수정일: 2026-06-10 · 기반 스펙: [`2026-06-10-web-port-design.md`](2026-06-10-web-port-design.md)
> 열람 범위: 내부용

## Context (왜)

기반 스펙은 Phase 1~6을 한 세션에 한 단계씩 골든 TDD로 진행하는 계획이다. 사용자가 **한 세션 안에 동작하는 결과물(풀 플로우 프로토타입)** 을 원해, 아키텍처·상수·스키마는 기반 스펙 그대로 두고 **범위와 실행 방식만 압축**한다. 이 프로토타입은 1회용 스파이크가 아니라 **본 구현의 기반**이다 — 코어는 byte-faithful로 제대로 포팅하므로 이후 세션은 빠진 기능(편집·백업·E2E)을 보강하는 방식으로 이어진다.

## 확정 결정사항 (사용자 확인 완료)

| 항목 | 결정 |
|------|------|
| 결과물 정의 | 풀 플로우 수직 슬라이스: 사진 가져오기(실제 EXIF) → 지역지도 색칠 → 경로지도 핀+경로선 |
| TDD 수준 | **코어만 골든 TDD**(Swift 테스트 이식, Red→Green). 데이터 레이어는 reconcile 핵심 테스트만. UI는 구현 후 스모크. 멀티에이전트 리뷰는 마지막 1회(Code Reviewer + Security Engineer 병렬) — 글로벌 규칙의 명시적 완화, 사용자 승인됨 |
| 영속화 | Dexie 포함 (기반 스펙 스키마 v1 그대로) |
| 검증 사진 | 샘플 지오태그 JPEG 생성 스크립트 (`scripts/make-geotagged.mjs`, piexifjs) |
| 경로지도 | MapLibre GL + 무키 외부 타일(CARTO/OpenFreeMap) — 유일한 외부 호출, 인앱 고지. 사용자 승인됨 |
| 코드 운명 | 본 구현의 기반 (Phase 1~4의 압축 선행) |
| 실행 방식 | 코어 모듈 의존성 레이어별 **병렬 워크플로우** 포팅, 통합·UI는 메인 컨텍스트 순차 |

## 범위

### 포함

1. **`src/core/*` 전체** — 기반 스펙 "Swift → TS 포트 매핑" 표의 모듈 전부, 임계값 byte-faithful. 골든 테스트(Swift 23개 테스트 이식) 선행
2. **데이터**: `data/db.ts`(Dexie v1 스키마) + `data/repo.ts`의 `reconcile`(멱등 upsert·prune·visited-wins·단일행 home) + `queries.ts`(liveQuery)
3. **가져오기**: `ImportOnboarding`(파일선택 + 드롭존 + 진행률), `lib/exif.ts`(exifr: GPS·DateTimeOriginal·OffsetTimeOriginal, PhotoScanService 필터 그대로), `worker/scan.worker.ts` + `protocol.ts`(12MB geojson 1회 파싱 + ScanPipeline), `lib/thumbnail.ts`(256px jpeg q0.7 blob)
4. **지역지도**: `region/Choropleth.tsx`(사전생성 SVG path + CSS 변수 색칠) + 정복률 헤더("시군구 n/255 정복 · m%") + 시군구/시도 토글 + MapViewport 줌팬 + Legend
5. **경로지도**: `trip/TripListScreen`(최신순, "지역1 · 지역2 외 N곳") + `trip/TripMapView`(MapLibre 지연 로드, 썸네일 핀 + 경로선 + fitBounds 최소 span) + 타일 외부호출 고지
6. **샘플 생성**: `scripts/make-geotagged.mjs` — 서울 3장·부산 2장·제주 2장, 시간 배치로 여행 2~3개 분할 유도

### 제외 (이후 세션)

여행 편집(분리/병합/제목/삭제) · RegionDetailSheet/가고싶음 · 백업 · 다크모드 수동 토글 · 접근성 폴리시 · HEIC 썸네일(placeholder로 동작은 함) · Playwright E2E 확장(기존 스모크 유지) · 배포

제외 항목에 대비한 추상화를 미리 만들지 않는다(YAGNI). 단 `excludedTripSampleIDs` 파라미터는 코어 시그니처에 이미 있으므로 그대로 포팅한다(빈 배열 전달).

## 아키텍처 — 기반 스펙 그대로

```
파일선택/드래그 → exifr(메인) → ScannedPhoto[]
  → [scan.worker] geojson 파싱 + ScanPipeline(tz→매칭→여행분할→집계)
  → repo.reconcile(Dexie rw) + 썸네일 저장 → liveQuery → 지도 리페인트
```

신규 의존성: `dexie`, `dexie-react-hooks`, `exifr`, `maplibre-gl` (런타임) / `piexifjs`, `fake-indexeddb` (dev).

geo 자산: `korea-*.paths.json`은 Phase 0에서 생성 완료. 매칭용 `sigungu.geojson`(12MB)·`region_codes.json`은 `BALJACHWI_IOS_ROOT=../baljachwi npm run copy-geo`로 복사(골든 테스트도 이 파일 사용).

## 실행 전략 (병렬 워크플로우)

- **Wave 1 (메인)**: `geoTypes.ts` + `visitState.ts` 등 공유 타입 — 병렬 작업의 공통 기반이므로 먼저 단일 컨텍스트로
- **Wave 2 (병렬)**: 잎 모듈 — pointInPolygon · photoTime · mapProjection · mapViewport · geojsonDecode · regionAggregate. 에이전트별로 Swift 원본+테스트를 읽고 골든 테스트 먼저(Red) → 구현(Green)
- **Wave 3 (병렬)**: 의존 모듈 — regionMatcher(+RegionNames/GeoDataStore) · tripSegmenter · tripMetrics
- **Wave 4 (메인, 순차)**: scanPipeline 통합 → data(Dexie+reconcile 테스트) → exif/worker/thumbnail → 지역지도 → 경로지도 → 샘플 스크립트
- **마지막**: Code Reviewer + Security Engineer 병렬 리뷰 → High 이상 반영 → 전체 테스트 green → 커밋

병렬 에이전트 산출물은 메인이 머지 전 골든 테스트 실행으로 게이트한다(green 아니면 머지 안 함).

## 검증 (완료 선언 조건)

1. `npm test` — 코어 골든 전부 green (실제 12MB geojson 사용) + reconcile 테스트 green
2. `scripts/make-geotagged.mjs`로 샘플 생성 → dev 서버에서 가져오기 → 진행률 표시 → 지역지도에 서울·부산·제주 시군구 색칠 + 헤더 정복률 → 시군구/시도 토글 → 경로지도 탭에서 여행 목록 → 여행 열기 → 핀+경로선 확인. **직접 브라우저로 확인 후에만 완료 보고** (coding-lessons 2026-04-23 교훈)
3. 새로고침 후 데이터 유지(Dexie) 확인
