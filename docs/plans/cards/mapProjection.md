# 모듈 카드: mapProjection

**TS 타겟:** src/core/mapProjection.ts

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
```ts
// src/core/mapProjection.ts
import type { Coordinate } from "./geoTypes";

/** CGPoint 대응. 화면 좌표(pt). */
export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * 등거리 정투영 파라미터.
 * 좌표계 규약(SSOT): 원점 = bbox 좌상단 (minLon, maxLat) → (0,0).
 * x: 동(+lon) → 오른쪽. y: Y반전 — 북(maxLat)이 y=0, 남쪽으로 y 증가.
 */
export interface ProjectionConfig {
  /** bbox 서단 경도(도). 화면 x=0 기준. */
  minLon: number;
  /** bbox 북단 위도(도). 화면 y=0 기준(Y반전 기준점). */
  maxLat: number;
  /** 경도 cos 보정 기준 위도(도). 기본 36.0(한국 중심). */
  refLat: number;
  /** 균일 스케일(pt/도). 0이면 unproject 비가역 → null. */
  scale: number;
}

/** Swift init 기본값 refLat=36.0 대응 팩토리. */
export function makeProjectionConfig(args: {
  minLon: number;
  maxLat: number;
  refLat?: number; // 생략 시 DEFAULT_REF_LAT(36.0)
  scale: number;
}): ProjectionConfig {
  return {
    minLon: args.minLon,
    maxLat: args.maxLat,
    refLat: args.refLat ?? DEFAULT_REF_LAT,
    scale: args.scale,
  };
}

export const DEFAULT_REF_LAT = 36.0;

/** Swift computed var lonScaleFactor 대응: cos(refLat° → rad). */
export function lonScaleFactor(config: ProjectionConfig): number {
  return Math.cos((config.refLat * Math.PI) / 180.0);
}

/**
 * 정투영(전사·total).
 * x = (lon − minLon) · cos(refLat°) · scale
 * y = (maxLat − lat) · scale
 */
export function project(coordinate: Coordinate, config: ProjectionConfig): ScreenPoint {
  const x = (coordinate.lon - config.minLon) * lonScaleFactor(config) * config.scale;
  const y = (config.maxLat - coordinate.lat) * config.scale;
  return { x, y };
}

/**
 * 역투영. project의 정확한 역연산.
 * lon = x / (cos(refLat°)·scale) + minLon ; lat = maxLat − y / scale
 * 비가역 방어: scale === 0 또는 lonDenom === 0 이면 null (Swift nil 대응).
 */
export function unproject(point: ScreenPoint, config: ProjectionConfig): Coordinate | null {
  const lonDenom = lonScaleFactor(config) * config.scale;
  if (config.scale === 0 || lonDenom === 0) return null;
  const lon = point.x / lonDenom + config.minLon;
  const lat = config.maxLat - point.y / config.scale;
  return { lat, lon };
}
```
```

## 보존 상수 (constants)

- DEFAULT_REF_LAT=36.0 (ProjectionConfig.refLat 기본값, 한국 중심 위도)
- 도→라디안 변환 계수 = π/180 (lonScaleFactor 내부 인라인, 별도 상수 불필요하나 식 그대로 보존)

## 포팅할 테스트 (testsToPort)

### roundTripScreenWithinOnePixel
cfg={minLon:124.5, maxLat:38.7, refLat:36.0, scale:1000}(이하 koreaConfig). 서울 c={lat:37.5663, lon:126.9779}. p=project(c) → back=unproject(p)(non-null 단언) → rep=project(back). |rep.x−p.x|<1.0, |rep.y−p.y|<1.0. 참고: p≈(x:2004.8003..., y:1133.7)

### roundTripGeoWithinEpsilon
koreaConfig. 부산 c={lat:35.1796, lon:129.0756}. back=unproject(project(c)) non-null, |back.lat−35.1796|<1e-9, |back.lon−129.0756|<1e-9

### topLeftCornerMapsToOrigin
koreaConfig. c={lat:38.7, lon:124.5}(=maxLat,minLon) → project 결과 |x−0|<1e-9, |y−0|<1e-9

### bottomRightCornerMapsToExpectedExtremes
koreaConfig. c={lat:33.0, lon:132.0}. expectedX=(132.0−124.5)*Math.cos(36*Math.PI/180)*1000 (≈6067.627457812106), expectedY=(38.7−33.0)*1000=5700.000000000001 근방(38.7−33.0의 float 결과 그대로 식으로 계산). |p.x−expectedX|<1e-9, |p.y−expectedY|<1e-9. 추가: Math.cos(36°rad)<1.0 단언

### uniformScaleWithLongitudeCosineCorrection
koreaConfig. base={36.0,126.0}, east={36.0,127.0}, south={35.0,126.0}. dx=pEast.x−pBase.x, dy=pSouth.y−pBase.y. |dx − dy*Math.cos(36*Math.PI/180)|<1e-9 (dx≈809.0169943749475), |dy−1000|<1e-9

### yAxisInvertedNorthIsUp
koreaConfig. north={38.0,127.0}→y=700, south={34.0,127.0}→y=4700. pNorth.y < pSouth.y (strict)

### unprojectReturnsNilWhenScaleZero
cfg={minLon:124.5, maxLat:38.7, refLat:36.0, scale:0}. project({lat:35.0,lon:128.0}) → |x|<1e-9, |y|<1e-9 (전사: (0,0)으로 붕괴). unproject({x:10,y:10}) === null

### cosFactorReadsFromConfigNotHardcoded
c={lat:38.7, lon:126.0}. cfgA: refLat=0, minLon=124.5, maxLat=38.7, scale=1000 → xA, |xA − (126.0−124.5)*Math.cos(0)*1000(=1500)|<1e-9. cfgB: refLat=60 동일 → xB, |xB − 1.5*Math.cos(60*Math.PI/180)*1000(≈750.0000000000001)|<1e-9. 그리고 |xA−xB|>1e-6 (XCTAssertNotEqual accuracy 의미: 차이가 1e-6 초과)

### zeroWidthBboxProjectsXToZeroAndRoundTrips
cfg={minLon:127.0, maxLat:38.7, refLat:36.0, scale:1000}. c={lat:36.0, lon:127.0}(minLon 직상) → |p.x−0|<1e-9. back=unproject(p) non-null, |back.lat−36.0|<1e-9, |back.lon−127.0|<1e-9

## 포팅 함정 (notes)

포팅 함정: (1) CGPoint→ScreenPoint{x,y} plain object. macOS CGFloat=Double이므로 정밀도 손실 없음 — Swift의 Double(point.x) 캐스트는 TS에서 no-op. (2) unproject의 Coordinate? → Coordinate | null (예외 throw 금지, 옵셔널→null 그대로). guard 두 조건 모두 보존: scale === 0 || lonDenom === 0. lonDenom 체크는 cos(refLat°)*scale 곱이 정확히 0인 경우용 — float64에서 -0도 ===0이 true이므로 Swift(-0.0==0 → nil)와 동일 동작. NaN scale은 두 언어 모두 가드를 통과해 NaN 좌표 반환 — 그대로 둔다(byte-faithful). (3) lonScaleFactor는 Swift computed var → 매 호출 재계산하는 순수 함수로 포팅(캐싱 금지, 결과 동일). (4) refLat 기본값 36.0은 Swift init 기본 인자 — TS interface에는 기본값이 없으므로 makeProjectionConfig 팩토리(refLat ?? 36.0)로 경계 보존. 테스트는 전부 refLat 명시 주입이라 팩토리 기본값 자체 테스트는 없음(SSOT 회귀 테스트 cosFactorReadsFromConfig가 하드코딩 방지를 잠금). (5) Math.cos vs Swift cos: 동일 IEEE754 double, 테스트 허용오차 1e-9라 ulp 차이 무관. 기대값은 리터럴 하드코딩 대신 테스트 안에서 같은 식(Math.cos(36*Math.PI/180) 등)으로 재계산할 것 — Swift 테스트도 식으로 계산함. (6) XCTAssertEqual(a,b,accuracy:e) → |a−b|<=e (Jest: expect(Math.abs(a−b)).toBeLessThanOrEqual(e) 또는 toBeCloseTo 대신 명시적 abs 비교 권장), XCTAssertNotEqual(accuracy:1e-6) → |xA−xB|>1e-6, XCTUnwrap → null 체크 후 사용. (7) Date/정수산술/정렬/IO 전혀 없음 — 완전 순수 모듈. 의존은 geoTypes의 Coordinate{lat,lon}뿐. (이 카드의 dataActorReconcile 제외 규칙은 본 모듈과 무관 — 해당 없음.)