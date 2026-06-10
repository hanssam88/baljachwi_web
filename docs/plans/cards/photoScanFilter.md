# 모듈 카드: photoScanFilter

**TS 타겟:** src/lib/exif.ts (필터 규칙만)

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
// src/lib/exif.ts — PhotoScanService.swift 의 필터·dedup·청크 진행보고 규칙 포트
// (PhotoKit 추상화 부분은 버림: "파싱된 asset 배열을 인자로 받는" 순수 함수 경계)

/** 필터 전 raw 사진 메타데이터 (Swift PhotoAsset 프로토콜 대응). 값 없음 = null. */
export interface RawPhotoAsset {
  /** 라이브러리 내 고유 식별자. dedup 키. */
  localIdentifier: string;
  /** 위도. 지오태그 없으면 null. */
  latitude: number | null;
  /** 경도. 지오태그 없으면 null. */
  longitude: number | null;
  /** 촬영 시각 — epoch 초(number). 없으면 null. JS Date 객체 금지. */
  takenAtEpoch: number | null;
}

/** 필터·dedup 통과 결과 1건. 좌표/시각 non-null 보장 후 값. (Swift ScannedPhoto) */
export interface ScannedPhoto {
  localIdentifier: string;
  lat: number;
  lon: number;
  /** epoch 초 */
  takenAt: number;
}

/** 스캔 산출물. rawAssetIDs 는 **필터 전 전체** id 집합(삭제 감지용 — dataActorReconcile 의 pruneMissingPins 가 소비). */
export interface ScanOutput {
  photos: ScannedPhoto[];
  rawAssetIDs: Set<string>;
}

/** (0,0) 좌표 판정 임계값: |lat| < ORIGIN_EPSILON && |lon| < ORIGIN_EPSILON 일 때만 스킵 (AND). */
export const ORIGIN_EPSILON = 1e-7;

/** 기본 청크 크기. */
export const DEFAULT_CHUNK_SIZE = 1000;

export type ProgressCallback = (processed: number, total: number) => void;

/**
 * 전체 스캔: 필터(geotag null / (0,0) AND / takenAt null 스킵) → dedup(같은 id 첫 등장만)
 * → chunkSize 단위 progress(processed, total) 호출. 입력 순서 보존. 순수·결정적.
 * chunkSize < 1 은 1 로 보정. 빈 입력이면 progress 는 한 번도 호출되지 않음.
 */
