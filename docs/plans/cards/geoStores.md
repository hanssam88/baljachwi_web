# 모듈 카드: geoStores

**TS 타겟:** src/core/geoDataStore.ts + src/core/displayGeoStore.ts + src/core/regionNames.ts

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
```ts
// ===== src/core/geoDataStore.ts =====
import type { MultiPolygon } from "./geoTypes";
import { polygonsByCode, type GeoJSONFeatureCollectionRaw } from "./geojsonDecode";

/**
 * region_codes.json 한 엔트리. JSON 키와 1:1 (camelCase 그대로).
 * bbox = [minLon, minLat, maxLon, maxLat] — 경도 먼저.
 */
export interface RegionCodeEntry {
  regionCode: string;        // MOIS SIG_CD(시군구) 또는 시도 코드
  level: string;             // "sido" | "sigungu"
  nameKo: string;
  sidoCode: string;          // 소속 시도 코드(2자리)
  bbox: number[];            // [minLon, minLat, maxLon, maxLat]
}

/**
 * 매칭용 원본 시군구 폴리곤 저장소(순수).
 * Swift init의 Bundle IO를 제거 — 파싱된 JSON을 인자로 받는다.
 * @param entries  JSON.parse(region_codes.json) 결과 (272개)
 * @param sigunguGeoJSON  JSON.parse(sigungu.geojson) 결과 (255 feature)
 */
export class GeoDataStore {
  readonly entries: RegionCodeEntry[];
  private readonly polygons: Map<string, MultiPolygon>;
  constructor(entries: RegionCodeEntry[], sigunguGeoJSON: GeoJSONFeatureCollectionRaw);
  /** 시군구 regionCode → MultiPolygon. 없으면(시도 코드 포함) undefined. */
  polygon(regionCode: string): MultiPolygon | undefined;
}

// ===== src/core/displayGeoStore.ts =====
import type { MultiPolygon, BBox } from "./geoTypes";
import { polygonsByCode, type CodeKey, type GeoJSONFeatureCollectionRaw } from "./geojsonDecode";

/** 표시 레벨 — Swift enum Level { sigungu, sido } 대응. */
export type DisplayLevel = "sigungu" | "sido";

/**
 * 표시용(단순화) 폴리곤 저장소 — choropleth 렌더 전용. 매칭에 절대 사용 금지.
 * Swift는 level이 리소스 파일까지 선택했으나, IO 분리 후 파일 선택은 로더 몫:
 *   level="sigungu" ↔ sigungu_display.geojson(codeKey "sgg"),
 *   level="sido"    ↔ sido_display.geojson(codeKey "sido").
 */
export class DisplayGeoStore {
  /** regionCode → 표시용 MultiPolygon. */
  readonly polygons: Map<string, MultiPolygon>;
  /** 전 폴리곤 outer ring 합집합 bbox (투영 fit용). */
  readonly bbox: BBox;
  constructor(geojson: GeoJSONFeatureCollectionRaw, level?: DisplayLevel); // default "sigungu"
}

// (내부) 모든 outer ring에서 min/max 누적. holes 미사용. 10줄 이하라 본문 포함 가능:
// function computeBBox(polygons: Map<string, MultiPolygon>): BBox {
//   let minLat = Number.MAX_VALUE, minLon = Number.MAX_VALUE;
//   let maxLat = -Number.MAX_VALUE, maxLon = -Number.MAX_VALUE;
//   for (const mp of polygons.values())
//     for (const poly of mp.polygons)
//       for (const c of poly.outer) {
//         minLat = Math.min(minLat, c.lat); minLon = Math.min(minLon, c.lon);
//         maxLat = Math.max(maxLat, c.lat); maxLon = Math.max(maxLon, c.lon);
//       }
//   return { minLat, minLon, maxLat, maxLon };
// }

// ===== src/core/regionNames.ts =====
import type { RegionCodeEntry } from "./geoDataStore";

/**
 * regionCode → 표시명 사전(순수). 시군구="시도약칭 시군구명"("부산 연제구"), 시도=nameKo 그대로.
 * 11MB 폴리곤 없이 region_codes.json만으로 동작.
 */
export class RegionNames {
  readonly names: Map<string, string>;
  constructor(entries: RegionCodeEntry[]); // JSON.parse(region_codes.json) 결과
}

/**
 * 시도 약칭 — 행정 접미사 제거. Swift static func shorten 대응 (테스트가 직접 호출).
 * 접미사 검사 순서가 로직의 일부: "특별자치도"가 "도"보다 먼저.
 */
export function shorten(sido: string): string;
// 본문 (10줄 이하):
// for (const suffix of SIDO_SUFFIXES)
//   if (sido.endsWith(suffix)) return sido.slice(0, sido.length - suffix.length);
// return sido;
```
```

## 보존 상수 (constants)

- SIDO_SUFFIXES=["특별자치도","특별자치시","특별시","광역시","도"] (배열 순서 보존 필수 — "특별자치도"가 "도"보다 먼저)
- LEVEL_SIGUNGU="sigungu"
- LEVEL_SIDO="sido"
- codeKey 매핑: sigungu→"sgg", sido→"sido"
- DisplayGeoStore level 기본값="sigungu"
- computeBBox 초기값: min=+Number.MAX_VALUE, max=-Number.MAX_VALUE (Swift Double.greatestFiniteMagnitude와 동일, Infinity 아님)
- 리소스 파일명(로더 측): region_codes.json / sigungu.geojson / sigungu_display.geojson / sido_display.geojson
- ground-truth(테스트용): 총 272 엔트리 = 255 sigungu + 17 sido, 신안군 46910=191 polygons, 옹진군 28720=77, 울릉군 47940=5, 종로구 11110=1
- 디코드 성능 임계값=2.0초 (perf 테스트)

## 포팅할 테스트 (testsToPort)

### geoDataStore: initDoesNotThrow
실제 픽스처(region_codes.json + sigungu.geojson)를 JSON.parse 후 new GeoDataStore(...)가 throw하지 않음

### geoDataStore: entryCounts
entries.length === 272; level==='sigungu' 필터 === 255개; level==='sido' 필터 === 17개

### geoDataStore: sigunguPolygonCount
sigungu 엔트리 255개 전부에 대해 store.polygon(entry.regionCode) !== undefined → 디코드된 폴리곤 수 === 255

### geoDataStore: regionCodeEntryFields
regionCode '11110'(종로구) 엔트리: level==='sigungu', nameKo==='종로구', sidoCode==='11', bbox.length===4, bbox[0]<bbox[2] (minLon<maxLon), bbox[1]<bbox[3] (minLat<maxLat)

### geoDataStore: shinanMultiPolygonCount
polygon('46910').polygons.length === 191 (신안군 다도서, 실측 ground-truth)

### geoDataStore: ongjinMultiPolygonCount
polygon('28720').polygons.length === 77 (옹진군)

### geoDataStore: ulleungMultiPolygonCount
polygon('47940').polygons.length === 5 (울릉군)

### geoDataStore: singlePolygonNormalizedToOne
종로구 '11110': GeoJSON 'Polygon' 타입이 MultiPolygon으로 정규화 → polygons.length===1, polygons[0].outer.length >= 3

### geoDataStore: coordinateOrdering
'11110' 첫 outer 좌표: 37.0<=lat<=38.0 && 126.0<=lon<=128.0 — [lon,lat]→{lat,lon} 뒤집힘 회귀 방어

### geoDataStore: unknownRegionReturnsUndefined
polygon('00000')===undefined; polygon('11')===undefined (시도 코드는 시군구 폴리곤 맵에 없음)

### geoDataStore: decodePerformanceUnder2Seconds
파싱+생성+polygon('46910') 접근까지 elapsed < 2.0초 (performance.now() 사용, 테스트 코드에서만 시간 측정 허용). 11MB 파일이라 CI에서 느리면 임계값 유지하되 skip 가능 표시

### displayGeoStore: decodesAllSigungu
sigungu_display.geojson 픽스처로 생성 시 polygons.size === 255

### displayGeoStore: knownRegionPolygonsPresentAndNonEmpty
'11140'(서울 중구)·'26170'(부산 동구) 존재; '11140'의 polygons[0].outer가 비어있지 않음

### displayGeoStore: bboxInKoreaRange
bbox.minLon>124 && bbox.maxLon<132.5; bbox.minLat>33 && bbox.maxLat<39; minLat<maxLat && minLon<maxLon

### displayGeoStore: dokdoAndArchipelagoPreserved
bbox.maxLon > 131.8 (독도 보존, 130.9대로 잘리면 실패); polygons.get('47940').polygons.length >= 3; polygons.get('46900').polygons.length > 20; polygons.get('28720').polygons.length > 20. 주의: display 데이터의 신안군 키는 46900 (매칭 geojson의 46910과 다름 — 원본 그대로 보존)

### displayGeoStore: sidoLevelDecodes17
sido_display.geojson + level='sido'로 생성: polygons.size===17; '11'(서울)·'26'(부산) 존재; bbox.maxLon > 131.8 (시도층도 독도 보존)

### regionNames: decodesDisambiguatedSigunguNames
실제 region_codes.json으로 생성: names.size>0; names.get('26470')==='부산 연제구'; names.get('11140')==='서울 중구'; names.get('11680')==='서울 강남구'

### regionNames: sidoEntryKeepsFullName
names.get('26')==='부산광역시' (시도는 약칭 아닌 nameKo 그대로)

### regionNames: shortenStripsAdministrativeSuffix
shorten('서울특별시')==='서울'; shorten('부산광역시')==='부산'; shorten('경기도')==='경기'; shorten('강원특별자치도')==='강원'; shorten('세종특별자치시')==='세종'; shorten('제주특별자치도')==='제주' (마지막 두 케이스가 접미사 순서 보존 검증 — '도'/'시'가 먼저 매칭되면 실패)

## 포팅 함정 (notes)

[IO 경계] Swift init은 Bundle.module에서 직접 읽음 → TS는 파싱된 JSON을 생성자 인자로 받는다. GeoDataStoreError.resourceNotFound(파일 못 찾음)는 코어에서 제거하고 로더(fetch) 레이어 책임으로 이동 — 코어에는 대응 에러 타입 불필요. 단 geojsonDecode가 구조 오류 시 throw하면 그대로 전파. [shorten 순서] 접미사 배열 순서가 로직: "특별자치도"가 "도"보다 먼저 검사돼야 "강원특별자치도"→"강원"이 된다(역순이면 "강원특별자치"). 접미사는 전부 BMP 한글이라 Swift Character 수 == JS UTF-16 length — endsWith + slice(0, len-suffix.length)로 안전. [first-wins] RegionNames의 shortSido는 Dictionary(uniquingKeysWith: {first,_ in first}) — TS에서 `if (!map.has(k)) map.set(k, v)`로 first-wins 보존. names 빌드는 entries 배열 순서대로 순회하며 중복 regionCode는 나중 값이 덮어씀(Swift dict 대입과 동일) — Map.set 그대로. sigungu인데 sidoCode가 shortSido에 없으면 else로 떨어져 bare nameKo — 이 폴백도 보존. [옵셔널] polygon(for:)의 nil → Map.get의 undefined. 사전은 Map<string,MultiPolygon> 권장(키가 데이터 유래라 plain object의 프로토타입 키 충돌 회피) — geojsonDecode 모듈이 Record를 반환하기로 했다면 그쪽 계약에 맞춰 통일하되 'first.bbox' 같은 의미 변화 없음(소비는 get/lookup뿐). [computeBBox] 초기값은 ±Number.MAX_VALUE(= Swift Double.greatestFiniteMagnitude). Infinity로 바꾸지 말 것(byte-faithful). min/max 누적이라 Map 순회 순서 무관. holes는 outer 내부이므로 outer만 스캔 — "최적화 추가" 금지. 빈 polygons 입력 시 Swift처럼 뒤집힌 bbox(MAX/-MAX) 반환 — 가드 추가하지 말 것. [Level→파일 결합 해제] Swift는 level이 리소스 파일과 codeKey를 함께 선택했지만 TS는 codeKey만 선택("sigungu"→"sgg", "sido"→"sido"). level과 geojson 파일 불일치 방지는 로더 책임 — 로더 헬퍼에서 (파일, level) 쌍을 고정해 노출 권장. [Date 금지] 이 모듈 코어에는 시간 로직 없음. perf 테스트의 경과 측정만 performance.now() 사용(테스트 한정 허용). [테스트 픽스처] ground-truth 수치(272/255/17, 191/77/5 등)는 실제 데이터 파일에 의존 — baljachwi/BaljachwiCore/Sources/BaljachwiCore/Resources/의 region_codes.json(35KB)·sigungu.geojson(11.9MB)·sigungu_display.geojson(3.2MB)·sido_display.geojson(1.6MB)을 웹 레포 테스트 픽스처로 복사 필요. 신안군 키가 매칭=46910, display=46900으로 다른 것은 데이터 차이이며 원본 테스트 그대로 보존. [무관 규칙] dataActorReconcile 제외 규칙(reconcile/upsert/prune/visited-wins/단일행 home만 포팅, merge/split/title/delete 제외)은 이 모듈과 의존 관계 없음 — 해당 없음.