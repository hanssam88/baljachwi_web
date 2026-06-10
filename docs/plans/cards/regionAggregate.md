# 모듈 카드: regionAggregate

**TS 타겟:** src/core/regionAggregate.ts

## exportsTs (이 계약 그대로 export — 오버라이드 표가 우선)

```ts
```ts
// src/core/regionAggregate.ts
import type { VisitState } from "./models"; // 'visited' | 'wantToGo' | 'notVisited'

/**
 * 시군구 상태 맵 → 시도 상태 맵 (순수·결정적).
 * 코드 앞 2자리로 그룹, 우선순위 visited > wantToGo > notVisited.
 * 입력에 없는 시도는 출력에도 없음 — 렌더 측이 `?? 'notVisited'` 기본색 처리 (vanish 아님).
 * 키 길이 < 2 인 항목은 무시.
 */
export function sidoStates(sigungu: Record<string, VisitState>): Record<string, VisitState> {
  const out: Record<string, VisitState> = {};
  for (const [code, state] of Object.entries(sigungu)) {
    if (code.length < 2) continue;
    const sido = code.slice(0, 2);
    if (rank(state) > rank(out[sido] ?? "notVisited")) out[sido] = state;
  }
  return out;
}

// 내부 전용 (export 안 함): 집계 우선순위 등급
function rank(s: VisitState): number {
  switch (s) {
    case "visited": return 2;
    case "wantToGo": return 1;
    case "notVisited": return 0;
  }
}
```
```

## 보존 상수 (constants)

- rank.visited=2
- rank.wantToGo=1
- rank.notVisited=0
- sidoPrefixLength=2
- minCodeLength=2 (code.count >= 2 필터 — 미만이면 skip)

## 포팅할 테스트 (testsToPort)

### testMixedSidoTakesVisited
입력 {"11140":"visited", "11680":"wantToGo", "11110":"notVisited"} → 출력 ["11"] === "visited" (혼합 시 최우선 visited)

### testSingleVisitedWinsOverWantToGo
입력 {"26470":"wantToGo", "26440":"wantToGo", "26110":"visited"} → 출력 ["26"] === "visited" (단일 visited가 다수 wantToGo를 이김)

### testWantToGoOnlySido
입력 {"41110":"wantToGo", "41130":"wantToGo"} → 출력 ["41"] === "wantToGo"

### testEmptyInputEmptyOutput
입력 {} → 출력 빈 객체 (Object.keys(result).length === 0). 렌더가 notVisited 기본 처리하므로 시도 vanish 아님이라는 의도 주석 유지

### testMultipleSidoIndependent
입력 {"11140":"visited", "26470":"wantToGo"} → ["11"] === "visited", ["26"] === "wantToGo", ["41"] === undefined (Swift nil → TS undefined; 입력에 없는 시도는 출력에 없음)

## 포팅 함정 (notes)

포팅 함정: (1) Swift Dictionary 순회 순서는 비결정적이지만 알고리즘이 엄격 부등호(>) 기반 max-fold라 순서 무관 결정적 — rank가 3개 상태에 대해 단사(injective)이므로 동률 tie-break도 관측 불가. JS Object.entries의 삽입 순서 의존성 없음. (2) `out[sido] ?? .notVisited` 옵셔널 → TS에서 `out[sido] ?? "notVisited"` (undefined 합체)로 그대로 매핑. (3) `code.count >= 2` 가드 필수 보존 — Swift prefix(2)는 짧은 문자열에도 안전하지만 where 절이 먼저 skip하므로 TS도 `code.length < 2 → continue`. Swift String.count는 grapheme 단위, JS length는 UTF-16 단위이나 지역코드는 ASCII 숫자 5자리라 차이 없음 (slice(0,2) === prefix(2)). (4) Date/부동소수점/정렬/정수나눗셈 전혀 없음 — 완전 순수 함수. (5) VisitState는 Swift String RawValue enum → TS string union 'visited' | 'wantToGo' | 'notVisited' 으로 models 모듈에서 import (rawValue 문자열 그대로 보존해야 SwiftData 영속값과 호환). (6) rank()는 private — export 금지, 모듈 내부 함수로 유지. (7) Swift 출력 nil 조회(sido["41"]) → TS에서는 undefined 비교 또는 `"41" in result === false`로 검증. 원본 Swift: BaljachwiCore/Sources/BaljachwiCore/RegionAggregate.swift (29줄), 테스트: Tests/BaljachwiCoreTests/RegionAggregateTests.swift (48줄), VisitState 정의: Sources/BaljachwiCore/VisitState.swift.