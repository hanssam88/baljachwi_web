import { describe, it, expect } from 'vitest';
import { makePolygon, type Coordinate, type MultiPolygon } from '@/core/geoTypes';
import {
  pointInPolygon,
  pointInMultiPolygon,
  defaultPointInPolygonConfig,
  type PointInPolygonConfig,
  type BoundaryRule,
} from '@/core/pointInPolygon';

// 평면 규칙: (x = lon, y = lat). 투영 없음.
// 경계 규칙: "좌하단 포함"(left-bottom inclusive).
//   - 최소 위도(아래쪽) 변·최소 경도(왼쪽) 변 위 점 = 내부(true)
//   - 최대 위도(위쪽) 변·최대 경도(오른쪽) 변 위 점 = 외부(false)

const c = (lat: number, lon: number): Coordinate => ({ lat, lon });

// 단위 정사각형. outer = (lat,lon) 순서로 (0,0),(0,1),(1,1),(1,0).
const unitSquare = makePolygon([c(0, 0), c(0, 1), c(1, 1), c(1, 0)]);

// 외곽 [0,4]² 정사각형, 가운데 [1,3]² 홀.
const squareWithHole = makePolygon(
  [c(0, 0), c(0, 4), c(4, 4), c(4, 0)],
  [[c(1, 1), c(1, 3), c(3, 3), c(3, 1)]],
);

// 두 개의 떨어진 섬: [0,1]²와 [5,6]².
const twoIslands: MultiPolygon = {
  polygons: [
    makePolygon([c(0, 0), c(0, 1), c(1, 1), c(1, 0)]),
    makePolygon([c(5, 5), c(5, 6), c(6, 6), c(6, 5)]),
  ],
};

// 오목 L자: (lat,lon) (0,0),(0,3),(3,3),(3,2),(1,2),(1,0)
const concaveL = makePolygon([
  c(0, 0),
  c(0, 3),
  c(3, 3),
  c(3, 2),
  c(1, 2),
  c(1, 0),
]);

// 다이아몬드(마름모): (lat,lon) (0,1),(1,2),(2,1),(1,0). 중심 (1,1).
const diamond = makePolygon([c(0, 1), c(1, 2), c(2, 1), c(1, 0)]);

describe('pointInPolygon — 단위 정사각형', () => {
  it('testInteriorPointIsInside', () => {
    expect(pointInPolygon(c(0.5, 0.5), unitSquare)).toBe(true);
  });

  it('testExteriorPointIsOutside', () => {
    expect(pointInPolygon(c(2, 2), unitSquare)).toBe(false);
  });

  it('testBottomEdgePointIsInside_leftBottomRule', () => {
    // 아래쪽(최소 위도) 변 위 점 = 내부
    expect(pointInPolygon(c(0, 0.5), unitSquare)).toBe(true);
  });
});

describe('pointInPolygon — 경계 규칙 전수 (좌하단 포함)', () => {
  it('testLeftEdgePointIsInside', () => {
    // 왼쪽(최소 경도) 변 위 점 = 내부
    expect(pointInPolygon(c(0.5, 0), unitSquare)).toBe(true);
  });

  it('testTopEdgePointIsOutside', () => {
    // 위쪽(최대 위도) 변 위 점 = 외부
    expect(pointInPolygon(c(1, 0.5), unitSquare)).toBe(false);
  });

  it('testRightEdgePointIsOutside', () => {
    // 오른쪽(최대 경도) 변 위 점 = 외부
    expect(pointInPolygon(c(0.5, 1), unitSquare)).toBe(false);
  });

  it('testBottomLeftCornerIsInside', () => {
    expect(pointInPolygon(c(0, 0), unitSquare)).toBe(true);
  });

  it('testTopRightCornerIsOutside', () => {
    expect(pointInPolygon(c(1, 1), unitSquare)).toBe(false);
  });

  it('testTopLeftCornerIsOutside', () => {
    // 최대 위도(위) → 외부
    expect(pointInPolygon(c(1, 0), unitSquare)).toBe(false);
  });

  it('testBottomRightCornerIsOutside', () => {
    // 최대 경도(오른쪽) → 외부
    expect(pointInPolygon(c(0, 1), unitSquare)).toBe(false);
  });
});

