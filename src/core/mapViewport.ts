// src/core/mapViewport.ts
// 화면 평면 줌/팬 뷰포트 변환 (순수·결정적). geo 좌표가 아닌 "화면 점" 공간.
// 변환식(SSOT): final = zoom·(base − center) + center + pan
//
// Swift BaljachwiCore/MapViewport.swift 의 byte-faithful 포트.
// 렌더(GraphicsContext.concatenate)와 탭 히트테스트(invert)가 하나의 affine을 공유한다.
// 같은 행렬에서 파생하므로 부호/순서 불일치가 원천적으로 불가능하다(SSOT).

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
 * (Swift의 translatedBy(cx+pw, cy+ph) → scaledBy(z,z) → translatedBy(−cx,−cy) 합성과 동일.
 *  translatedBy/scaledBy는 새 변환을 prepend하므로 점에는 「−center → ×zoom → +center+pan」 순으로 적용된다.)
 */
export function viewportAffine(vp: MapViewport): AffineTransform {
  const { zoom, pan, center } = vp;
  return {
    a: zoom,
    b: 0,
    c: 0,
    d: zoom,
    tx: center.x + pan.width - zoom * center.x,
    ty: center.y + pan.height - zoom * center.y,
  };
}

/** base 화면점 → 최종 화면점 (렌더가 그리는 위치). point.applying(affine) 대응. */
export function applyViewport(vp: MapViewport, point: Point2D): Point2D {
  const t = viewportAffine(vp);
  return {
    x: t.a * point.x + t.c * point.y + t.tx,
    y: t.b * point.x + t.d * point.y + t.ty,
  };
}

/**
 * 최종 화면점(탭 위치) → base 화면점. point.applying(affine.inverted()) 대응.
 * 닫힌형 역변환: x = (x' − tx) / zoom, y = (y' − ty) / zoom (b=c=0이므로 대각).
 * 엣지: zoom===0 이면 특이행렬(비가역). Swift CGAffineTransform.inverted()는 비가역 시 원본
 * 행렬을 그대로 반환하므로 byte-faithful을 위해 zoom===0 일 때는 affine을 그대로 적용한다
 * (=apply와 동일). 테스트는 이 엣지를 다루지 않으며 zoom≠0 전제. (notes §2)
 */
export function invertViewport(vp: MapViewport, point: Point2D): Point2D {
  const t = viewportAffine(vp);
  if (t.a === 0 || t.d === 0) {
    // 특이행렬: Swift inverted()는 원본 행렬 그대로 반환 → 원본 affine 적용.
    return {
      x: t.a * point.x + t.c * point.y + t.tx,
      y: t.b * point.x + t.d * point.y + t.ty,
    };
  }
  // 대각 행렬(b=c=0)의 역: inv.a=1/a, inv.d=1/d, inv.tx=−tx/a, inv.ty=−ty/d.
  return {
    x: (point.x - t.tx) / t.a,
    y: (point.y - t.ty) / t.d,
  };
}

/** Equatable 대응: zoom/pan/center 전 필드 === 비교 (NaN≠NaN, −0===0 — Swift Double ==와 동일 의미). */
export function viewportEquals(a: MapViewport, b: MapViewport): boolean {
  return (
    a.zoom === b.zoom &&
    a.pan.width === b.pan.width &&
    a.pan.height === b.pan.height &&
    a.center.x === b.center.x &&
    a.center.y === b.center.y
  );
}
