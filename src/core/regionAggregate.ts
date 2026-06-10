// src/core/regionAggregate.ts
// 시군구 방문 상태 → 시도 집계(순수·결정적). 시도 토글 choropleth용.
// Swift BaljachwiCore/RegionAggregate.swift 의 byte-faithful 포트.
//
// 전역 규칙: VisitState 는 core 의 단일 정의 지점(core/visitState)에서 직접 import
// (카드 exportsTs 는 ./models 로 적었으나, models 는 re-export 일 뿐이라 동일 타입).
import type { VisitState } from './visitState'; // 'visited' | 'wantToGo' | 'notVisited'

/**
 * 시군구 상태 맵 → 시도 상태 맵 (순수·결정적).
 * 코드 앞 2자리로 그룹, 우선순위 visited > wantToGo > notVisited.
 * 입력에 없는 시도는 출력에도 없음 — 렌더 측이 `?? 'notVisited'` 기본색 처리 (vanish 아님).
 * 키 길이 < 2 인 항목은 무시.
 *
 * Swift: 알고리즘이 엄격 부등호(>) 기반 max-fold이고 rank 가 3개 상태에 단사라
 * Dictionary 순회 순서·Object.entries 삽입 순서와 무관하게 결정적.
 */
export function sidoStates(sigungu: Record<string, VisitState>): Record<string, VisitState> {
  const out: Record<string, VisitState> = {};
  for (const [code, state] of Object.entries(sigungu)) {
    if (code.length < 2) continue; // Swift `where code.count >= 2` 가드 (지역코드는 ASCII 숫자 5자리)
    const sido = code.slice(0, 2); // Swift String(code.prefix(2)) — ASCII라 slice === prefix
    if (rank(state) > rank(out[sido] ?? 'notVisited')) out[sido] = state;
  }
  return out;
}

// 내부 전용 (export 안 함): 집계 우선순위 등급(높을수록 우선).
function rank(s: VisitState): number {
  switch (s) {
    case 'visited':
      return 2;
    case 'wantToGo':
      return 1;
    case 'notVisited':
      return 0;
  }
}
