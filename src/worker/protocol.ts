// src/worker/protocol.ts — scan.worker ↔ 메인 메시지 계약(구조화 복제 가능 plain object).

import type { RawPhotoAsset } from '@/core/photoScan';
import type { PipelineResult } from '@/core/scanPipeline';

/** 메인 → worker: 스캔 요청. */
export interface ScanRequest {
  type: 'scan';
  /** exifr 추출 결과(메인). worker가 필터·매칭·여행분할 수행. */
  photos: RawPhotoAsset[];
  /** OffsetTimeOriginal 부재 시 폴백 오프셋(초). */
  deviceOffsetSeconds: number;
  /** 핀된 사진 id — 여행 분할에서만 제외(프로토는 빈 배열). */
  excludedTripSampleIDs: string[];
}

export type ScanStage = 'loading-geo' | 'matching' | 'segmenting';

/** worker → 메인: 진행률. */
export interface ScanProgress {
  type: 'progress';
  stage: ScanStage;
  done: number;
  total: number;
}

/** worker → 메인: 완료(결과). */
export interface ScanDone {
  type: 'done';
  result: PipelineResult;
}

/** worker → 메인: 에러. */
export interface ScanError {
  type: 'error';
  message: string;
}

export type ScanResponse = ScanProgress | ScanDone | ScanError;
