// 공유 지오메트리 타입 — Swift BaljachwiCore/GeoTypes.swift 의 byte-faithful 포트.
//
// PointInPolygon은 위상 판정이므로 투영 없이 (x = lon, y = lat) 평면을 그대로 사용
// (MapProjection 비의존). 이 주석은 pointInPolygon 포팅 시 축 혼동 방지용으로 보존할 것.

/** 위경도 좌표. Swift: Equatable+Hashable — TS에서는 구조적 비교 헬퍼로 대체.
 *  JS의 ===는 참조 비교이므로 동등성이 필요하면 (a.lat===b.lat && a.lon===b.lon)로. */
export interface Coordinate {
  lat: number;
  lon: number;
}

/** 단일 폴리곤 — 외곽 링 1개 + 0개 이상의 홀. holes는 옵셔널 금지(항상 [] 명시). */
export interface Polygon {
  outer: Coordinate[];
  holes: Coordinate[][];
}

/** 다중 폴리곤 — 옹진군·신안군 등 다도서 표현. 매칭/히트테스트 SSOT 입력 타입.
 *  {polygons} 래퍼 유지 — Polygon[]로 평탄화 금지(다도서 오판 원인). */
export interface MultiPolygon {
  polygons: Polygon[];
}

/** 경계 박스. Swift 원본은 TripSegmenter.swift 정의지만 웹 포트에서는 geoTypes로 이전 배치
 *  (공유 타입 SSOT). 다른 모듈에서 BBox 재정의 금지 — 여기서 import. */
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
