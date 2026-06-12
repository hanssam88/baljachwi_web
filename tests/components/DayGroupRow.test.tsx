// tests/components/DayGroupRow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PhotoRef } from '@/data/models';
import type { DayGroup } from '@/lib/dayGroups';
import { DayGroupRow } from '@/components/trip/DayGroupRow';

const KST = 32400;
function p(id: string, region: string | null): PhotoRef {
  return { localIdentifier: id, lat: 33.5, lon: 126.5, takenAt: 1704078000, localTZoffsetSeconds: KST, regionCode: region, tripID: null, sortIndex: 0, userOverride: false };
}
const group: DayGroup = { localDay: 1, photos: [p('a', 'R1'), p('b', 'R2')] };
const names = { R1: '부산 연제구', R2: '부산 해운대구' };

describe('DayGroupRow', () => {
  it('날짜 + 지역 요약 + 사진 수 렌더', () => {
    render(<DayGroupRow group={group} names={names} onOpen={() => {}} onManage={() => {}} />);
    expect(screen.getByText('1970. 1. 2. (금)')).toBeInTheDocument();
    expect(screen.getByText(/부산 연제구 · 부산 해운대구/)).toBeInTheDocument();
    expect(screen.getByText(/2장/)).toBeInTheDocument();
  });
  it('본문 클릭 → onOpen(group)', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<DayGroupRow group={group} names={names} onOpen={onOpen} onManage={() => {}} />);
    await user.click(screen.getByRole('button', { name: /1970\. 1\. 2\./ }));
    expect(onOpen).toHaveBeenCalledWith(group);
  });
  it('⋯(더보기) 클릭 → onManage(group)', async () => {
    const onManage = vi.fn();
    const user = userEvent.setup();
    render(<DayGroupRow group={group} names={names} onOpen={() => {}} onManage={onManage} />);
    await user.click(screen.getByRole('button', { name: '더보기' }));
    expect(onManage).toHaveBeenCalledWith(group);
  });
});

describe('DayGroupRow — Direction A 카드(커버 썸네일 + dots 아이콘)', () => {
  it('coverUrl 이 있으면 커버 이미지로 렌더', () => {
    const { container } = render(
      <DayGroupRow group={group} names={names} coverUrl="blob:cover" onOpen={() => {}} onManage={() => {}} />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('blob:cover');
  });
  it('coverUrl 이 없으면 이미지 대신 플레이스홀더(svg) 노출', () => {
    const { container } = render(
      <DayGroupRow group={group} names={names} onOpen={() => {}} onManage={() => {}} />,
    );
    expect(container.querySelector('img')).toBeNull();
    // 플레이스홀더(camera) + dots = 최소 2개 svg.
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
  });
  it('더보기(⋯)는 dots SVG 아이콘으로 렌더하되 aria-label 유지', () => {
    render(<DayGroupRow group={group} names={names} onOpen={() => {}} onManage={() => {}} />);
    const btn = screen.getByRole('button', { name: '더보기' });
    expect(btn.querySelector('svg')).not.toBeNull();
  });
});
