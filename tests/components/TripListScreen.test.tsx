import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PhotoRef } from '@/data/models';
import type { DayGroup } from '@/lib/dayGroups';

// 무거운 dynamic import(maplibre) 차단 + 클릭 후 진입 검증용 스텁.
vi.mock('@/components/trip/PhotoMapView', () => ({
  PhotoMapView: ({ photos, title }: { photos: PhotoRef[]; title?: string }) => (
    <div data-testid="photo-map">map:{title}:{photos.length}</div>
  ),
}));
vi.mock('@/components/trip/PhotoSelectScreen', () => ({
  PhotoSelectScreen: ({ title, photos }: { title: string; photos: PhotoRef[] }) => (
    <div data-testid="photo-select">select:{title}:{photos.length}</div>
  ),
}));

const hooks = vi.hoisted(() => ({ groups: undefined as DayGroup[] | undefined }));
vi.mock('@/hooks/useTrips', () => ({
  useDayGroups: () => hooks.groups,
  useRegionNames: () => ({ R1: '부산 연제구' }),
}));

const KST = 32400;
function p(id: string): PhotoRef {
  return { localIdentifier: id, lat: 33.5, lon: 126.5, takenAt: 1704078000, localTZoffsetSeconds: KST,
    regionCode: 'R1', tripID: null, sortIndex: 0, userOverride: false };
}

import { TripListScreen } from '@/components/trip/TripListScreen';

describe('TripListScreen 날짜별', () => {
  beforeEach(() => { hooks.groups = undefined; });

  it('로딩 중(undefined) → "불러오는 중…"', () => {
    hooks.groups = undefined;
    render(<TripListScreen />);
    expect(screen.getByText('불러오는 중…')).toBeInTheDocument();
  });
  it('사진 0장(그룹 0개) → "아직 여행이 없습니다"', () => {
    hooks.groups = [];
    render(<TripListScreen />);
    expect(screen.getByText('아직 여행이 없습니다')).toBeInTheDocument();
    expect(screen.queryByTestId('photo-map')).not.toBeInTheDocument();
  });
  it('카드 본문 클릭 → 그날 핀 지도', async () => {
    hooks.groups = [{ localDay: 1, photos: [p('a'), p('b')] }];
    const user = userEvent.setup();
    render(<TripListScreen />);
    expect(screen.getByText('1970. 1. 2. (금)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /1970\. 1\. 2\./ }));
    expect(screen.getByTestId('photo-map')).toHaveTextContent('map:1970. 1. 2. (금):2');
  });
  it('⋯ 클릭 → 사진 선택 화면', async () => {
    hooks.groups = [{ localDay: 1, photos: [p('a'), p('b')] }];
    const user = userEvent.setup();
    render(<TripListScreen />);
    await user.click(screen.getByRole('button', { name: '더보기' }));
    expect(screen.getByTestId('photo-select')).toHaveTextContent('select:1970. 1. 2. (금):2');
  });
});
