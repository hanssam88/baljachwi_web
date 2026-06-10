// src/core/photoScan.ts — PhotoScanService.swift 의 필터·dedup·청크 진행보고 규칙 포트.
// (PhotoKit 추상화 부분은 버림: "파싱된 asset 배열을 인자로 받는" 순수 함수 경계)
//
// byte-faithful 포트 주의:
//  - 시간은 epoch 초(number) 정수 산술만. JS Date 객체/타임존 메서드 금지.
//  - 좌표 null 검사는 `=== null` (falsy 검사 금지 — lat=0 은 유효값).
//  - 필터 순서: (1) lat/lon null → (2) (0,0) AND → (3) takenAt null → (4) dedup.
//  - dedup 은 마지막 단계: 필터 탈락한 첫 등장은 dedup 슬롯을 소비하지 않음.

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

/** 청크 step 최소값 — step = max(1, chunkSize) 로 0/음수 보정(무한 루프/0분할 방지). */
export const MIN_CHUNK_STEP = 1;

export type ProgressCallback = (processed: number, total: number) => void;

/**
 * 전체 스캔: 필터(geotag null / (0,0) AND / takenAt null 스킵) → dedup(같은 id 첫 등장만)
 * → chunkSize 단위 progress(processed, total) 호출. 입력 순서 보존. 순수·결정적.
 * chunkSize < 1 은 1 로 보정. 빈 입력이면 progress 는 한 번도 호출되지 않음.
 */
export function scanPhotos(
  assets: readonly RawPhotoAsset[],
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  progress: ProgressCallback = () => {}
): ScanOutput {
  const total = assets.length;

  // 필터 *전* 전체 id 캡처(단일 패스) — 삭제 감지 소스(GPS/날짜 없는 자산도 라이브러리엔 실재).
  const rawAssetIDs = new Set<string>();
  for (const asset of assets) {
    rawAssetIDs.add(asset.localIdentifier);
  }

  const result: ScannedPhoto[] = [];
  const seen = new Set<string>();

  // chunkSize가 1 미만이면 1로 보정(0/음수 청크는 무한 루프/0분할 위험).
  // Swift Int 파라미터 대응: 비정수 방어를 위해 Math.floor 후 max (테스트는 정수만 사용).
  const step = Math.max(MIN_CHUNK_STEP, Math.floor(chunkSize));
  let index = 0;

  while (index < total) {
    const end = Math.min(index + step, total);
    for (let i = index; i < end; i++) {
      const asset = assets[i];
      // 필터: 지오태그 없음. null 검사(0 은 유효값이므로 falsy 검사 금지).
      const lat = asset.latitude;
      const lon = asset.longitude;
      if (lat === null || lon === null) continue;
      // 필터: (0,0) 좌표(둘 다 절대값 극소). (0,50) 같은 한쪽만 0은 통과 (AND).
      if (Math.abs(lat) < ORIGIN_EPSILON && Math.abs(lon) < ORIGIN_EPSILON) continue;
      // 필터: 촬영시각 없음.
      const takenAt = asset.takenAtEpoch;
      if (takenAt === null) continue;
      // dedup: 같은 id는 첫 등장만 유지.
      const id = asset.localIdentifier;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push({ localIdentifier: id, lat, lon, takenAt });
    }
    // 청크 경계 진행보고: processed는 순회한 raw 개수(total 캡). 마지막 경계 == total.
    progress(end, total);
    index = end;
  }

  return { photos: result, rawAssetIDs };
}
