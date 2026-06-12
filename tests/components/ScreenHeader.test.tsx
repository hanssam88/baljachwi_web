import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScreenHeader } from '@/components/common/ScreenHeader';

describe('ScreenHeader', () => {
  it('타이틀을 heading 으로 렌더', () => {
    render(<ScreenHeader title="지역지도" />);
    expect(screen.getByRole('heading', { name: '지역지도' })).toBeInTheDocument();
  });

  it('action 이 없으면 버튼을 렌더하지 않는다', () => {
    render(<ScreenHeader title="지역지도" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('action 을 주면 aria-label 버튼 + 클릭 시 onClick 호출', async () => {
    const onClick = vi.fn();
    render(<ScreenHeader title="지역지도" action={{ icon: 'plus', label: '사진 추가', onClick }} />);
    const btn = screen.getByRole('button', { name: '사진 추가' });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
