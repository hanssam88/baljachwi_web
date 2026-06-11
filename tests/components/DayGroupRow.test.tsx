// tests/components/DayGroupRow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PhotoRef } from '@/data/models';
import type { DayGroup } from '@/lib/dayGroups';
import { DayGroupRow } from '@/components/trip/DayGroupRow';

const KST = 32400;
function p(id: string, region: string | null): PhotoRef {
  return { localIdentifier: id, lat: 33.5, lon: 126.5, takenAt: 1704078000, localTZoffsetSeconds: KST,
    regionCode: region, tripID: null, sortIndex: 0, userOverride: false };
}
const group: DayGroup = { localDay: 1, photos: [p('a', 'R1'), p('b', 'R2')] };
const names = { R1: '부산 연제구', R2: '부산 해운대구' };

describe('DayGroupRow', () => {
  it('날짜 라벨 + 지역 요약 + 사진 수 렌더', () => {
    render(<DayGroupRow group={group} names={names} onOpen={() => {}} />);
    expect(screen.getByText('1970. 1. 2. (금)')).toBeInTheDocument();
    expect(screen.getByText(/부산 연제구 · 부산 해운대구/)).toBeInTheDocument();
    expect(screen.getByText(/2장/)).toBeInTheDocument();
  });
  it('클릭 시 onOpen(group) 호출', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<DayGroupRow group={group} names={names} onOpen={onOpen} />);
    await user.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith(group);
  });
});
