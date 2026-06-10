import { describe, it, expect } from 'vitest';
import { makePolygon, type Coordinate, type Polygon, type MultiPolygon, type BBox } from '@/core/geoTypes';
import { VISIT_STATE_ALL_CASES, parseVisitState, type VisitState } from '@/core/visitState';

describe('visitState', () => {
  it('rawValue/parse/allCases (ModelTests.testVisitStateRawValueAndCases)', () => {
    // (1) 리터럴 rawValue 동등성
    const v: VisitState = 'visited';
    expect(v).toBe('visited');
    // (2) parse
    expect(parseVisitState('wantToGo')).toBe('wantToGo');
    // (3) allCases 집합 동등 + 크기 3
    expect(new Set(VISIT_STATE_ALL_CASES)).toEqual(new Set(['visited', 'wantToGo', 'notVisited']));
    expect(VISIT_STATE_ALL_CASES).toHaveLength(3);
    // CaseIterable 선언 순서 보존
    expect(VISIT_STATE_ALL_CASES).toEqual(['visited', 'wantToGo', 'notVisited']);
  });

  it('parseVisitState 미지 문자열 → undefined (대소문자 구분)', () => {
    expect(parseVisitState('unknown')).toBeUndefined();
    expect(parseVisitState('')).toBeUndefined();
    expect(parseVisitState('Visited')).toBeUndefined();
  });
});

describe('geoTypes', () => {
  it('makePolygon 기본 holes는 정확히 [] (undefined 아님)', () => {
    const p = makePolygon([
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      { lat: 1, lon: 0 },
    ]);
    expect(p.holes).toEqual([]);
    expect(p.holes).toHaveLength(0);
    expect(p.outer).toHaveLength(3);
  });

  it('makePolygon 두 번째 인자(holes) 전달 시 그대로 보존', () => {
    const hole: Coordinate[] = [
      { lat: 0.2, lon: 0.2 },
      { lat: 0.2, lon: 0.4 },
      { lat: 0.4, lon: 0.2 },
    ];
    const p: Polygon = makePolygon([{ lat: 0, lon: 0 }], [hole]);
    expect(p.holes).toHaveLength(1);
    expect(p.holes[0]).toBe(hole);
  });

  it('타입 형태 스모크 (MultiPolygon 래퍼 / BBox)', () => {
    const mp: MultiPolygon = { polygons: [makePolygon([{ lat: 0, lon: 0 }])] };
    expect(mp.polygons).toHaveLength(1);
    const bbox: BBox = { minLat: 33, minLon: 124, maxLat: 38, maxLon: 132 };
    expect(bbox.maxLat - bbox.minLat).toBe(5);
  });
});
