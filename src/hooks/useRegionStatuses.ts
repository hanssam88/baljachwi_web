'use client';

// src/hooks/useRegionStatuses.ts — 시군구 RegionStatus liveQuery → code→state 맵.
// 시도 레벨 상태는 regionAggregate.sidoStates로 파생.

import { useLive } from '@/hooks/useLive';
import { getDB } from '@/data/db';
import { sidoStates } from '@/core/regionAggregate';
import type { VisitState } from '@/core/visitState';

export interface RegionStateMaps {
  sigungu: Record<string, VisitState>;
  sido: Record<string, VisitState>;
  loaded: boolean;
}

export function useRegionStatuses(): RegionStateMaps {
  const rows = useLive(
    () => getDB().regionStatuses.where('level').equals('sigungu').toArray(),
    [],
  );

  if (rows === undefined) {
    return { sigungu: {}, sido: {}, loaded: false };
  }

  const sigungu: Record<string, VisitState> = {};
  for (const r of rows) {
    // 같은 코드 중복 시 first-wins(이론상 PK 유일하나 방어).
    if (!(r.regionCode in sigungu)) sigungu[r.regionCode] = r.state;
  }
  return { sigungu, sido: sidoStates(sigungu), loaded: true };
}
