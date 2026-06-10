# 모듈 카드: pointInPolygon

**TS 타겟:** src/core/pointInPolygon.ts

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
```ts
// src/core/pointInPolygon.ts
import type { Coordinate, Polygon, MultiPolygon } from './geoTypes';

/** 경계 판정 규칙. 현재 단일 케이스(좌하단 포함). Swift enum BoundaryRule 대응. */
export type BoundaryRule = 'leftBottomInclusive';

/** Swift PointInPolygonConfig 대응. boundaryRule은 현재 알고리즘에서 분기하지 않음(API 형태 보존용). */
export interface PointInPolygonConfig {
  boundaryRule: BoundaryRule;
}

/** Swift PointInPolygonConfig.default 대응. */
export const defaultPointInPolygonConfig: PointInPolygonConfig = {
  boundaryRule: 'leftBottomInclusive',
};

/**
 * 점이 단일 Polygon 내부인지 판정 (crossing-number ray-cast, +x 방향 광선).
 * 외곽 링 안 && 어떤 홀에도 없음 → true. 경계 규칙: 좌하단(최소 lat/최소 lon 변) 포함.
 * Swift: pointInPolygon(_:in: Polygon, config:)
 */
export function pointInPolygon(
  point: Coordinate,
  polygon: Polygon,
  config?: PointInPolygonConfig,
): boolean;

/**
 * 점이 MultiPolygon 내부인지 판정. 구성 폴리곤 중 하나라도(각자 홀 규칙) 내부면 true.
 * Swift: pointInPolygon(_:in: MultiPolygon, config:) — TS는 타입 오버로드 불가하므로 별도 이름.
 */
export function pointInMultiPolygon(
  point: Coordinate,
  multiPolygon: MultiPolygon,
  config?: PointInPolygonConfig,
): boolean;
```
```

## 보존 상수 (constants)

- minRingVertices=3 (링 점 3개 미만이면 무조건 false — guard n >= 3)
- defaultBoundaryRule='leftBottomInclusive'
- epsilon=없음 (의도적 — 절대 추가 금지, half-open 비교 구조가 0 나눗셈을 배제)

## 포팅할 테스트 (testsToPort)

### testInteriorPointIsInside
unitSquare outer(lat,lon)=(0,0),(0,1),(1,1),(1,0). 점(lat:0.5,lon:0.5) → true

### testExteriorPointIsOutside
unitSquare. 점(2,2) → false

### testBottomEdgePointIsInside_leftBottomRule
unitSquare. 아래변(최소 lat) 위 점(lat:0,lon:0.5) → true

### testLeftEdgePointIsInside
unitSquare. 왼쪽변(최소 lon) 위 점(lat:0.5,lon:0) → true

### testTopEdgePointIsOutside
unitSquare. 위변(최대 lat) 위 점(lat:1,lon:0.5) → false

### testRightEdgePointIsOutside
unitSquare. 오른쪽변(최대 lon) 위 점(lat:0.5,lon:1) → false

### testBottomLeftCornerIsInside
unitSquare. 꼭짓점(0,0) → true

### testTopRightCornerIsOutside
unitSquare. 꼭짓점(1,1) → false

### testTopLeftCornerIsOutside
unitSquare. 꼭짓점(lat:1,lon:0) → false (최대 lat)

### testBottomRightCornerIsOutside
unitSquare. 꼭짓점(lat:0,lon:1) → false (최대 lon)

### testPointInHoleIsOutside
squareWithHole: outer [0,4]² = (0,0),(0,4),(4,4),(4,0); hole [1,3]² = (1,1),(1,3),(3,3),(3,1). 점(2,2) → false

### testPointInOuterButOutsideHoleIsInside
squareWithHole. 도넛 살 점(0.5,0.5) → true

### testPointOnHoleMinEdgeIsOutside
squareWithHole. 홀의 최소 lat 변 위 점(lat:1,lon:2) → false (홀 좌하단 변은 '홀 내부'로 간주되어 제외)

### testPointOnHoleMaxEdgeIsInside
squareWithHole. 홀의 최대 lat 변 위 점(lat:3,lon:2) → true

### testPointInFirstIslandIsInside
twoIslands = MultiPolygon([0,1]² 사각형, [5,6]² 사각형). 점(0.5,0.5) → true. pointInMultiPolygon 사용

### testPointInSecondIslandIsInside
twoIslands. 점(5.5,5.5) → true

### testPointBetweenIslandsIsOutside
twoIslands. 점(3,3) → false

### testEmptyMultiPolygonIsOutside
MultiPolygon(polygons: []). 점(0.5,0.5) → false

### testMultiPolygonAppliesPerIslandHoleRule
archipelago = [squareWithHole, [10,11]² 사각형]. (2,2)→false(섬1 홀 안), (0.5,0.5)→true(섬1 도넛 살), (10.5,10.5)→true(섬2 내부)

### testConcaveInteriorPointIsInside
concaveL outer(lat,lon)=(0,0),(0,3),(3,3),(3,2),(1,2),(1,0). 점(0.5,0.5) → true

### testConcaveNotchPointIsOutside
concaveL. 파인 부분 점(lat:2,lon:0.5) → false

### testConcaveUpperArmPointIsInside
concaveL. 위쪽 팔 점(2.5,2.5) → true

### testRayThroughVertexDoesNotDoubleCount_interior
diamond outer(lat,lon)=(0,1),(1,2),(2,1),(1,0). y=1 광선이 좌우 꼭짓점 통과. 중심(1,1) → true (중복카운트 시 false로 오판)

### testRayThroughVertexDoesNotDoubleCount_exterior
diamond. 같은 높이 외부 점(lat:1,lon:-1) → false

### testHorizontalEdgeRayDoesNotDoubleCount
[0,2]² 사각형 (0,0),(0,2),(2,2),(2,0). 아래 수평변 높이 외부 점(lat:0,lon:-1)→false, 위 수평변 높이 외부 점(lat:2,lon:-1)→false

### testClosedRingSameAsOpenRing
unitSquare에 첫 점(0,0)을 끝에 중복으로 붙인 5점 닫힌 링. (0.5,0.5)→true, (2,2)→false, 그리고 (0.5,0.5) 결과가 열린 unitSquare 결과와 동일(equal)

### testEmptyOuterIsOutside
Polygon(outer: []). 점(0.5,0.5) → false

### testSinglePointOuterIsOutside
outer=[(0,0)] 1점. 점(0,0) → false

### testTwoPointOuterIsOutside
outer=[(0,0),(0,1)] 선분. 점(lat:0,lon:0.5) → false

### testDegenerateHoleIsIgnored
[0,2]² outer + 2점짜리 degenerate 홀 [(1,1),(1,1.5)]. 점(lat:1,lon:1.2) → true (홀 무시)

### testWindingOrderIndependence
CW 사각형 (0,0),(1,0),(1,1),(0,1). interior(0.5,0.5): CW 결과 == unitSquare(CCW) 결과 == true. exterior(2,2): 둘 다 false

### testDiamondSlantedEdgeBoundaryRuleIsDeterministic
diamond 사선 변 중점: 좌하변(0.5,0.5)→true, 좌상변(1.5,0.5)→true, 우상변(1.5,1.5)→false, 우하변(0.5,1.5)→false. SSOT 핀고정 — 비교부호 변경 시 회귀 감지

### testDiamondApexVerticesAreDeterministic
diamond 꼭짓점: 최저(0,1)→false, 최고(2,1)→false, 우측(1,2)→false, 좌측(1,0)→true (좌측 apex만 내부)

### testConfigAPIShapeSmoke
unitSquare interior(0.5,0.5): config 생략 결과 == {boundaryRule:'leftBottomInclusive'} 명시 결과 (동작 비분기, API 형태만 검증)

## 포팅 함정 (notes)

(1) 함수 오버로드: Swift는 Polygon/MultiPolygon 타입 오버로드 2개를 같은 이름 pointInPolygon으로 제공. TS는 런타임 타입 디스패치가 불안정하므로 pointInPolygon(Polygon용) + pointInMultiPolygon(MultiPolygon용) 두 이름으로 분리 권장 — 테스트의 `in: multiPolygon` 호출은 pointInMultiPolygon으로 매핑. (2) 핵심 산술을 byte-faithful로 보존: xIntersect = (vj.x - vi.x) * (p.y - vi.y) / (vj.y - vi.y) + vi.x — 연산 순서(곱→나눗셈→덧셈)와 결합을 그대로 유지해야 float64 비트 동일. (3) 비교 부호 절대 변경 금지: half-open `(vi.y > p.y) !== (vj.y > p.y)` (strict >, XOR는 !== 로), strict `p.x < xIntersect`. 이 조합이 좌하단 포함 경계 규칙·수평변 자동 제외·꼭짓점 1회 카운트·0 나눗셈 배제를 모두 구조적으로 만든다. epsilon이나 >= 추가는 회귀. (4) 루프 idiom: `var j = n-1; for i in 0..<n { ...; j = i }` — wraparound 변 (ring[j]→ring[i]) 순서 보존. `inside.toggle()` → `inside = !inside`. (5) planar 매핑 x=lon, y=lat 은 단일 지점(한 함수)에서만 변환 — lat/lon 스왑 버그 방지 설계 의도 보존. (6) Swift Polygon.holes는 비옵셔널 [[Coordinate]] (기본 [] 추정). geoTypes의 TS Polygon.holes가 optional이면 `polygon.holes ?? []`로 처리하되, geoTypes 계약이 필수 배열이면 그대로 순회. MultiPolygon `.contains { }` → `.some()` (단락 평가 동일). (7) config 파라미터는 런타임 분기 없음(단일 enum 케이스) — optional 파라미터로 API 형태만 유지, 본문에서 미사용이어도 제거하지 말 것(향후 규칙 확장 대비 + 테스트 스모크 대상). (8) Date/시간/정수 나눗셈/정렬/IO 없음 — 순수 함수라 경계 분리 불필요. ringContains는 private 유지(내부 함수, export 안 함).