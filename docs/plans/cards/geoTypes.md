# 모듈 카드: geoTypes

**TS 타겟:** src/core/geoTypes.ts + src/core/visitState.ts

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
// ── src/core/geoTypes.ts ──────────────────────────────────────────────
// PointInPolygon은 위상 판정이므로 투영 없이 (x = lon, y = lat) 평면을 그대로 사용
// (MapProjection 비의존). 이 주석은 pointInPolygon 포팅 시 축 혼동 방지용으로 보존할 것.

/** 위경도 좌표. Swift: Equatable+Hashable — TS에서는 구조적 비교 헬퍼로 대체. */
export interface Coordinate {
  lat: number;
  lon: number;
}

/** 단일 폴리곤 — 외곽 링 1개 + 0개 이상의 홀. holes는 옵셔널 금지(항상 [] 명시). */
export interface Polygon {
  outer: Coordinate[];
  holes: Coordinate[][];
}

/** 다중 폴리곤 — 옹진군·신안군 등 다도서 표현. 매칭/히트테스트 SSOT 입력 타입. */
export interface MultiPolygon {
  polygons: Polygon[];
}

/** 경계 박스. Swift 원본은 TripSegmenter.swift:41 정의지만 웹 포트에서는 geoTypes로 이전 배치(공유 타입 SSOT). */
export interface BBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

/** Swift Polygon.init(outer:holes: = []) 의 기본 인자 대응 헬퍼. */
export function makePolygon(outer: Coordinate[], holes: Coordinate[][] = []): Polygon {
  return { outer, holes };
}

// ── src/core/visitState.ts ────────────────────────────────────────────
/** 지역 방문 상태. Swift: enum String RawValue — JSON 영속 문자열과 1:1. */
export type VisitState = 'visited' | 'wantToGo' | 'notVisited';

/** Swift CaseIterable.allCases — 선언 순서 보존: visited, wantToGo, notVisited. */
export const VISIT_STATE_ALL_CASES: readonly VisitState[] = ['visited', 'wantToGo', 'notVisited'];

/** Swift VisitState(rawValue:) 실패 가능 이니셜라이저 대응. 미지 문자열은 undefined (throw 금지). */
export function parseVisitState(raw: string): VisitState | undefined {
  return (VISIT_STATE_ALL_CASES as readonly string[]).includes(raw)
    ? (raw as VisitState)
    : undefined;
}
```

## 보존 상수 (constants)

- VisitState.visited="visited"
- VisitState.wantToGo="wantToGo"
- VisitState.notVisited="notVisited"
- VISIT_STATE_ALL_CASES 순서=[visited, wantToGo, notVisited] (Swift 선언 순서)

## 포팅할 테스트 (testsToPort)

### visitState rawValue/parse/allCases (Swift: ModelTests.testVisitStateRawValueAndCases, ModelTests.swift:32-36)
(1) 'visited' 리터럴 === "visited" (rawValue 동등성), (2) parseVisitState("wantToGo") === 'wantToGo', (3) new Set(VISIT_STATE_ALL_CASES)가 {visited, wantToGo, notVisited}와 동일하고 크기 3. 추가로 배열 순서 [visited, wantToGo, notVisited] 자체도 검증 권장(Swift Set 비교는 순서 무시지만 CaseIterable 순서 보존 확인용).

### parseVisitState 미지 문자열 → undefined (신규, Swift 실패 가능 init 대응)
parseVisitState("unknown") === undefined, parseVisitState("") === undefined, parseVisitState("Visited")(대문자) === undefined — 대소문자 구분 확인.

### makePolygon 기본 holes (신규 스모크, Swift init 기본 인자 대응)
makePolygon([{lat:0,lon:0},{lat:0,lon:1},{lat:1,lon:0}]) → holes가 정확히 [] (undefined 아님, 길이 0). 두 번째 인자 전달 시 그대로 보존.

## 포팅 함정 (notes)

[1] BBox 출처: Swift에서는 TripSegmenter.swift:41에 정의되어 TripMetrics/ScanPipeline/DisplayGeoStore 등이 공유한다. TS 포트에서는 geoTypes.ts로 이전 배치하고 tripSegmenter 등 모든 모듈이 여기서 import — tripSegmenter 포팅 시 BBox 재정의 금지. [2] Coordinate의 Swift Equatable/Hashable: 코어 내 Set<Coordinate>/Dictionary 키 사용처 없음(grep 확인) — plain interface로 충분하며 동등성 비교가 필요하면 (a.lat===b.lat && a.lon===b.lon) 구조 비교를 호출부에서 수행. JS의 ===는 참조 비교임을 다운스트림에 주지. [3] Polygon.holes는 `holes?:` 옵셔널로 만들지 말 것 — Swift는 비옵셔널 빈 배열이며, pointInPolygon에서 undefined 분기가 생기면 byte-faithful이 깨진다. 기본값은 makePolygon 헬퍼로만 제공. [4] VisitState는 TS enum이 아닌 문자열 리터럴 유니언 — Codable String RawValue와 JSON 직렬화가 1:1이고 regionAggregate의 rank() 우선순위 로직이 이 정확한 문자열에 의존. [5] MultiPolygon은 {polygons: Polygon[]} 래퍼 객체 유지(Polygon[]로 평탄화 금지) — geojsonDecode/regionMatcher 시그니처가 래퍼 타입을 받음. PLAN 주석대로 평면 [[Coordinate]] 표현은 다도서 오판 원인이므로 SSOT 입력은 항상 Polygon/MultiPolygon. [6] Date/시간/부동소수점 산술 없음 — 순수 타입 모듈이라 시간 함정 해당 없음. [7] GeoTypes.swift의 \"(x=lon, y=lat) 평면, MapProjection 비의존\" 독스트링은 pointInPolygon 포팅 에이전트가 축을 바꾸지 않도록 TS 주석으로 반드시 이식. [8] 프롬프트의 dataActorReconcile 범위 지침(reconcile/upsert/prune/visited-wins/단일행 home만, merge/split/title/delete 제외)은 본 모듈과 무관 — 본 모듈은 의존성 없는 리프(leaf) 타입 모듈.