# 전역 포팅 규칙 (모든 코어 포팅 에이전트 공통)

Swift `BaljachwiCore` → TypeScript byte-faithful 포팅. 너는 한 모듈을 담당한다.

## 작업 순서 (TDD, 엄격)
1. 담당 모듈의 카드(`docs/plans/cards/<key>.md`), Swift 원본·테스트 파일을 **Read로 전부 읽는다**.
2. `tests/<경로>/<모듈>.test.ts` 를 **먼저 작성** (카드 testsToPort + Swift 테스트 원본 기반).
3. `npx vitest run <테스트파일>` 실행 → **실패 확인** (Red).
4. 카드 exportsTs 계약대로 구현.
5. `npx vitest run <테스트파일>` → **통과 확인** (Green).
6. **커밋하지 말 것** — 메인이 wave 단위로 게이트 후 커밋한다.
7. 자기 Create 파일 외 다른 파일 생성·수정 금지 (파일 소유권).

## 불변 규칙
1. 카드 `exportsTs` 시그니처 그대로 export — **단 아래 오버라이드 표가 카드보다 우선**.
2. 카드 `constants` 전부 보존, `notes` 함정 준수.
3. 시간은 epoch **초** number 정수 산술만 — JS `Date` 객체·`getHours`·타임존 메서드 금지.
4. Swift Optional → `| null` (undefined 금지). `Dictionary(uniquingKeysWith: first)` → `if (!map.has(k)) map.set(k,v)` (first-wins).
5. 정렬은 명시 비교자(숫자는 `(a,b)=>a-b`), tie-break 순서 그대로.
6. Swift Double = JS number (둘 다 float64). 골든은 이산 출력(문자열·그룹) 단언, 파생 float는 적정 tolerance.

## 카드 오버라이드 표 (이쪽이 정답)

| 카드 | 카드 내용 | 오버라이드 |
|---|---|---|
| photoScanFilter | 헤더 `// src/lib/exif.ts` | 파일은 **`src/core/photoScan.ts`** |
| models | VisitState를 db.ts 단일 정의, 한 파일 | **`src/data/models.ts`(타입+팩토리) + `src/data/db.ts`(Dexie) 분리**. VisitState/RegionLevel은 `src/core/visitState.ts`에서 import(이미 존재) — models.ts는 re-export만 |
| models | Dexie 4테이블 | **5테이블** — `thumbs: '&localIdentifier'` 추가. 인덱스: `photoRefs: '&localIdentifier, tripID'`, `tripRecords: '&id, startAt'`, `regionStatuses: '&regionCode, level'`, `homeCache: '&id'`, `thumbs: '&localIdentifier'` |
| dataActorReconcile | `import "../geo/geoTypes"` / 레코드 타입 자체 정의 | 경로 `../core/geoTypes`. 레코드 타입은 `src/data/models.ts`에서 import |

## 이미 완성된 의존 모듈 (import해서 사용, 재정의 금지)
- `src/core/geoTypes.ts` — `Coordinate{lat,lon}`, `Polygon{outer,holes}`, `MultiPolygon{polygons}`, `BBox{minLat,minLon,maxLat,maxLon}`, `makePolygon(outer, holes=[])`
- `src/core/visitState.ts` — `VisitState`('visited'|'wantToGo'|'notVisited'), `VISIT_STATE_ALL_CASES`, `parseVisitState`, **`RegionLevel`('sido'|'sigungu')**
- `src/data/models.ts` — `PhotoRef`, `TripRecord`, `RegionStatus`, `HomeCache`, 팩토리(`makePhotoRef` 등), `HOME_CACHE_ROW_ID`. VisitState/RegionLevel은 여기서도 re-export됨(단 신규 모듈은 core/visitState에서 직접 import 권장)
- `src/data/db.ts` — Dexie `db` 인스턴스(5테이블)

## import 별칭
`@/` = `src/` (tsconfig + vitest 설정 완료). 예: `import { Coordinate } from '@/core/geoTypes'`.

## 데이터 테스트 환경 (models·reconcile·repo만 해당)
테스트 파일 최상단에 `import 'fake-indexeddb/auto';` + 파일 첫 줄 독블록 `// @vitest-environment node`. **Blob을 fake-indexeddb에 넣는 테스트 금지**(structured clone 불가).

## Swift 원본 루트
`C:/Users/sengmin.hyun/Downloads/baljachwi/BaljachwiCore/Sources/BaljachwiCore/` (소스)
`C:/Users/sengmin.hyun/Downloads/baljachwi/BaljachwiCore/Tests/BaljachwiCoreTests/` (테스트)

## 반환 형식
구현 완료 후 {모듈키, 생성파일목록, 테스트통과수, 막힌점(없으면 null)} 을 보고하라.
