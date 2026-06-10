// RegionAggregate(시군구→시도 집계) 단위 테스트 — Swift RegionAggregateTests.swift 의 byte-faithful 포트.
// 우선순위 visited > wantToGo > notVisited. 코드 앞 2자리 그룹. 입력에 없는 시도는 출력에도 없음(vanish 아님).
import { describe, it, expect } from 'vitest';
import { sidoStates } from '@/core/regionAggregate';
import type { VisitState } from '@/core/visitState';

describe('sidoStates', () => {
  // 혼합 시도: visited+wantToGo+notVisited 시군구 → visited(최우선).
  it('testMixedSidoTakesVisited', () => {
    const sido = sidoStates({
      '11140': 'visited', // 서울 중구
      '11680': 'wantToGo', // 서울 강남구
      '11110': 'notVisited', // 서울 종로구
    });
    expect(sido['11']).toBe('visited');
  });

  // 단일 visited가 wantToGo들을 이긴다(우선순위).
  it('testSingleVisitedWinsOverWantToGo', () => {
    const sido = sidoStates({
      '26470': 'wantToGo',
      '26440': 'wantToGo',
      '26110': 'visited',
    });
    expect(sido['26']).toBe('visited');
  });

  // wantToGo만 있는 시도 → wantToGo.
  it('testWantToGoOnlySido', () => {
    const sido = sidoStates({ '41110': 'wantToGo', '41130': 'wantToGo' });
    expect(sido['41']).toBe('wantToGo');
  });

  // 빈 입력 → 빈 출력(렌더가 notVisited 기본 → 시도 vanish 아님).
  it('testEmptyInputEmptyOutput', () => {
    const sido = sidoStates({});
    expect(Object.keys(sido).length).toBe(0);
  });

  // 여러 시도 동시 집계 — 각 시도 독립.
  it('testMultipleSidoIndependent', () => {
    const sido = sidoStates({
      '11140': 'visited', // 서울
      '26470': 'wantToGo', // 부산
    });
    expect(sido['11']).toBe('visited');
    expect(sido['26']).toBe('wantToGo');
    // 입력에 없는 시도는 출력에 없음(Swift nil → TS undefined). 렌더 기본=notVisited.
    expect(sido['41']).toBeUndefined();
    expect('41' in sido).toBe(false);
  });

  // 보존 함정 (3): code.length < 2 가드 — 1자리 키는 skip.
  it('skipsCodesShorterThanTwo', () => {
    const sido = sidoStates({
      '1': 'visited' as VisitState, // 길이 1 → skip
      '11140': 'wantToGo',
    });
    expect('1' in sido).toBe(false);
    expect(sido['11']).toBe('wantToGo');
  });

  // 빈 문자열 키도 skip(length 0 < 2).
  it('skipsEmptyKey', () => {
    const sido = sidoStates({ '': 'visited' as VisitState });
    expect(Object.keys(sido).length).toBe(0);
  });
});
