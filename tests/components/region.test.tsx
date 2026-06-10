import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatHeader } from '@/components/region/StatHeader';
import { Choropleth } from '@/components/region/Choropleth';
import type { VisitState } from '@/core/visitState';

describe('StatHeader', () => {
  it('시군구 정복률 텍스트 (2/255 → 반올림 1%)', () => {
    render(<StatHeader level="sigungu" visitedCount={2} total={255} />);
    expect(screen.getByText('시군구 2/255 정복 · 1%')).toBeInTheDocument();
  });

  it('시군구 7곳 → 3% (Math.round 2.745)', () => {
    render(<StatHeader level="sigungu" visitedCount={7} total={255} />);
    expect(screen.getByText('시군구 7/255 정복 · 3%')).toBeInTheDocument();
  });

  it('시도 라벨 + 0곳 → 0%', () => {
    render(<StatHeader level="sido" visitedCount={0} total={17} />);
    expect(screen.getByText('시도 0/17 정복 · 0%')).toBeInTheDocument();
  });
});

describe('Choropleth', () => {
  const regions = [
    { code: '11140', name: '서울 중구', d: 'M0 0L1 0L1 1Z' },
    { code: '26170', name: '부산 동구', d: 'M2 2L3 2L3 3Z' },
    { code: '50110', name: '제주 제주시', d: 'M4 4L5 4L5 5Z' },
  ];

  it('각 지역 path에 data-code, data-state 부여 (없으면 notVisited)', () => {
    const stateByCode: Record<string, VisitState> = { '11140': 'visited', '26170': 'wantToGo' };
    const { container } = render(
      <Choropleth viewBox="0 0 10 10" regions={regions} stateByCode={stateByCode} />,
    );
    const p1 = container.querySelector('path[data-code="11140"]');
    const p2 = container.querySelector('path[data-code="26170"]');
    const p3 = container.querySelector('path[data-code="50110"]');
    expect(p1?.getAttribute('data-state')).toBe('visited');
    expect(p2?.getAttribute('data-state')).toBe('wantToGo');
    expect(p3?.getAttribute('data-state')).toBe('notVisited'); // 입력에 없으면 미방문
  });

  it('path에 aria-label(이름·상태) 부여', () => {
    const { container } = render(
      <Choropleth viewBox="0 0 10 10" regions={regions} stateByCode={{ '11140': 'visited' }} />,
    );
    const p1 = container.querySelector('path[data-code="11140"]');
    expect(p1?.getAttribute('aria-label')).toContain('서울 중구');
  });
});
