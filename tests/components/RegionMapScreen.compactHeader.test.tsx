import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// 무거운 지도/훅 스텁 + 실데이터 진행률 검증용 고정 상태(헤더 테스트와 동일 셋업).
vi.mock('@/components/region/RegionMapView', () => ({ RegionMapView: () => <div data-testid="region-map" /> }));
vi.mock('@/components/trip/PhotoMapView', () => ({ PhotoMapView: () => <div data-testid="photo-map" /> }));
vi.mock('@/hooks/useRegionDetail', () => ({ useRegionStatusRow: () => null, usePhotosForRegion: () => [] }));
vi.mock('@/hooks/useRegionStatuses', () => ({
  useRegionStatuses: () => ({
    sigungu: { '11140': 'visited', '11170': 'visited' }, // 방문 2곳
    sido: {},
    loaded: true,
  }),
}));
vi.mock('@/hooks/useTrips', () => ({ useRegionNames: () => ({}) }));
vi.mock('@/data/repo', () => ({ repo: () => ({ setWantToGo: vi.fn() }) }));
vi.mock('@/lib/regionLayerStyle', () => ({ levelLayerConfig: () => ({ total: 100 }) }));

import { RegionMapScreen } from '@/components/region/RegionMapScreen';

describe('RegionMapScreen — 컴팩트 단일 행 헤더(지도 영역 최대화)', () => {
  it('타이틀·레벨토글·정복 통계가 하나의 헤더 행 안에 함께 렌더', () => {
    render(<RegionMapScreen />);
    const header = screen.getByTestId('region-header');
    // 세 요소가 같은 컨테이너(한 행)에 모여 있어야 한다.
    expect(within(header).getByRole('heading', { name: '지역지도' })).toBeInTheDocument();
    expect(within(header).getByRole('tablist', { name: '지도 레벨' })).toBeInTheDocument();
    expect(within(header).getByRole('progressbar')).toBeInTheDocument();
  });

  it('헤더는 세로 스택이 아니라 가로 행(flex row)으로 배치된다', () => {
    render(<RegionMapScreen />);
    const header = screen.getByTestId('region-header');
    expect(header.style.display).toBe('flex');
    expect(header.style.flexDirection).not.toBe('column');
  });

  it('진행바는 실데이터(방문 2 / 전체 100 → 2%)를 유지', () => {
    render(<RegionMapScreen />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  });
});