describe('pointInPolygon — 홀(holes)', () => {
  it('testPointInHoleIsOutside', () => {
    // 외곽 안이지만 홀 안 → 외부
    expect(pointInPolygon(c(2, 2), squareWithHole)).toBe(false);
  });

  it('testPointInOuterButOutsideHoleIsInside', () => {
    // 외곽 안, 홀 밖 (도넛 살) → 내부
    expect(pointInPolygon(c(0.5, 0.5), squareWithHole)).toBe(true);
  });

  it('testPointOnHoleMinEdgeIsOutside', () => {
    // 홀의 최소 위도 변(아래) 위 점 = "홀 내부"로 간주 → 폴리곤에서 제외(외부)
    expect(pointInPolygon(c(1, 2), squareWithHole)).toBe(false);
  });

  it('testPointOnHoleMaxEdgeIsInside', () => {
    // 홀의 최대 위도 변(위) 위 점 = "홀 외부" → 도넛 살(내부)
    expect(pointInPolygon(c(3, 2), squareWithHole)).toBe(true);
  });
});

describe('pointInMultiPolygon — 다도서', () => {
  it('testPointInFirstIslandIsInside', () => {
    expect(pointInMultiPolygon(c(0.5, 0.5), twoIslands)).toBe(true);
  });

  it('testPointInSecondIslandIsInside', () => {
    expect(pointInMultiPolygon(c(5.5, 5.5), twoIslands)).toBe(true);
  });

  it('testPointBetweenIslandsIsOutside', () => {
    expect(pointInMultiPolygon(c(3, 3), twoIslands)).toBe(false);
  });

  it('testEmptyMultiPolygonIsOutside', () => {
    expect(pointInMultiPolygon(c(0.5, 0.5), { polygons: [] })).toBe(false);
  });

  it('testMultiPolygonAppliesPerIslandHoleRule', () => {
    // 섬1 = squareWithHole([0,4]² 외곽, [1,3]² 홀). 섬2 = [10,11]².
    const archipelago: MultiPolygon = {
      polygons: [
        squareWithHole,
        makePolygon([c(10, 10), c(10, 11), c(11, 11), c(11, 10)]),
      ],
    };
    // 섬1의 홀 안 → 외부
    expect(pointInMultiPolygon(c(2, 2), archipelago)).toBe(false);
    // 섬1의 도넛 살 → 내부
    expect(pointInMultiPolygon(c(0.5, 0.5), archipelago)).toBe(true);
    // 섬2 내부 → 내부
    expect(pointInMultiPolygon(c(10.5, 10.5), archipelago)).toBe(true);
  });
});

describe('pointInPolygon — 오목(concave) 폴리곤', () => {
  it('testConcaveInteriorPointIsInside', () => {
    // L자 세로 다리 안 (lon 0.5, lat 0.5)
    expect(pointInPolygon(c(0.5, 0.5), concaveL)).toBe(true);
  });

  it('testConcaveNotchPointIsOutside', () => {
    // 파인 부분(notch): (x=lon 0.5, y=lat 2) → L자 밖
    expect(pointInPolygon(c(2, 0.5), concaveL)).toBe(false);
  });

  it('testConcaveUpperArmPointIsInside', () => {
    // 위쪽 가로 팔 안: lat 2.5, lon 2.5
    expect(pointInPolygon(c(2.5, 2.5), concaveL)).toBe(true);
  });
});

describe('pointInPolygon — 꼭짓점/수평변 중복카운트 방지', () => {
  it('testRayThroughVertexDoesNotDoubleCount_interior', () => {
    // y = 1 광선이 좌우 꼭짓점 통과. 중심은 내부여야 함.
    expect(pointInPolygon(c(1, 1), diamond)).toBe(true);
  });

  it('testRayThroughVertexDoesNotDoubleCount_exterior', () => {
    // 같은 높이(y=1) 외부 점(왼쪽). 꼭짓점 통과 후에도 외부여야 함.
    expect(pointInPolygon(c(1, -1), diamond)).toBe(false);
  });

  it('testHorizontalEdgeRayDoesNotDoubleCount', () => {
    // [0,2]² 정사각형
    const sq = makePolygon([c(0, 0), c(0, 2), c(2, 2), c(2, 0)]);
    // 아래 수평변(y=0) 높이의 외부 점 (lon -1) → 외부
    expect(pointInPolygon(c(0, -1), sq)).toBe(false);
    // 위 수평변(y=2) 높이의 외부 점 → 외부
    expect(pointInPolygon(c(2, -1), sq)).toBe(false);
  });
});

