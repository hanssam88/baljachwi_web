import { describe, it, expect } from 'vitest';
import {
  project,
  unproject,
  makeProjectionConfig,
  lonScaleFactor,
  DEFAULT_REF_LAT,
  type ProjectionConfig,
  type ScreenPoint,
} from '@/core/mapProjection';
import { type Coordinate } from '@/core/geoTypes';

// 한국 bbox용 테스트 config (Swift koreaConfig()).
// minLon=124.5(서해 서단), maxLat=38.7(휴전선 인근 북단), scale=1000 점/도.
function koreaConfig(): ProjectionConfig {
  return { minLon: 124.5, maxLat: 38.7, refLat: 36.0, scale: 1000.0 };
}

describe('mapProjection', () => {
  // 화면좌표 round-trip: project(unproject(p)) ≈ p, 오차 < 1px.
  it('roundTripScreenWithinOnePixel', () => {
    const cfg = koreaConfig();
    // 서울 시청 인근(경도 126.9779, 위도 37.5663).
    const seoul: Coordinate = { lat: 37.5663, lon: 126.9779 };
    const p = project(seoul, cfg);
    const back = unproject(p, cfg);
    expect(back).not.toBeNull();
    const reprojected = project(back as Coordinate, cfg);
    expect(Math.abs(reprojected.x - p.x)).toBeLessThan(1.0);
    expect(Math.abs(reprojected.y - p.y)).toBeLessThan(1.0);
  });

  // 지리좌표 round-trip: unproject(project(c)) ≈ c, 미세 epsilon 이내.
  it('roundTripGeoWithinEpsilon', () => {
    const cfg = koreaConfig();
    const c: Coordinate = { lat: 35.1796, lon: 129.0756 }; // 부산
    const p = project(c, cfg);
    const back = unproject(p, cfg);
    expect(back).not.toBeNull();
    expect(Math.abs((back as Coordinate).lat - c.lat)).toBeLessThan(1e-9);
    expect(Math.abs((back as Coordinate).lon - c.lon)).toBeLessThan(1e-9);
  });

  // 좌상단 모서리(minLon, maxLat) → 화면 원점 (0, 0).
  it('topLeftCornerMapsToOrigin', () => {
    const cfg = koreaConfig();
    const topLeft: Coordinate = { lat: cfg.maxLat, lon: cfg.minLon };
    const p = project(topLeft, cfg);
    expect(Math.abs(p.x - 0.0)).toBeLessThan(1e-9);
    expect(Math.abs(p.y - 0.0)).toBeLessThan(1e-9);
  });

  // 우하단(maxLon, minLat)의 x/y가 폭·높이 × scale × (x는 cos보정)과 일치.
  it('bottomRightCornerMapsToExpectedExtremes', () => {
    const cfg = koreaConfig();
    const maxLon = 132.0;
    const minLat = 33.0;
    const bottomRight: Coordinate = { lat: minLat, lon: maxLon };
    const p = project(bottomRight, cfg);
    const expectedX = (maxLon - cfg.minLon) * Math.cos((36.0 * Math.PI) / 180.0) * cfg.scale;
    const expectedY = (cfg.maxLat - minLat) * cfg.scale;
    expect(Math.abs(p.x - expectedX)).toBeLessThan(1e-9);
    expect(Math.abs(p.y - expectedY)).toBeLessThan(1e-9);
    // x축은 cos(36°) 압축이 적용되므로 동일 도 차이라도 y(미보정)보다 작은 비율.
    expect(Math.cos((36.0 * Math.PI) / 180.0)).toBeLessThan(1.0);
  });

  // 균일 스케일 + 가로 cos보정 검증.
  it('uniformScaleWithLongitudeCosineCorrection', () => {
    const cfg = koreaConfig();
    const base: Coordinate = { lat: 36.0, lon: 126.0 };
    const oneDegEast: Coordinate = { lat: 36.0, lon: 127.0 }; // 경도 +1°
    const oneDegSouth: Coordinate = { lat: 35.0, lon: 126.0 }; // 위도 −1°
    const pBase = project(base, cfg);
    const pEast = project(oneDegEast, cfg);
    const pSouth = project(oneDegSouth, cfg);
    const dx = pEast.x - pBase.x; // 경도 1°의 화면 폭
    const dy = pSouth.y - pBase.y; // 위도 1°의 화면 높이
    expect(Math.abs(dx - dy * Math.cos((36.0 * Math.PI) / 180.0))).toBeLessThan(1e-9);
    // 위도 1°의 화면 높이는 정확히 scale(균일 스케일, 미보정).
    expect(Math.abs(dy - cfg.scale)).toBeLessThan(1e-9);
  });

  // Y반전 방향 확인: 북쪽 위도가 더 작은 y(화면 위)에 위치.
  it('yAxisInvertedNorthIsUp', () => {
    const cfg = koreaConfig();
    const north: Coordinate = { lat: 38.0, lon: 127.0 };
    const south: Coordinate = { lat: 34.0, lon: 127.0 };
    const pNorth = project(north, cfg);
    const pSouth = project(south, cfg);
    expect(pNorth.y).toBeLessThan(pSouth.y); // 북쪽이 위(y 작음)
  });

  // degenerate: scale == 0 이면 역투영 비가역 → null 반환(분모 0 방어).
  it('unprojectReturnsNilWhenScaleZero', () => {
    const cfg: ProjectionConfig = { minLon: 124.5, maxLat: 38.7, refLat: 36.0, scale: 0.0 };
    // 정투영은 전사: scale=0 이면 모든 점이 (0,0) 근방으로 붕괴.
    const collapsed = project({ lat: 35.0, lon: 128.0 }, cfg);
    expect(Math.abs(collapsed.x - 0.0)).toBeLessThan(1e-9);
    expect(Math.abs(collapsed.y - 0.0)).toBeLessThan(1e-9);
    // 역투영은 분모 0 → null.
    expect(unproject({ x: 10, y: 10 }, cfg)).toBeNull();
  });

  // refLat이 36.0으로 하드코딩되지 않고 config.refLat에서 읽히는지 잠근다(SSOT 회귀 방지).
  it('cosFactorReadsFromConfigNotHardcoded', () => {
    const c: Coordinate = { lat: 38.7, lon: 126.0 };
    const cfgA: ProjectionConfig = { minLon: 124.5, maxLat: 38.7, refLat: 0.0, scale: 1000.0 };
    const cfgB: ProjectionConfig = { minLon: 124.5, maxLat: 38.7, refLat: 60.0, scale: 1000.0 };
    const xA = project(c, cfgA).x;
    const xB = project(c, cfgB).x;
    expect(Math.abs(xA - (126.0 - 124.5) * Math.cos(0.0) * 1000.0)).toBeLessThan(1e-9);
    expect(Math.abs(xB - (126.0 - 124.5) * Math.cos((60.0 * Math.PI) / 180.0) * 1000.0)).toBeLessThan(1e-9);
    // XCTAssertNotEqual(accuracy:1e-6) → 차이가 1e-6 초과.
    expect(Math.abs(xA - xB)).toBeGreaterThan(1e-6);
  });

  // degenerate: bbox 폭 0(minLon == 경도). x는 항상 0, 역투영은 정상 동작(가역).
  it('zeroWidthBboxProjectsXToZeroAndRoundTrips', () => {
    const cfg: ProjectionConfig = { minLon: 127.0, maxLat: 38.7, refLat: 36.0, scale: 1000.0 };
    const onLeftEdge: Coordinate = { lat: 36.0, lon: 127.0 }; // minLon 직상
    const p = project(onLeftEdge, cfg);
    expect(Math.abs(p.x - 0.0)).toBeLessThan(1e-9);
    // scale·cos ≠ 0 이므로 역투영 가역.
    const back = unproject(p, cfg);
    expect(back).not.toBeNull();
    expect(Math.abs((back as Coordinate).lat - onLeftEdge.lat)).toBeLessThan(1e-9);
    expect(Math.abs((back as Coordinate).lon - onLeftEdge.lon)).toBeLessThan(1e-9);
  });

  // --- 추가: 팩토리/상수/lonScaleFactor 계약 회귀 (카드 exportsTs 보강) ---

  // makeProjectionConfig: refLat 생략 시 DEFAULT_REF_LAT(36.0) 주입.
  it('makeProjectionConfigDefaultsRefLat', () => {
    const cfg = makeProjectionConfig({ minLon: 124.5, maxLat: 38.7, scale: 1000.0 });
    expect(cfg.refLat).toBe(DEFAULT_REF_LAT);
    expect(DEFAULT_REF_LAT).toBe(36.0);
    // refLat 명시 주입 시 그 값 유지.
    const cfg2 = makeProjectionConfig({ minLon: 124.5, maxLat: 38.7, refLat: 60.0, scale: 1000.0 });
    expect(cfg2.refLat).toBe(60.0);
  });

  // lonScaleFactor: cos(refLat° → rad) 순수 함수.
  it('lonScaleFactorComputesCosOfRefLat', () => {
    const cfg: ProjectionConfig = { minLon: 0, maxLat: 0, refLat: 36.0, scale: 1.0 };
    expect(lonScaleFactor(cfg)).toBe(Math.cos((36.0 * Math.PI) / 180.0));
    const cfg0: ProjectionConfig = { minLon: 0, maxLat: 0, refLat: 0.0, scale: 1.0 };
    expect(lonScaleFactor(cfg0)).toBe(1.0);
  });
});
