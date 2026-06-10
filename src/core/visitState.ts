// 지역 방문 상태 — Swift BaljachwiCore/VisitState.swift 의 byte-faithful 포트.
// VisitState/RegionLevel 의 단일 정의 지점 — models.ts·regionAggregate.ts 는 여기서 import.

/** 지역 방문 상태. Swift: enum String RawValue — JSON 영속 문자열과 1:1.
 *  TS enum이 아닌 문자열 리터럴 유니언 — regionAggregate.rank()가 이 정확한 문자열에 의존. */
export type VisitState = 'visited' | 'wantToGo' | 'notVisited';

/** Swift CaseIterable.allCases — 선언 순서 보존: visited, wantToGo, notVisited. */
export const VISIT_STATE_ALL_CASES: readonly VisitState[] = ['visited', 'wantToGo', 'notVisited'];

/** Swift VisitState(rawValue:) 실패 가능 이니셜라이저 대응. 미지 문자열은 undefined (throw 금지). */
export function parseVisitState(raw: string): VisitState | undefined {
  return (VISIT_STATE_ALL_CASES as readonly string[]).includes(raw)
    ? (raw as VisitState)
    : undefined;
}