export function scanPhotos(
  assets: readonly RawPhotoAsset[],
  chunkSize?: number,          // default DEFAULT_CHUNK_SIZE
  progress?: ProgressCallback  // default no-op
): ScanOutput;
```

## 보존 상수 (constants)

- ORIGIN_EPSILON=1e-7
- DEFAULT_CHUNK_SIZE=1000
- MIN_CHUNK_STEP=1 (step = max(1, chunkSize) 보정)

## 포팅할 테스트 (testsToPort)

### filtersNonGeotaggedAndOrigin
t0=1700000000 (epoch초). 입력 3건: gps(37.5, 127.0, t0), noloc(null, null, t0), origin(0, 0, t0) → photos 정확히 1건: {localIdentifier:'gps', lat:37.5, lon:127.0, takenAt:1700000000}

### rawAssetIDsIncludesPreFilterIDs
입력 4건: gps(37.5,127.0,t0), nogps(null,null,t0), nodate(37.5,127.0,null), origin(0,0,t0) → photos.map(id)==['gps'] (1건), rawAssetIDs == Set{'gps','nogps','nodate','origin'} (필터 탈락분 포함 4건). 삭제 감지 회귀 방지 핵심: photos 로 집합을 만들면 GPS가 나중에 제거된 핀 사진이 '삭제됨'으로 오판됨

### dedupKeepsFirstOccurrence
입력 2건 동일 id: dup(37.5,127.0,t0), dup(38.0,128.0,t0+60) → photos 1건, 값은 **첫 등장**: lat 37.5, lon 127.0, takenAt t0 (두 번째 38.0/128.0/t0+60 아님)

### skipsNilCreationDate
입력: nodate(37.5,127.0,takenAt=null), ok(36.0,128.0,t0) → photos.map(id)==['ok'] — 좌표 유효해도 takenAt null 이면 스킵

### originFilterIsAndNotOr
입력 3건 모두 t0: zerozero(0,0), zerolon(0,50), zerolat(50,0) → photos.map(id)==['zerolon','zerolat'] — (0,0)만 스킵, 한쪽만 0은 생존 (AND 조건)

### preservesInputOrder
입력 5건: p0..p4, lat=37.0+i, lon=127.0, takenAt=t0+i → photos.map(id)==['p0','p1','p2','p3','p4'] 입력 순서 그대로

### emptyLibraryReturnsEmpty
입력 [] → photos.length==0 (추가로: progress 콜백 0회 호출이어야 함 — while index<0 진입 안 함)

### chunkedProgressReporting
2500건 전부 유효(id='p'+i, 37.5, 127.0, takenAt=t0+i), chunkSize=1000 → progress 호출 3회, processed 순서 [1000, 2000, 2500], 모든 호출의 total==2500, 마지막 processed==total, photos.length==2500 순서 보존

### processedCountsRawAssetsEvenWhenFiltered
1500건, 짝수 i 는 geotag(37.5,127.0)·홀수 i 는 lat/lon null, 전부 takenAt=t0, chunkSize=1000 → processed 순서 [1000, 1500] (마지막 부분 청크는 total 캡), 마지막 total==1500. processed 는 필터/dedup 무관 raw 순회 수

## 포팅 함정 (notes)

[함정 1 — falsy 0 좌표] Swift `guard let lat = asset.latitude` 의 TS 대응은 반드시 `latitude === null` (또는 `== null`) 체크. `if (!lat)` 류 falsy 검사는 lat=0 (유효값, zerolon 테스트)을 잘못 스킵시킴. null 검사와 (0,0) origin 검사는 별개의 두 단계.
[함정 2 — 필터 순서와 dedup 위치] byte-faithful 순서: (1) lat/lon null → (2) |lat|<1e-7 && |lon|<1e-7 (strict <, AND) → (3) takenAt null → (4) dedup. dedup 이 마지막이므로 "필터 탈락한 첫 등장"은 dedup 슬롯을 소비하지 않음 — 같은 id 의 두 번째(유효) asset 이 통과할 수 있다. 순서 바꾸면 동작 달라짐.
[함정 3 — progress 시맨틱] processed = min(index+step, total) = 청크 끝 인덱스(raw 순회 수, 필터/dedup 무관). 빈 입력이면 progress 0회 (progress(0,0) 호출하지 않음). step = max(1, chunkSize) 로 0/음수 보정 (Swift Int 파라미터이므로 TS 에서 비정수 입력 방어가 필요하면 Math.floor 후 max — 단 테스트는 정수만 사용).
[함정 4 — Date 금지] Swift Date(timeIntervalSince1970:) → epoch 초 number 로 표현. t0=1_700_000_000, t0.addingTimeInterval(60) → 1700000060 등 순수 정수 산술. JS Date 객체/타임존 메서드 사용 금지.
[함정 5 — autoreleasepool] JS 에 대응 개념 없음 — 그냥 제거 (의미적 no-op). while+slice 대신 인덱스 루프로 청크 경계만 유지하면 됨 (assets.slice 로 복사 만들 필요 없음, index..<end 범위 순회).
[함정 6 — Set 비교] rawAssetIDs 테스트는 집합 동등성(멤버십)만 비교 — 순서 무관. JS Set 은 삽입순이지만 테스트에서 정렬 후 배열 비교 또는 멤버십 비교로 작성.
[경계 분리] PhotoLibrary/PhotoAsset 프로토콜은 포팅하지 않음 — scanPhotos 가 plain RawPhotoAsset[] 를 인자로 받는 순수 함수. ScannedPhoto/ScanOutput 은 plain interface.
[모듈 경계] 이 카드는 photoScanFilter(필터 규칙) 범위. rawAssetIDs 는 dataActorReconcile 의 pruneMissingPins 입력 계약이므로 ScanOutput 형태(photos + rawAssetIDs 분리)를 그대로 보존할 것. dataActorReconcile 포팅 시에는 reconcile/upsert/prune/visited-wins/단일행 home 로직·테스트만 추리고 merge/split/title/delete 는 제외.
[원본] C:/Users/sengmin.hyun/Downloads/baljachwi/BaljachwiCore/Sources/BaljachwiCore/PhotoScanService.swift (115줄), Tests/PhotoScanServiceTests.swift (172줄, 테스트 9개 전부 포팅 대상).