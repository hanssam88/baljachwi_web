import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useLive', () => ({ useLive: () => 3 })); // hasPhotos
vi.mock('@/components/region/RegionMapScreen', () => ({ RegionMapScreen: () => <div>지역화면</div> }));
vi.mock('@/components/trip/RouteMapScreen', () => ({ RouteMapScreen: () => <div>경로맵화면</div> }));
vi.mock('@/components/trip/TripListScreen', () => ({ TripListScreen: () => <div>여행목록화면</div> }));
vi.mock('@/components/ImportOnboarding', () => ({ ImportOnboarding: () => <div>가져오기화면</div> }));

import { RootTabs } from '@/components/RootTabs';

describe('RootTabs 3탭', () => {
  it('지역지도/경로지도/여행 목록 3탭 렌더', () => {
    render(<RootTabs />);
    expect(screen.getByRole('tab', { name: '지역지도' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '경로지도' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '여행 목록' })).toBeInTheDocument();
  });
  it('경로지도 탭 → 전체 핀 지도(RouteMapScreen)', async () => {
    const user = userEvent.setup();
    render(<RootTabs />);
    await user.click(screen.getByRole('tab', { name: '경로지도' }));
    expect(screen.getByText('경로맵화면')).toBeInTheDocument();
  });
  it('여행 목록 탭 → 여행 리스트(TripListScreen)', async () => {
    const user = userEvent.setup();
    render(<RootTabs />);
    await user.click(screen.getByRole('tab', { name: '여행 목록' }));
    expect(screen.getByText('여행목록화면')).toBeInTheDocument();
  });
});
