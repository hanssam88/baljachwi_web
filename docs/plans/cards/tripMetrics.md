# 모듈 카드: tripMetrics

**TS 타겟:** src/core/tripMetrics.ts

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
```ts
// src/core/tripMetrics.ts
import type { BBox } from './geoTypes';

/**
 * 메트릭 산출 입력 1건 (Swift TripMetrics.Input).
 * @Model(PhotoRef) 비전달 — 호출부가 값만 추출해 전달.
 */
export interface TripMetricsInput {
  lat: number;
  lon: number;
  /** epoch 초 (Swift Date(timeIntervalSince1970:) 대응 — JS Date 객체 금지) */
  takenAt: number;
  regionCode: string | null;
}

/** 산출된 여행 메트릭 (Swift TripMetrics.Metrics). */
export interface TripMetricsResult {
  /** epoch 초, min(takenAt) */
  startAt: number;
  /** epoch 초, max(takenAt) */
  endAt: number;
  bbox: BBox; // { minLat, minLon, maxLat, maxLon }
  representativeRegionCode: string | null;
}

/**
 * 최빈 regionCode. 동률은 regionCode 오름차순(가장 작은 코드) — **canonical tie-break**.
 * ScanPipeline·TripSegmenter(병합 재계산)가 이 함수에 위임한다 (drift 방지).
 * 빈 입력이면 null. (호출부가 null 제외를 이미 수행한 string[]을 전달)
 */
export function representativeRegionCode(codes: string[]): string | null;

/**
 * 사진 집합 → 메트릭. 빈 입력이면 null (호출부 가드 후 사용 계약).
 * 입력 순서 무관 (min/max·최빈). regionCode가 null인 항목은 대표코드 집계에서만 제외.
 */
export function computeTripMetrics(photos: TripMetricsInput[]): TripMetricsResult | null;
```
```

## 보존 상수 (constants)


## 포팅할 테스트 (testsToPort)

### computeEmptyReturnsNil
computeTripMetrics([]) === null

### computeMetricsFromPhotos
입력 3건(시간 역순·좌표 뒤섞음): (lat 37.4, lon 127.1, t=100, region '11140'), (37.6, 126.9, t=300, region null), (37.5, 127.0, t=200, '11140'). 기대: bbox={minLat:37.4, minLon:126.9, maxLat:37.6, maxLon:127.1}, startAt=100, endAt=300, representativeRegionCode='11140' (null 제외 후 최빈)

### computeAllNilRegionGivesNilRep
입력 2건: (35.1, 129.0, t=10, null), (35.2, 129.1, t=20, null). 기대: representativeRegionCode === null, startAt=10, endAt=20 (bbox/시간은 정상 산출)

### representativeTieBreakSmallestCode
representativeRegionCode(['11140','11140','11110','11110']) === '11110' — 2:2 동률 시 코드 오름차순 최소. ScanPipeline 시나리오6과 동일 진실이어야 함

### representativeMostFrequentWins
representativeRegionCode(['26170','26170','11110']) === '26170' — 빈도 우선

### representativeEmptyReturnsNil
representativeRegionCode([]) === null

## 포팅 함정 (notes)

함정: (1) tie-break 구현 — Swift는 Dictionary.max(by:)에 비교 반전 트릭(`lhs.key > rhs.key`)을 써서 "빈도 내림차순, 동률은 키 오름차순 최소"를 얻는다. Swift Dictionary 순회 순서는 비결정적이지만 (value,key)에 전순서가 걸려 있어 결과는 결정적. TS에서는 트릭을 복제하지 말고 reduce로 직접 구현: `(count > best.count) || (count === best.count && code < best.code)`일 때 교체. 문자열 비교는 `<`/`>` 연산자(UTF-16 코드유닛) 사용 — localeCompare 금지 (지역코드는 ASCII 숫자라 Swift 유니코드 스칼라 비교와 동일 결과). (2) counts는 Map<string,number> 권장 — plain object는 '__proto__' 등 프로토타입 키 오염 가능. (3) 옵셔널 — regionCode는 string|null로 고정, compactMap은 `.filter((c): c is string => c !== null)`. compute에서 전부 null이어도 metrics 자체는 반환하고 rep만 null (rep null ≠ compute null). (4) Date 금지 — takenAt은 epoch 초 number로 받음. Swift force-unwrap(min()!/max()!)은 빈 배열 가드 후라 안전 → TS도 length 체크 후 reduce/Math.min·max. (5) 정수 나눗셈·정렬 안정성 이슈 없음(정렬 자체가 없음). 빈도 카운트는 정수, lat/lon min/max는 비교만 하므로 부동소수점 오차 없음. (6) 이 모듈은 tripSegmenter·scanPipeline이 위임 호출하는 canonical 진실이므로, 그쪽 포팅 시 로직 복제 금지하고 반드시 import 하게 할 것. (7) dataActorReconcile 관련 추림 지침은 본 모듈(tripMetrics)에는 해당 없음.