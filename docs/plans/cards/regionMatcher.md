# 모듈 카드: regionMatcher

**TS 타겟:** src/core/regionMatcher.ts

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
```ts
// src/core/regionMatcher.ts
import type { Coordinate, MultiPolygon } from "./geoTypes";
import { pointInPolygon } from "./pointInPolygon";
import type { GeoDataStore, RegionCodeEntry } from "./geoStores";
// 가정하는 geoStores 계약: GeoDataStore { entries: readonly RegionCodeEntry[]; polygonFor(regionCode: string): MultiPolygon | undefined }
// RegionCodeEntry { regionCode: string; level: string /* "sido" | "sigungu" */; nameKo: string; sidoCode: string; bbox: number[] /* [minLon, minLat, maxLon, maxLat] */ }

/**
 * 좌표 → MOIS SIG_CD(regionCode) 매칭. 순수·결정적.
 * 결정 규칙(순서):
 *  1. 한국 bbox 프리필터 — lat∈[33.0,38.9] AND lon∈[124.6,132.0] 아니면 null (양끝 포함).
 *  2. sigungu 엔트리 중 entry.bbox가 점을 포함하는 것만 후보 (b[0]<=lon<=b[2] && b[1]<=lat<=b[3], 양끝 포함).
 *  3. pointInPolygon SSOT 재사용으로 히트테스트.
 *  4-a. 포함 후보 >=1 → regionCode 사전순(ASCII) 최소 반환.
 *  4-b. 포함 0 → bbox 후보들의 폴리곤 경계 최단거리(m) 계산, <=100m면 최근접(동률 시 regionCode 최소), 아니면 null.
 *  5. 후보 없으면 null.
 */
export class RegionMatcher {
  // sigunguEntries는 생성자에서 한 번만 filter(level === "sigungu") — 시도 코드가 후보에 섞여
  // polygonFor가 undefined를 돌려주는 것을 막는 불변식.
  constructor(store: GeoDataStore);
  regionCode(coordinate: Coordinate): string | null;

  // ---- private (export 안 함, 시그니처만 명시) ----
  // private distanceToBoundary(point: Coordinate, multiPolygon: MultiPolygon): number;
  //   — 모든 폴리곤의 outer + holes 링 변까지 최단거리(m). 초기값 Number.MAX_VALUE.
  // private distanceToRing(point: Coordinate, ring: Coordinate[]): number;
  //   — n < 2면 Number.MAX_VALUE. i=0..n-1에 대해 segment(ring[i], ring[(i+1) % n]).
  // private distancePointToSegment(p: Coordinate, a: Coordinate, b: Coordinate): number;
  //   — 등거리 근사 평면(질의점 위도 cos 보정), 미터 단위. 본문 10줄급이므로 포팅 시 그대로:
  //   const r = 6_371_000.0; const degToRad = Math.PI / 180.0;
  //   const kx = Math.cos(p.lat * degToRad) * degToRad * r; const ky = degToRad * r;
  //   px=p.lon*kx, py=p.lat*ky (a, b 동일 변환) → 선분 투영 t = clamp(0,1, dot/l2), l2===0이면 t=0
  //   → Math.sqrt((px-cx)**2 + (py-cy)**2)
}
```
```

## 보존 상수 (constants)

- minLat=33.0
- maxLat=38.9
- minLon=124.6
- maxLon=132.0
- boundaryAbsorbMeters=100.0
- earthRadiusMeters=6371000.0 (distancePointToSegment 내부 r)
- degToRad=Math.PI/180.0
- distInit=Number.MAX_VALUE (Swift Double.greatestFiniteMagnitude — Infinity 아님)

## 포팅할 테스트 (testsToPort)

### seoulCityHall
regionCode({lat:37.5663, lon:126.9779}) === "11140" (서울 중구)

### gwanghwamun
regionCode({lat:37.5759, lon:126.9769}) === "11110" (종로구)

### busanStation
regionCode({lat:35.1151, lon:129.0413}) === "26170" (부산 동구)

### jejuAirport
regionCode({lat:33.5070, lon:126.4927}) === "50110" (제주시)

### baengnyeongdoMultiIsland
regionCode({lat:37.9660, lon:124.7050}) === "28720" (옹진군 — MultiPolygon 다도서 매칭 검증)

### gunwi
regionCode({lat:36.2428, lon:128.5728}) === "27720" (군위군)

### parisReturnsNil
regionCode({lat:48.8566, lon:2.3522}) === null (한국 bbox 밖)

### originReturnsNil
regionCode({lat:0, lon:0}) === null ((0,0) 프리필터 배제)

### outsideKoreaBboxReturnsNil
regionCode({lat:40.0, lon:128.0}) === null (lat 40.0 > maxLat 38.9)

### sanityBridgeSeoulJunggu
code = regionCode({lat:37.5663, lon:126.9779}); code === "11140" AND store.entries에서 regionCode===code인 엔트리의 nameKo === "중구"

### sanityBridgeBusanDonggu
code = regionCode({lat:35.1151, lon:129.0413}); 해당 엔트리 nameKo가 "동구"를 포함(includes)

### boundaryAbsorptionNearUlleung
regionCode({lat:37.532649, lon:130.908069}) === "47940" — 울릉도 해안에서 약 33m 떨어진 바다 위 점(어떤 폴리곤에도 미포함), 경계거리 <=100m 흡수 경로(4-b) 검증. 유일 후보·단일 최근접으로 사전 검증된 좌표

## 포팅 함정 (notes)

[옵셔널] Swift String? → string | null. store.polygon(for:)! force-unwrap은 "후보=sigungu 엔트리"라는 생성자 불변식으로 안전 — TS에서는 polygonFor 결과가 undefined면 명시적 throw(또는 non-null 단언)로 Swift crash 의미를 보존하되, 정상 데이터에서는 도달 불가. [경계 포함] bbox 프리필터·후보 축소 모두 양끝 포함(>=, <=) — Swift ClosedRange와 동일하게. [min() 의미] contained.min()은 Swift String < (유니코드 스칼라) 비교지만 regionCode는 ASCII 숫자 5자리이므로 JS의 `<` 사전순 비교와 완전 동일. localeCompare 금지, 단순 루프나 reduce로 `a < b` 비교. [타이브레이크] 4-b의 갱신 조건은 strict-less OR (d === bestDist && (bestCode === null || code < bestCode)) — float 완전 동등 비교 그대로 보존, 순회 순서에 의존하지 않음. 정렬을 하지 않으므로 정렬 안정성 이슈 없음. [MAX_VALUE] Double.greatestFiniteMagnitude → Number.MAX_VALUE (Infinity로 바꾸지 말 것; bestDist<=100 판정 결과는 같지만 byte-faithful 원칙). [링 닫기] distanceToRing은 ring[(i+1) % n]으로 마지막→첫 점 변을 항상 포함 — 이미 닫힌 링이면 길이 0 변이 생기고 l2===0 → t=0 분기가 흡수. 제거하지 말 것. [평면 근사] distancePointToSegment는 질의점 p의 위도에서만 cos 보정(kx)을 한 번 계산해 a, b에도 동일 적용 — 점별 cos으로 "개선"하면 골든값(특히 울릉 33m 케이스)이 깨질 수 있음. Math.cos 인자는 라디안(p.lat * degToRad). .squareRoot() → Math.sqrt. [시간/IO] 이 모듈은 Date/시간 사용 없음. GeoDataStore가 Bundle IO를 담당했으나 TS에서는 geoStores가 파싱된 region_codes JSON + geojsonDecode 결과를 생성자 인자로 받는 형태로 경계 분리 — RegionMatcher 자체는 store 인스턴스만 받는 순수 모듈. [테스트 픽스처] 12개 테스트 전부 실데이터 골든셋: region_codes.json(272 엔트리, bbox=[minLon,minLat,maxLon,maxLat]) + sigungu.geojson(255개 시군구 MultiPolygon, GeoJSON [lon,lat] → Coordinate{lat,lon} 변환·Polygon은 폴리곤 1개짜리 MultiPolygon으로 정규화). 테스트에서 fs로 두 픽스처를 읽어 geojsonDecode + geoStores 생성자로 store를 만든 뒤 RegionMatcher 구성. 합성 미니 픽스처로 대체하지 말 것(경계 흡수 33m 케이스는 실제 울릉도 해안선에 의존).