'use client';

// src/hooks/useScan.ts — 가져오기 오케스트레이션.
// File[] → exif 추출(메인, 진행률) → worker(필터·매칭·여행분할) → repo.reconcileScan(Dexie)
// → 썸네일 생성·저장. worker는 훅 내부에서 lazy 생성(모듈 스코프 금지 = SSR 가드).

import { useCallback, useEffect, useRef, useState } from 'react';
import { fileToRawAsset } from '@/lib/exif';
import { makeThumbnail } from '@/lib/thumbnail';
import { repo } from '@/data/repo';
import type { RawPhotoAsset } from '@/core/photoScan';
import type { ScanRequest, ScanResponse } from '@/worker/protocol';

export type ScanPhase = 'idle' | 'reading-exif' | 'scanning' | 'saving' | 'done' | 'error';

export interface ScanState {
  phase: ScanPhase;
  /** 0~1 진행률(현재 단계 기준). */
  progress: number;
  /** 사람 읽을 라벨. */
  label: string;
  error: string | null;
}

const INITIAL: ScanState = { phase: 'idle', progress: 0, label: '', error: null };

/** 현지 기준 device 오프셋(초, UTC 동쪽 양수). UI 경계라 Date 허용. */
function deviceOffsetSeconds(): number {
  return new Date().getTimezoneOffset() * -60;
}

export function useScan() {
  const [state, setState] = useState<ScanState>(INITIAL);
  const workerRef = useRef<Worker | null>(null);
  // 동시 가져오기 가드 — 드롭존은 busy와 무관하게 호출될 수 있어 훅 레벨에서 막는다.
  // (worker 메시지 리스너가 교차 수신되어 진행률·결과가 뒤섞이는 것을 방지.)
  const runningRef = useRef(false);

  // 언마운트 시 worker 정리.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const getWorker = useCallback((): Worker => {
    if (workerRef.current === null) {
      workerRef.current = new Worker(new URL('../worker/scan.worker.ts', import.meta.url), {
        type: 'module',
      });
    }
    return workerRef.current;
  }, []);

  const importFiles = useCallback(
    async (files: File[]): Promise<void> => {
      if (files.length === 0) return;
      if (runningRef.current) return; // 진행 중이면 무시(중복 호출 가드)
      runningRef.current = true;
      try {
      const offset = deviceOffsetSeconds();
      setState({ phase: 'reading-exif', progress: 0, label: 'EXIF 읽는 중…', error: null });

      // 1) 메인에서 EXIF 추출(파일당 진행률).
      const assets: RawPhotoAsset[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          assets.push(await fileToRawAsset(files[i], offset));
        } catch {
          // 개별 파일 실패는 건너뜀(전체 중단 금지).
        }
        setState({
          phase: 'reading-exif',
          progress: (i + 1) / files.length,
          label: `EXIF 읽는 중… ${i + 1}/${files.length}`,
          error: null,
        });
      }

      // 2) worker: 필터·매칭·여행분할.
      const worker = getWorker();
      const result = await new Promise<ScanResponse>((resolve) => {
        const onMessage = (e: MessageEvent<ScanResponse>) => {
          const msg = e.data;
          if (msg.type === 'progress') {
            const ratio = msg.total > 0 ? msg.done / msg.total : 0;
            const label =
              msg.stage === 'loading-geo'
                ? '지도 데이터 로드 중…'
                : msg.stage === 'matching'
                  ? `지역 매칭 중… ${msg.done}/${msg.total}`
                  : '여행 분할 중…';
            setState({ phase: 'scanning', progress: ratio, label, error: null });
            return;
          }
          worker.removeEventListener('message', onMessage);
          resolve(msg);
        };
        worker.addEventListener('message', onMessage);
        const req: ScanRequest = {
          type: 'scan',
          photos: assets,
          deviceOffsetSeconds: offset,
          excludedTripSampleIDs: [],
        };
        worker.postMessage(req);
      });

      if (result.type === 'error') {
        setState({ phase: 'error', progress: 0, label: '', error: result.message });
        return;
      }
      if (result.type !== 'done') return;

      // 3) Dexie 반영(단일 writer).
      setState({ phase: 'saving', progress: 0, label: '저장 중…', error: null });
      const r = repo();
      await r.reconcileScan(result.result);

      // 4) 썸네일 생성·저장(실패해도 본 데이터 무관). localIdentifier↔File 매핑.
      const byId = new Map<string, File>();
      for (const f of files) {
        const { fileLocalIdentifier } = await import('@/lib/exif');
        byId.set(fileLocalIdentifier(f), f);
      }
      let saved = 0;
      const targets = result.result.photos;
      for (let i = 0; i < targets.length; i++) {
        const f = byId.get(targets[i].localIdentifier);
        if (f) {
          const thumb = await makeThumbnail(f);
          if (thumb) await r.saveThumb(targets[i].localIdentifier, thumb);
        }
        saved++;
        setState({
          phase: 'saving',
          progress: targets.length > 0 ? saved / targets.length : 1,
          label: '썸네일 저장 중…',
          error: null,
        });
      }

      setState({ phase: 'done', progress: 1, label: '완료', error: null });
      } finally {
        runningRef.current = false;
      }
    },
    [getWorker],
  );

  const reset = useCallback(() => setState(INITIAL), []);

  return { state, importFiles, reset };
}
