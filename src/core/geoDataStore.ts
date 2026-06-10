// src/core/geoDataStore.ts
//
// Swift BaljachwiCore/GeoDataStore.swift 의 byte-faithful 포트.
//
// IO 경계 분리: Swift init은 Bundle.module에서 직접 region_codes.json / sigungu.geojson 을 읽지만,
// TS는 파싱된 JSON을 생성자 인자로 받는다(Bundle/fetch 금지). GeoDataStoreError.resourceNotFound(파일
// 못 찾음)는 코어에서 제거하고 로더(fetch) 레이어 책임으로 이동 — 코어에는 대응 에러 타입 불필요.
// geojsonDecode가 구조 오류 시 throw하면 그대로 전파한다.

import type { MultiPolygon } from './geoTypes';
import { polygonsBySgg } from './geojsonDecode';

/**
 * region_codes.json 한 엔트리. JSON 키와 1:1 (camelCase 그대로).
 * bbox = [minLon, minLat, maxLon, maxLat] — 경도 먼저.
 */
export interface RegionCodeEntry {
  regionCode: string; // MOIS SIG_CD(시군구) 또는 시도 코드
  level: string; // "sido" | "sigungu"
  nameKo: string;
  sidoCode: string; // 소속 시도 코드(2자리)
  bbox: number[]; // [minLon, minLat, maxLon, maxLat]
}

/**
 * 매칭용 원본 시군구 폴리곤 저장소(순수).
 * Swift init의 Bundle IO를 제거 — 파싱된 JSON을 인자로 받는다.
 *
 * - region_codes.json → entries(272개, 시도 + 시군구).
 * - sigungu.geojson → regionCode → MultiPolygon(255개, sgg 키 feature만).
 *   GeoJSON "Polygon"은 MultiPolygon(폴리곤 1개)로 정규화한다(geojsonDecode 담당).
 *
 * 좌표 매핑: GeoJSON [lon, lat] → Coordinate{lat, lon} (geojsonDecode 담당).
 */
export class GeoDataStore {
  /** region_codes.json 전체 엔트리(시도 + 시군구). */
  readonly entries: RegionCodeEntry[];

  /** 시군구 regionCode → 정규화된 MultiPolygon. */
  private readonly polygons: Map<string, MultiPolygon>;

  /**
   * @param entries  JSON.parse(region_codes.json) 결과 (272개)
   * @param sigunguGeoJSON  JSON.parse(sigungu.geojson) 결과 (255 feature)
   */
  constructor(entries: RegionCodeEntry[], sigunguGeoJSON: unknown) {
    this.entries = entries;
    // 매칭용 원본 — 공용 디코더(geojsonDecode)의 sgg 래퍼 사용.
    this.polygons = polygonsBySgg(sigunguGeoJSON);
  }

  /** 시군구 regionCode → MultiPolygon. 없으면(시도 코드 포함) undefined. */
  polygon(regionCode: string): MultiPolygon | undefined {
    return this.polygons.get(regionCode);
  }
}