describe('pointInPolygon — 첫==끝 중복점', () => {
  it('testClosedRingSameAsOpenRing', () => {
    // outer 첫 점을 끝에 한 번 더 붙인 닫힌 링.
    const closed = makePolygon([
      c(0, 0),
      c(0, 1),
      c(1, 1),
      c(1, 0),
      c(0, 0), // 중복 닫힘 점
    ]);
    expect(pointInPolygon(c(0.5, 0.5), closed)).toBe(true);
    expect(pointInPolygon(c(2, 2), closed)).toBe(false);
    // 열린 링과 동일 결과
    expect(pointInPolygon(c(0.5, 0.5), closed)).toBe(
      pointInPolygon(c(0.5, 0.5), unitSquare),
    );
  });
});

describe('pointInPolygon — 빈 / degenerate', () => {
  it('testEmptyOuterIsOutside', () => {
    expect(pointInPolygon(c(0.5, 0.5), makePolygon([]))).toBe(false);
  });

  it('testSinglePointOuterIsOutside', () => {
    const p = makePolygon([c(0, 0)]);
    expect(pointInPolygon(c(0, 0), p)).toBe(false);
  });

  it('testTwoPointOuterIsOutside', () => {
    // 선분(면적 0) → 항상 외부
    const p = makePolygon([c(0, 0), c(0, 1)]);
    expect(pointInPolygon(c(0, 0.5), p)).toBe(false);
  });

  it('testDegenerateHoleIsIgnored', () => {
    // 점 2개짜리 degenerate 홀은 무시 → 외곽 내부 판정 그대로.
    const p = makePolygon(
      [c(0, 0), c(0, 2), c(2, 2), c(2, 0)],
      [[c(1, 1), c(1, 1.5)]],
    );
    expect(pointInPolygon(c(1, 1.2), p)).toBe(true);
  });
});

describe('pointInPolygon — 방향(시계/반시계) 무관', () => {
  it('testWindingOrderIndependence', () => {
    // unitSquare는 반시계(CCW). 동일 정점을 시계(CW)로 뒤집어도 결과 동일.
    const cw = makePolygon([c(0, 0), c(1, 0), c(1, 1), c(0, 1)]);
    const interior = c(0.5, 0.5);
    const exterior = c(2, 2);
    expect(pointInPolygon(interior, cw)).toBe(pointInPolygon(interior, unitSquare));
    expect(pointInPolygon(exterior, cw)).toBe(pointInPolygon(exterior, unitSquare));
    expect(pointInPolygon(interior, cw)).toBe(true);
    expect(pointInPolygon(exterior, cw)).toBe(false);
  });
});

describe('pointInPolygon — 사선 변/꼭짓점 경계 결정성 (SSOT 핀고정)', () => {
  it('testDiamondSlantedEdgeBoundaryRuleIsDeterministic', () => {
    // 좌하변 중점(아래/왼쪽 성격) = 내부
    expect(pointInPolygon(c(0.5, 0.5), diamond)).toBe(true);
    // 좌상변 중점 = 내부
    expect(pointInPolygon(c(1.5, 0.5), diamond)).toBe(true);
    // 우상변 중점(위/오른쪽 성격) = 외부
    expect(pointInPolygon(c(1.5, 1.5), diamond)).toBe(false);
    // 우하변 중점 = 외부
    expect(pointInPolygon(c(0.5, 1.5), diamond)).toBe(false);
  });

  it('testDiamondApexVerticesAreDeterministic', () => {
    expect(pointInPolygon(c(0, 1), diamond)).toBe(false); // 최저 apex
    expect(pointInPolygon(c(2, 1), diamond)).toBe(false); // 최고 apex
    expect(pointInPolygon(c(1, 2), diamond)).toBe(false); // 우측 apex
    expect(pointInPolygon(c(1, 0), diamond)).toBe(true); // 좌측 apex
  });
});

describe('pointInPolygon — 설정 API 형태 스모크', () => {
  it('testConfigAPIShapeSmoke', () => {
    const interior = c(0.5, 0.5);
    const explicit: PointInPolygonConfig = { boundaryRule: 'leftBottomInclusive' };
    expect(pointInPolygon(interior, unitSquare)).toBe(
      pointInPolygon(interior, unitSquare, explicit),
    );
  });

  it('defaultPointInPolygonConfig 형태 보존', () => {
    expect(defaultPointInPolygonConfig).toEqual({ boundaryRule: 'leftBottomInclusive' });
    const rule: BoundaryRule = 'leftBottomInclusive';
    expect(defaultPointInPolygonConfig.boundaryRule).toBe(rule);
  });
});
