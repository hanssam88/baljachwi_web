'use client';

// src/hooks/useLive.ts — Dexie liveQuery ↔ React 구독.
// dexie-react-hooks 의 useLiveQuery 를 얇게 재노출. SSR 프리렌더에서 IndexedDB 부재 시
// 초기값(undefined)을 반환하고 마운트 후 클라이언트에서 실제 값으로 채워진다.

import { useLiveQuery } from 'dexie-react-hooks';

/**
 * liveQuery 팩토리를 구독해 최신 값을 반환. 첫 렌더(또는 SSR)에서는 undefined.
 * @param querier IndexedDB 를 읽는 비동기 함수(=queries.ts 의 내부 쿼리)
 * @param deps    의존성(쿼리 인자 변경 시 재구독)
 */
export function useLive<T>(querier: () => Promise<T>, deps: unknown[] = []): T | undefined {
  return useLiveQuery(querier, deps);
}
