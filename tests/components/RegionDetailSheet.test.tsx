// tests/components/RegionDetailSheet.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegionDetailSheet } from '@/components/region/RegionDetailSheet';

function base() {
  return { regionName: '서울 중구', onToggleWantToGo: vi.fn(), onViewPhotos: vi.fn(), onClose: vi.fn() };
}

describe('RegionDetailSheet', () => {
  it('방문 지역: 지역명·방문 배지·사진수·방문일·사진보기, 가고싶음 버튼 없음(요청 핵심)', () => {
    render(<RegionDetailSheet {...base()} state="visited" photoCount={3} firstVisit={1704034800} lastVisit={1710027000} />);
    expect(screen.getByText('서울 중구')).toBeInTheDocument();
    expect(screen.getByText('방문')).toBeInTheDocument();
    expect(screen.getByText(/3장/)).toBeInTheDocument();
    expect(screen.getByText('2024. 1. 1. ~ 2024. 3. 10.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사진 보기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /가고싶음/ })).not.toBeInTheDocument();
  });
  it('방문일 단일(first==last) → 한 날짜만', () => {
    render(<RegionDetailSheet {...base()} state="visited" photoCount={1} firstVisit={1704034800} lastVisit={1704034800} />);
    expect(screen.getByText('2024. 1. 1.')).toBeInTheDocument();
  });
  it('미방문 지역: 미방문 배지 + "가고싶음 저장", 사진수/사진보기/방문일 없음', () => {
    render(<RegionDetailSheet {...base()} state="notVisited" photoCount={0} firstVisit={null} lastVisit={null} />);
    expect(screen.getByText('미방문')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '가고싶음 저장' })).toBeInTheDocument();
    expect(screen.queryByText(/사진 \d+장/)).not.toBeInTheDocument(); // "사진 N장" 라인 부재(버튼 "저장"과 충돌 방지)
    expect(screen.queryByRole('button', { name: '사진 보기' })).not.toBeInTheDocument();
  });
  it('가고싶음 지역: 가고싶음 배지 + "가고싶음 해제"', () => {
    render(<RegionDetailSheet {...base()} state="wantToGo" photoCount={0} firstVisit={null} lastVisit={null} />);
    expect(screen.getByText('가고싶음')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '가고싶음 해제' })).toBeInTheDocument();
  });
  it('닫기 → onClose', async () => {
    const props = base(); const user = userEvent.setup();
    render(<RegionDetailSheet {...props} state="notVisited" photoCount={0} firstVisit={null} lastVisit={null} />);
    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
  it('가고싶음 저장 클릭 → onToggleWantToGo', async () => {
    const props = base(); const user = userEvent.setup();
    render(<RegionDetailSheet {...props} state="notVisited" photoCount={0} firstVisit={null} lastVisit={null} />);
    await user.click(screen.getByRole('button', { name: '가고싶음 저장' }));
    expect(props.onToggleWantToGo).toHaveBeenCalledTimes(1);
  });
  it('사진 보기 클릭 → onViewPhotos', async () => {
    const props = base(); const user = userEvent.setup();
    render(<RegionDetailSheet {...props} state="visited" photoCount={2} firstVisit={1704034800} lastVisit={1704034800} />);
    await user.click(screen.getByRole('button', { name: '사진 보기' }));
    expect(props.onViewPhotos).toHaveBeenCalledTimes(1);
  });
});
