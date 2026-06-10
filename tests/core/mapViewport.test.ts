import { describe, it, expect } from 'vitest';
import {
  makeMapViewport,
  viewportAffine,
  applyViewport,
  invertViewport,
  viewportEquals,
  type Point2D,
  type Size2D,
  type MapViewport,
} from '@/core/mapViewport';

// Swift MapViewportTests 의 assertPoint(accuracy:) 포트.
// XCTAssertEqual(accuracy:) 의미론 = |a−b| <= accuracy 절대오차 비교.
// Vitest toBeCloseTo(자릿수 기반)를 쓰지 말 것 (notes §5).
function assertPoint(a: Point2D, b: Point2D, accuracy = 1e-9): void {
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(accuracy);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(accuracy);
}

const center: Point2D = { x: 50, y: 50 };
const ZERO: Size2D = { width: 0, height: 0 };

describe('mapViewport', () => {
  // zoom=1, pan=0 → 항등(apply/invert 모두 입력 그대로).
  it('identityWhenNoZoomNoPan', () => {
    const vp = makeMapViewport(1, ZERO, center);
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 30, y: 70 },
      center,
    ];
    for (const p of points) {
      assertPoint(applyViewport(vp, p), p);
      assertPoint(invertViewport(vp, p), p);
    }
  });

  // center는 pan=0일 때 zoom과 무관하게 고정점.
  it('centerIsFixedPointUnderZoom', () => {
    for (const z of [1, 2, 5, 12]) {
      const vp = makeMapViewport(z, ZERO, center);
      assertPoint(applyViewport(vp, center), center);
    }
  });

  // 구체값: zoom=2, center=(50,50), pan=0
  //   apply((0,0))=(−50,−50), apply((100,100))=(150,150).
  it('concreteZoomValues', () => {
    const vp = makeMapViewport(2, ZERO, center);
    assertPoint(applyViewport(vp, { x: 0, y: 0 }), { x: -50, y: -50 });
    assertPoint(applyViewport(vp, { x: 100, y: 100 }), { x: 150, y: 150 });
  });

  // pan은 순수 화면 평행이동(zoom=1).
  it('panIsPlainTranslation', () => {
    const vp = makeMapViewport(1, { width: 10, height: -20 }, center);
    assertPoint(applyViewport(vp, { x: 30, y: 40 }), { x: 40, y: 20 });
  });

  // round-trip: invert(apply(p)) ≈ p — 다양한 zoom/pan/center.
  it('invertIsInverseOfApply', () => {
    const cases: Array<[number, Size2D, Point2D]> = [
      [2, { width: 30, height: -10 }, { x: 50, y: 50 }],
      [5, { width: -100, height: 80 }, { x: 160, y: 320 }],
      [12, { width: 0, height: 0 }, { x: 0, y: 0 }],
      [1.7, { width: 12.5, height: 7.25 }, { x: 200, y: 100 }],
    ];
    const probes: Point2D[] = [
      { x: 0, y: 0 },
      { x: 137, y: 42 },
      { x: -20, y: 999 },
    ];
    for (const [z, pan, c] of cases) {
      const vp = makeMapViewport(z, pan, c);
      for (const p of probes) {
        assertPoint(invertViewport(vp, applyViewport(vp, p)), p, 1e-6);
      }
    }
  });

  // apply도 invert의 역 — affine 자체가 가역(scale≠0).
  it('applyIsInverseOfInvert', () => {
    const vp = makeMapViewport(3, { width: 25, height: -40 }, center);
    const p: Point2D = { x: 88, y: 17 };
    assertPoint(applyViewport(vp, invertViewport(vp, p)), p, 1e-6);
  });

  // 닫힌형 affine 계약 직접 검증:
  //   a=d=zoom, b=c=0, tx=cx+pw−z·cx, ty=cy+ph−z·cy
  it('viewportAffine closed form', () => {
    const vp = makeMapViewport(2, { width: 10, height: -20 }, center);
    const t = viewportAffine(vp);
    expect(t.a).toBe(2);
    expect(t.d).toBe(2);
    expect(t.b).toBe(0);
    expect(t.c).toBe(0);
    // tx = 50 + 10 − 2·50 = -40
    expect(t.tx).toBe(-40);
    // ty = 50 + (-20) − 2·50 = -70
    expect(t.ty).toBe(-70);
  });

  // makeMapViewport 필드 보존 + CGSize 필드명 width/height 유지.
  it('makeMapViewport preserves fields with width/height pan', () => {
    const vp = makeMapViewport(1.5, { width: 3, height: -4 }, { x: 7, y: 9 });
    expect(vp.zoom).toBe(1.5);
    expect(vp.pan.width).toBe(3);
    expect(vp.pan.height).toBe(-4);
    expect(vp.center.x).toBe(7);
    expect(vp.center.y).toBe(9);
  });

  // Equatable 합성 ==: 필드별 Double == (JS ===) — NaN≠NaN, −0===0.
  it('viewportEquals field-wise semantics', () => {
    const a: MapViewport = makeMapViewport(2, { width: 1, height: 2 }, { x: 3, y: 4 });
    const b: MapViewport = makeMapViewport(2, { width: 1, height: 2 }, { x: 3, y: 4 });
    expect(viewportEquals(a, b)).toBe(true);

    // 한 필드만 달라도 false
    expect(viewportEquals(a, makeMapViewport(3, { width: 1, height: 2 }, { x: 3, y: 4 }))).toBe(false);
    expect(viewportEquals(a, makeMapViewport(2, { width: 9, height: 2 }, { x: 3, y: 4 }))).toBe(false);
    expect(viewportEquals(a, makeMapViewport(2, { width: 1, height: 9 }, { x: 3, y: 4 }))).toBe(false);
    expect(viewportEquals(a, makeMapViewport(2, { width: 1, height: 2 }, { x: 9, y: 4 }))).toBe(false);
    expect(viewportEquals(a, makeMapViewport(2, { width: 1, height: 2 }, { x: 3, y: 9 }))).toBe(false);

    // NaN ≠ NaN
    const n = makeMapViewport(NaN, { width: 0, height: 0 }, { x: 0, y: 0 });
    expect(viewportEquals(n, makeMapViewport(NaN, { width: 0, height: 0 }, { x: 0, y: 0 }))).toBe(false);

    // -0 === 0
    const negZero = makeMapViewport(0, { width: -0, height: 0 }, { x: 0, y: 0 });
    const posZero = makeMapViewport(0, { width: 0, height: 0 }, { x: 0, y: 0 });
    expect(viewportEquals(negZero, posZero)).toBe(true);
  });
});
