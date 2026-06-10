# 모듈 카드: geojsonDecode

**TS 타겟:** src/core/geojsonDecode.ts

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
```ts
// src/core/geojsonDecode.ts
import type { Coordinate, Polygon, MultiPolygon } from "./geoTypes";

/** 코드 프로퍼티 키 — 시군구('sgg') / 시도('sido'). geojson마다 한쪽만 존재. */
export type CodeKey = "sgg" | "sido";

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
  codeKey: CodeKey = "sgg",
): Map<string, MultiPolygon>;

/** 시군구('sgg') 전용 래퍼 — Swift `polygonsBySgg(from:)` 대응. */
export function polygonsBySgg(json: unknown): Map<string, MultiPolygon> {
  return polygonsFromGeoJSON(json, "sgg");
}

// ── 내부 구조 타입(검증 후의 형태 문서화용 — Swift Decodable struct 대응) ──
// 다른 모듈이 import할 필요는 없으나, 테스트 픽스처 타이핑 편의를 위해 export 허용.
export interface GeoJSONFeatureCollection { features: GeoJSONFeature[]; }
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
```
```

## 보존 상수 (constants)

- codeKeyDefault='sgg'
- geometryTypePolygon="Polygon"
- geometryTypeMultiPolygon="MultiPolygon"
- propertyKeySgg="sgg"
- propertyKeySido="sido"

## 포팅할 테스트 (testsToPort)

### polygonNormalizedToMultiPolygon (신규 — Swift 직접 테스트 없음)
픽스처: {features:[{properties:{sgg:'11110'},geometry:{type:'Polygon',coordinates:[[[126.97,37.57],[126.99,37.57],[126.99,37.60],[126.97,37.57]]]}}]} → map.size===1, get('11110').polygons.length===1, outer.length===4, outer[0]==={lat:37.57,lon:126.97} (lon/lat 스왑 검증 — 가장 흔한 버그 지점)

### multiPolygonPreservesOrderAndCount
type:'MultiPolygon', coordinates=폴리곤 2개(A: 첫 점 [126.5,37.0], B: 첫 점 [129.0,35.1]) → polygons.length===2, polygons[0].outer[0].lon===126.5, polygons[1].outer[0].lon===129.0 (입력 순서 보존)

### firstRingIsOuterRestAreHoles
Polygon에 ring 3개(ring0=외곽 4점, ring1·ring2=구멍 각 4점) → outer===ring0 스왑매핑, holes.length===2, holes[0][0]==={lat:ring1[0][1], lon:ring1[0][0]}

### featureWithoutCodeKeySkipped
codeKey='sgg'인데 properties:{sido:'11'}만 있는 feature 1개 → map.size===0 (guard-continue 스킵)

### sidoCodeKeyDecodesSidoGeojson
동일 픽스처(properties:{sido:'11'})를 codeKey='sido'로 → '11' 키 존재; codeKey='sgg'로 → 없음

### unknownGeometryTypeYieldsEmptyMultiPolygonNotSkipped
geometry:{type:'Point',coordinates:[127.0,37.5]}, properties:{sgg:'99999'} → map.has('99999')===true, polygons.length===0 (키는 들어가고 폴리곤만 빈 배열 — 스킵 아님, Swift default 분기 보존)

### duplicateCodeLastWins
sgg:'11110' feature 2개(첫째 Polygon outer 4점, 둘째 outer 5점) → 결과 outer.length===5 (byCode[code]= 덮어쓰기, 마지막 승)

### polygonsBySggEqualsPolygonsWithSggKey
동일 픽스처를 polygonsBySgg(json)과 polygonsFromGeoJSON(json,'sgg')로 → deep-equal

### emptyRingsPolygonYieldsEmptyOuter
geometry:{type:'Polygon',coordinates:[]}, sgg:'11110' → polygons.length===1, polygons[0].outer.length===0, holes.length===0 (rings.first 없음 가드)

### emptyFeatureCollection
{features:[]} → map.size===0

### malformedShapeThrows
(1) {} (features 누락), (2) features 원소에 geometry 누락, (3) type:'Polygon'인데 coordinates:'oops'(문자열), (4) geometry.type 누락 — 각각 throw (Swift JSONDecoder DecodingError 대응)

### nullCodeTreatedAsAbsent
properties:{sgg:null} (명시적 null) → 해당 feature 스킵, map.size===0 (Swift decodeIfPresent는 null/누락 모두 nil)

## 포팅 함정 (notes)

함정: (1) lon/lat 스왑이 핵심 — GeoJSON pair는 [lon,lat]이고 Coordinate는 {lat:pair[1], lon:pair[0]}. 절대 뒤집지 말 것. (2) Swift 옵셔널 sgg/sido는 키 누락과 명시적 null 모두 nil → TS에선 undefined와 null 둘 다 '없음'으로 처리해 feature 스킵. (3) 알 수 없는 geometry type("Point" 등)은 스킵이 아니라 빈 MultiPolygon(polygons:[])으로 키가 들어감 — 이 미묘한 동작 보존 필수. (4) Swift Dictionary는 순서 없음 → TS는 Map 사용(get 미존재=undefined가 Swift 옵셔널 대응). 소비자(geoStores)가 순회 순서에 의존하면 안 됨. JS 객체/Map 모두 삽입순이라 결과적으로 결정적이긴 함. (5) Swift는 pair[1] 접근 시 원소 <2면 크래시(trap) — TS는 undefined가 조용히 들어가므로, 좌표 pair 길이<2 또는 비-number 원소면 명시적 throw 권장(조용한 NaN 전파 금지). (6) JSONDecoder의 구조 검증을 TS에서 직접 구현해야 함: features 배열, properties/geometry 객체, geometry.type 문자열, 선언된 type에 맞는 coordinates 중첩 깊이(Polygon=3겹, MultiPolygon=4겹) 검증 후 불일치 시 throw. (7) 숫자는 JSON.parse가 이미 float64 number — Swift Double과 동일, 변환 불필요. (8) 시간/정렬/임계값 로직 없음 — 순수 구조 변환이라 byte-faithful 리스크 낮음. 기본 인자 codeKey='sgg' 보존. (9) 간접 ground-truth(GeoDataStoreTests.swift, 실제 sigungu.geojson 자산 필요): 255 feature 전부 디코드, 신안군 46910=191 polygons, 옹진군 28720=77, 울릉군 47940=5, 종로구 11110=1(outer>=3, 첫 점 lat∈[37,38]·lon∈[126,128]) — 이 통합 테스트들은 geoStores 카드에서 포팅하되 본 디코더를 경유함. (10) Swift 원본의 reserveCapacity는 성능 힌트일 뿐 — TS에서 무시.