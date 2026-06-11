import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// 사진 있음 상태 강제 + 무거운 자식 스텁.
vi.mock('@/hooks/useLive', () => ({ useLive: () => 3 })); // photoCount=3 → hasPhotos
vi.mock('@/components/region/RegionMapScreen', () => ({ RegionMapScreen: () => <div>지역화면</div> }));
vi.mock('@/components/trip/RouteMapScreen', () => ({ RouteMapScreen: () => <div>경로맵화면</div> }));
vi.mock('@/components/trip/TripListScreen', () => ({ TripListScreen: () => <div>여행화면</div> }));
vi.mock('@/components/ImportOnboarding', () => ({
  ImportOnboarding: ({ onImported }: { onImported?: () => void }) => (
    <div>
      <span>가져오기화면</span>
      <button type="button" onClick={() => onImported?.()}>완료-시뮬</button>
    </div>
  ),
}));

import { RootTabs } from '@/components/RootTabs';

describe('RootTabs 재업로드(F1)', () => {
  it('사진 있으면 양쪽 탭에 사진 업로드 헤더 버튼 노출', async () => {
    const user = userEvent.setup();
    render(<RootTabs />);
    expect(screen.getByRole('button', { name: /사진 업로드/ })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '경로지도' }));
    expect(screen.getByRole('button', { name: /사진 업로드/ })).toBeInTheDocument();
  });

  it('헤더 버튼 클릭 → 가져오기 화면, 완료 시 지도로 복귀', async () => {
    const user = userEvent.setup();
    render(<RootTabs />);
    await user.click(screen.getByRole('button', { name: /사진 업로드/ }));
    expect(screen.getByText('가져오기화면')).toBeInTheDocument();
    await user.click(screen.getByText('완료-시뮬'));
    expect(screen.queryByText('가져오기화면')).not.toBeInTheDocument();
    expect(screen.getByText('지역화면')).toBeInTheDocument();
  });

  it('재업로드 중 하단 탭 클릭 → reimport 해제 후 해당 화면 표시(리뷰 반영)', async () => {
    const user = userEvent.setup();
    render(<RootTabs />);
    await user.click(screen.getByRole('button', { name: /사진 업로드/ }));
    expect(screen.getByText('가져오기화면')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '여행 목록' }));
    expect(screen.queryByText('가져오기화면')).not.toBeInTheDocument();
    expect(screen.getByText('여행화면')).toBeInTheDocument();
  });
});
