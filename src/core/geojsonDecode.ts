// src/core/geojsonDecode.ts
//
// Swift BaljachwiCore/GeoJSONDecode.swift 의 byte-faithful 포트.
//
// 경계 분리: Swift는 `Data + JSONDecoder`로 디코드하지만, 웹에서는 JSON.parse 결과(unknown)를 받는다.
// Swift JSONDecoder가 수행하던 구조 검증(DecodingError throw)을 이 모듈이 직접 구현한다.
//
// 좌표 매핑: GeoJSON `[lon, lat]` → `Coordinate{lat: pair[1], lon: pair[0]}` (뒤집힘이 가장 흔한 버그 지점).

import type { Coordinate, Polygon, MultiPolygon } from "./geoTypes";

/** 코드 프로퍼티 키 — 시군구('sgg') / 시도('sido'). geojson마다 한쪽만 존재. */
export type CodeKey = "sgg" | "sido";

// ── 보존 상수 (constants) ──────────────────────────────────────────
const codeKeyDefault: CodeKey = "sgg";
const geometryTypePolygon = "Polygon";
const geometryTypeMultiPolygon = "MultiPolygon";
const propertyKeySgg = "sgg";
const propertyKeySido = "sido";

// ── 내부 구조 타입(검증 후의 형태 문서화용 — Swift Decodable struct 대응) ──
// 다른 모듈이 import할 필요는 없으나, 테스트 픽스처 타이핑 편의를 위해 export 허용.
export interface GeoJSONFeatureCollection {
  features: GeoJSONFeature[];
}
export interface GeoJSONFeature {
  properties: GeoJSONProperties;
  geometry: GeoJSONGeometry;
}
export interface GeoJSONProperties {
  /** 5자리 MOIS SIG_CD — 시도 geojson엔 없음 */
  sgg?: string | null;
  /** 2자리 시도 코드 — 시군구 geojson엔 없음 */
  sido?: string | null;
}
export interface GeoJSONGeometry {
  type: string; // "Polygon" | "MultiPolygon" | 기타(기타면 빈 MultiPolygon)
  coordinates?: unknown;
}

/** Swift JSONDecoder.DecodingError 대응 — 구조 불일치 시 throw. */
class GeoJSONDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeoJSONDecodeError";
  }
}

function fail(message: string): never {
  throw new GeoJSONDecodeError(message);
}

// ── 구조 검증 헬퍼 (Swift JSONDecoder 대체) ───────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `[lon, lat]` pair → `Coordinate{lat: pair[1], lon: pair[0]}`.
 *  Swift는 pair[1] 접근 시 원소 <2면 trap → TS는 명시적 throw(조용한 NaN 전파 금지). */
function makeCoordinate(pair: unknown): Coordinate {
  if (!Array.isArray(pair)) {
    fail("coordinate pair must be an array");
  }
  if (pair.length < 2) {
    fail("coordinate pair must have at least 2 elements");
  }
  const lon = pair[0];
  const lat = pair[1];
  if (typeof lon !== "number" || typeof lat !== "number") {
    fail("coordinate pair elements must be numbers");
  }
  return { lat: lat, lon: lon };
}

/** ring(`[[lon,lat]...]`) → Coordinate[]. */
function makeRing(ring: unknown): Coordinate[] {
  if (!Array.isArray(ring)) {
    fail("ring must be an array of coordinate pairs");
  }
  return ring.map(makeCoordinate);
}

/** ring 목록(`[[[lon,lat]...]...]`) → Polygon. 첫 ring=outer, 나머지=holes. */
function makePolygonFromRings(rings: unknown): Polygon {
  if (!Array.isArray(rings)) {
    fail("polygon rings must be an array");
  }
  // Swift: guard let outerRing = rings.first else { return Polygon(outer: [], holes: []) }
  if (rings.length === 0) {
    return { outer: [], holes: [] };
  }
  const outer = makeRing(rings[0]);
  const holes = rings.slice(1).map(makeRing);
  return { outer, holes };
}

/** Polygon geometry coordinates(`[[[lon,lat]...]...]`, 3겹) → MultiPolygon(폴리곤 1개). */
function polygonCoordsToMultiPolygon(coordinates: unknown): MultiPolygon {
  // Swift: try container.decode([[[Double]]].self) — 3겹 배열 강제.
  if (!Array.isArray(coordinates)) {
    fail("Polygon coordinates must be a 3-level nested array");
  }
  return { polygons: [makePolygonFromRings(coordinates)] };
}

/** MultiPolygon geometry coordinates(`[[[[lon,lat]...]...]...]`, 4겹) → MultiPolygon. */
function multiPolygonCoordsToMultiPolygon(coordinates: unknown): MultiPolygon {
  // Swift: try container.decode([[[[Double]]]].self) — 4겹 배열 강제.
  if (!Array.isArray(coordinates)) {
    fail("MultiPolygon coordinates must be a 4-level nested array");
  }
  return { polygons: coordinates.map(makePolygonFromRings) };
}

