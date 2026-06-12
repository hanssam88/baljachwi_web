import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// 사진 있음 + 무거운 자식 스텁(아이콘 탭바·재업로드 버튼만 검증).
vi.mock('@/hooks/useLive', () => ({ useLive: () => 3 }));
vi.mock('@/components/region/RegionMapScreen', () => ({ RegionMapScreen: () => <div>지역화면</div> }));
vi.mock('@/components/trip/RouteMapScreen', () => ({ RouteMapScreen: () => <div>경로맵화면</div> }));
vi.mock('@/components/trip/TripListScreen', () => ({ TripListScreen: () => <div>여행목록화면</div> }));
vi.mock('@/components/ImportOnboarding', () => ({ ImportOnboarding: () => <div>가져오기화면</div> }));

import { RootTabs } from '@/components/RootTabs';

describe('RootTabs — Direction A 아이콘 탭바', () => {
  it('각 탭 버튼은 라벨 텍스트와 함께 SVG 아이콘을 포함하고 접근성 이름은 유지', () => {
    render(<RootTabs />);
    for (const name of ['지역지도', '경로지도', '여행 목록']) {
      const tab = screen.getByRole('tab', { name });
      expect(tab.querySelector('svg')).not.toBeNull(); // 아이콘 도입
      expect(tab).toHaveTextContent(name); // 라벨 텍스트 유지
    }
  });

  it('재업로드(사진 업로드) 헤더 버튼에 upload SVG 아이콘 포함', () => {
    render(<RootTabs />);
    const btn = screen.getByRole('button', { name: /사진 업로드/ });
    expect(btn.querySelector('svg')).not.toBeNull();
  });
});
