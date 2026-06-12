import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '@/components/common/StatCard';

describe('StatCard', () => {
  it('value/unit/label 을 렌더', () => {
    render(<StatCard value={12} unit="곳" label="방문한 시군구" />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('곳')).toBeInTheDocument();
    expect(screen.getByText('방문한 시군구')).toBeInTheDocument();
  });

  it('progress 가 있으면 비율(current/total)로 진행바 너비를 채운다', () => {
    render(<StatCard value={60} label="시군구 정복" progress={{ current: 60, total: 250 }} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '24'); // round(60/250*100)
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('24%');
  });

  it('진행바는 label 을 접근성 이름으로 노출한다(스크린리더가 맥락 없는 % 만 읽지 않게)', () => {
    render(<StatCard value={60} label="시군구 정복" progress={{ current: 60, total: 250 }} />);
    // role+이름으로 조회되어야 '24%' 가 무엇의 비율인지 전달된다.
    expect(screen.getByRole('progressbar', { name: '시군구 정복' })).toBeInTheDocument();
  });

  it('progress 가 없으면 진행바를 그리지 않는다 (가상 통계 방지 회귀)', () => {
    render(<StatCard value={5} label="여행" />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('total 이 0이면 진행바를 그리지 않는다 (0 나눗셈 방지)', () => {
    render(<StatCard value={0} label="시군구 정복" progress={{ current: 0, total: 0 }} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