/** 검증된 geometry → MultiPolygon 정규화.
 *  Swift GeoJSONGeometry.init(from:) + toMultiPolygon() 합성:
 *  - "Polygon"      → coordinates를 [[[Double]]]로 디코드(실패 시 throw), 폴리곤 1개
 *  - "MultiPolygon" → coordinates를 [[[[Double]]]]로 디코드(실패 시 throw)
 *  - 그 외          → 빈 MultiPolygon(스킵 아님 — default 분기 보존) */
function geometryToMultiPolygon(geometry: unknown): MultiPolygon {
  if (!isPlainObject(geometry)) {
    fail("feature.geometry must be an object");
  }
  // Swift: try container.decode(String.self, forKey: .type) — type 누락/비문자열이면 throw.
  const type = geometry["type"];
  if (typeof type !== "string") {
    fail("geometry.type must be a string");
  }
  const coordinates = geometry["coordinates"];
  switch (type) {
    case geometryTypePolygon:
      // Swift: forKey: .coordinates 디코드 — 키 누락/타입 불일치면 throw.
      return polygonCoordsToMultiPolygon(coordinates);
    case geometryTypeMultiPolygon:
      return multiPolygonCoordsToMultiPolygon(coordinates);
    default:
      // 알 수 없는 type: polygonRings=nil, multiPolygonCoords=nil → 빈 MultiPolygon.
      return { polygons: [] };
  }
}

/** properties에서 code 추출. Swift decodeIfPresent: 키 누락·명시적 null 모두 nil 처리.
 *  TS에선 undefined와 null 둘 다 '없음'으로 처리해 feature 스킵 유도(null 반환). */
function extractCode(properties: unknown, codeKey: CodeKey): string | null {
  if (!isPlainObject(properties)) {
    fail("feature.properties must be an object");
  }
  const key = codeKey === "sgg" ? propertyKeySgg : propertyKeySido;
  const raw = properties[key];
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    // Swift decode(String?)는 비문자열이면 throw — 구조 검증 유지.
    fail(`property '${key}' must be a string when present`);
  }
  return raw;
}

/**
 * 경계 분리: Swift의 `Data + JSONDecoder` 대신 JSON.parse 결과(unknown)를 받는다.
 * JSONDecoder의 구조 검증(throws)을 이 함수가 대신 수행한다.
 *
 * GeoJSON FeatureCollection → { code → MultiPolygon }.
 * - "Polygon"은 MultiPolygon(폴리곤 1개)으로 정규화
 * - codeKey 키가 없는 feature는 스킵
 * - 좌표 [lon, lat] → Coordinate{lat: pair[1], lon: pair[0]}
 * - 첫 ring = outer, 나머지 ring = holes
 * - 구조가 GeoJSON 스키마와 다르면 throw (Swift DecodingError 대응)
 */
export function polygonsFromGeoJSON(
  json: unknown,
  codeKey: CodeKey = codeKeyDefault,
): Map<string, MultiPolygon> {
  // Swift: JSONDecoder().decode(GeoJSONFeatureCollection.self) — features 누락/타입 불일치면 throw.
  if (!isPlainObject(json)) {
    fail("root must be a GeoJSON FeatureCollection object");
  }
  const features = json["features"];
  if (!Array.isArray(features)) {
    fail("FeatureCollection.features must be an array");
  }

  const byCode = new Map<string, MultiPolygon>();
  for (const feature of features) {
    if (!isPlainObject(feature)) {
      fail("each feature must be an object");
    }
    if (!("geometry" in feature)) {
      // Swift GeoJSONFeature.geometry는 비옵셔널 → 누락 시 DecodingError.
      fail("feature.geometry is required");
    }
    if (!("properties" in feature)) {
      // Swift GeoJSONFeature.properties는 비옵셔널 → 누락 시 DecodingError.
      fail("feature.properties is required");
    }
    // geometry는 code 유무와 무관하게 항상 디코드(구조 검증) — Swift JSONDecoder가 collection
    // 전체를 선디코드하므로, code가 없어도 잘못된 geometry는 throw 되어야 함.
    const multiPolygon = geometryToMultiPolygon(feature["geometry"]);
    const code = extractCode(feature["properties"], codeKey);
    if (code === null) {
      continue; // Swift: guard let code = ... else { continue }
    }
    // Swift: byCode[code] = ... — 중복 코드는 마지막 승(last-wins).
    byCode.set(code, multiPolygon);
  }
  return byCode;
}

/** 시군구('sgg') 전용 래퍼 — Swift `polygonsBySgg(from:)` 대응. */
export function polygonsBySgg(json: unknown): Map<string, MultiPolygon> {
  return polygonsFromGeoJSON(json, "sgg");
}
