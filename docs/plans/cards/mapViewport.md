# 모듈 카드: mapViewport

**TS 타겟:** src/core/mapViewport.ts

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
```ts
// src/core/mapViewport.ts
// 화면 평면 줌/팬 뷰포트 변환 (순수·결정적). geo 좌표가 아닌 "화면 점" 공간.
// 변환식(SSOT): final = zoom·(base − center) + center + pan

/** CGPoint 대응 — 화면 점 */
export interface Point2D {
  x: number;
  y: number;
}

/** CGSize 대응 — 화면 평행이동(pan). Swift 필드명 width/height 유지 */
export interface Size2D {
  width: number;
  height: number;
}

/** CGAffineTransform 대응: 점 적용식 x' = a·x + c·y + tx, y' = b·x + d·y + ty */
export interface AffineTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

/** MapViewport struct 대응 (Equatable·Sendable → plain immutable interface) */
export interface MapViewport {
  /** 배율(≥1 권장, 1=원본). 균일(가로·세로 동일) */
  zoom: number;
  /** 화면 평행이동(점) */
  pan: Size2D;
  /** 줌 고정점(보통 뷰 중앙). pan=0이면 zoom과 무관하게 제자리 */
  center: Point2D;
}

export function makeMapViewport(zoom: number, pan: Size2D, center: Point2D): MapViewport {
  return { zoom, pan, center };
}

/**
 * base(zoom1) 화면점 → 최종 화면점으로 보내는 affine.
 * 닫힌형: a = d = zoom, b = c = 0,
 *         tx = center.x + pan.width  − zoom·center.x,
 *         ty = center.y + pan.height − zoom·center.y
 * (Swift의 translatedBy(cx+pw, cy+ph) → scaledBy(z,z) → translatedBy(−cx,−cy) 합성과 동일)
 */
export function viewportAffine(vp: MapViewport): AffineTransform;

/** base 화면점 → 최종 화면점 (렌더가 그리는 위치). point.applying(affine) 대응 */
export function applyViewport(vp: MapViewport, point: Point2D): Point2D;

/** 최종 화면점(탭 위치) → base 화면점. point.applying(affine.inverted()) 대응 */
export function invertViewport(vp: MapViewport, point: Point2D): Point2D;

/** Equatable 대응: zoom/pan/center 전 필드 === 비교 (NaN≠NaN, −0===0 — Swift Double ==와 동일 의미) */
export function viewportEquals(a: MapViewport, b: MapViewport): boolean;
```
```

## 보존 상수 (constants)

- (모듈 상수 없음 — 임계값/매직넘버 부재)
- 테스트 전용: assertPoint 기본 허용오차 accuracy=1e-9
- 테스트 전용: round-trip 허용오차 accuracy=1e-6

## 포팅할 테스트 (testsToPort)

### identityWhenNoZoomNoPan
vp = {zoom:1, pan:(0,0), center:(50,50)}. 점 (0,0), (30,70), (50,50) 각각에 대해 apply(p)==p 그리고 invert(p)==p (허용오차 1e-9)

### centerIsFixedPointUnderZoom
zoom ∈ [1, 2, 5, 12], pan=(0,0), center=(50,50). 모든 zoom에서 apply((50,50)) == (50,50) (1e-9)

### concreteZoomValues
vp = {zoom:2, pan:(0,0), center:(50,50)}. apply((0,0)) == (−50,−50), apply((100,100)) == (150,150) (1e-9)

### panIsPlainTranslation
vp = {zoom:1, pan:(width:10, height:−20), center:(50,50)}. apply((30,40)) == (40,20) (1e-9)

### invertIsInverseOfApply
4개 케이스 (zoom, pan, center): (2,(30,−10),(50,50)), (5,(−100,80),(160,320)), (12,(0,0),(0,0)), (1.7,(12.5,7.25),(200,100)). 각 케이스 × 점 (0,0), (137,42), (−20,999)에 대해 invert(apply(p)) ≈ p (허용오차 1e-6)

### applyIsInverseOfInvert
vp = {zoom:3, pan:(25,−40), center:(50,50)}, p=(88,17). apply(invert(p)) ≈ p (허용오차 1e-6)

## 포팅 함정 (notes)

함정: (1) CGAffineTransform 합성 의미 — Swift의 translatedBy/scaledBy는 새 변환을 prepend하므로 점에는 「−center → ×zoom → +center+pan」 순서로 적용된다. CG 행렬 합성을 그대로 흉내내지 말고 닫힌형(a=d=zoom, b=c=0, tx=cx+pw−z·cx, ty=cy+ph−z·cy)으로 affine을 만들되, apply/invert는 그 affine 행렬을 통해 계산하라(렌더·히트테스트가 같은 행렬을 공유하는 SSOT 설계를 보존). (2) invert는 affine.inverted() 경유 — 닫힌형 역변환은 x=(x'−tx)/zoom. zoom=0이면 특이행렬인데 Swift CGAffineTransform.inverted()는 비가역 시 원본 행렬을 그대로 반환한다(byte-faithful이 필요하면 zoom===0일 때 점을 그대로 반환; 테스트는 이 엣지를 다루지 않으므로 zoom≠0 전제조건 주석으로 충분하나 선택을 notes에 남길 것). (3) CGFloat은 64bit Double = JS number이므로 정밀도 차이 없음. Date/정수 산술/정렬/옵셔널 전부 없음 — 가장 안전한 모듈. (4) pan의 CGSize 필드명 width/height를 유지할 것({x,y}로 바꾸지 말 것 — 호출부 포팅 시 혼동 방지). (5) 테스트 헬퍼 assertPoint는 XCTAssertEqual(accuracy:) 의미론, 즉 |a−b| <= accuracy 절대오차 비교 — Vitest/Jest의 toBeCloseTo(소수점 자릿수 기반)를 쓰지 말고 Math.abs(a−b) <= accuracy 커스텀 헬퍼로 포팅. (6) Equatable 합성 ==는 필드별 Double == — JS ===와 의미 일치(NaN≠NaN, −0===0). (7) 이 모듈은 geo 좌표를 다루지 않아 geoTypes 의존 없음. Point2D/Size2D/AffineTransform이 mapProjection의 화면 점 타입과 겹친다면 한쪽(예: mapViewport)에서 정의하고 다른 쪽이 import하도록 중복 제거 권장. (참고: dataActorReconcile 제외 지침은 본 모듈과 무관)