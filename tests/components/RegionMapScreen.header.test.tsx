import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// 무거운 지도/훅 스텁 + 실데이터 진행률 검증용 고정 상태.
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

describe('RegionMapScreen — Direction A 헤더(ScreenHeader + StatCard 실데이터)', () => {
  it('타이틀(지역지도)을 heading 으로 렌더', () => {
    render(<RegionMapScreen />);
    expect(screen.getByRole('heading', { name: '지역지도' })).toBeInTheDocument();
  });

  it('진행바는 실데이터(방문 시군구 2 / 전체 100 → 2%)를 반영', () => {
    render(<RegionMapScreen />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '2');
  });

  it('데이터에 없는 가상 통계 비율 표기는 렌더하지 않는다', () => {
    render(<RegionMapScreen />);
    // 방문횟수·세부지역 류 가상 통계 텍스트 부재(StatCard 는 실데이터만).
    expect(screen.queryByText(/방문\s*\d+\s*회/)).not.toBeInTheDocument();
    expect(screen.queryByText(/세부\s*지역/)).not.toBeInTheDocument();
  });
});
