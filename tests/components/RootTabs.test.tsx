import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RootTabs } from '@/components/RootTabs';

describe('RootTabs', () => {
  it('지역지도 / 경로지도 두 탭을 렌더하고 기본은 지역지도 활성', () => {
    render(<RootTabs />);
    const region = screen.getByRole('tab', { name: '지역지도' });
    const trip = screen.getByRole('tab', { name: '경로지도' });
    expect(region).toBeInTheDocument();
    expect(trip).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-selected', 'true');
    expect(trip).toHaveAttribute('aria-selected', 'false');
  });

  it('경로지도 탭 클릭 시 활성 탭이 전환된다', async () => {
    const user = userEvent.setup();
    render(<RootTabs />);
    await user.click(screen.getByRole('tab', { name: '경로지도' }));
    expect(screen.getByRole('tab', { name: '경로지도' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '지역지도' })).toHaveAttribute('aria-selected', 'false');
  });

  it('빈 상태 안내 문구를 노출한다(가져온 사진 없음)', () => {
    render(<RootTabs />);
    expect(screen.getByText('아직 가져온 사진이 없습니다')).toBeInTheDocument();
  });
});
