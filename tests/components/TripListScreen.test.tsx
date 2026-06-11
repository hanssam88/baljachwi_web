import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PhotoRef, TripRecord } from '@/data/models';

// 무거운 의존(dynamic import maplibre) 차단 + 회귀 가드용 스텁.
// TripListScreen은 더 이상 PhotoMapView를 import하지 않는다(0-trips 지도 폴백 제거).
// 만약 누군가 폴백 지도를 재도입하면 이 스텁이 'photo-map'을 렌더 → 아래 음성 단언이 깨져 회귀를 잡는다.
vi.mock('@/components/trip/PhotoMapView', () => ({
  PhotoMapView: ({ photos }: { photos: PhotoRef[] }) => (
    <div data-testid="photo-map">photos:{photos.length}</div>
  ),
}));

const hooks = vi.hoisted(() => ({
  trips: undefined as TripRecord[] | undefined,
  photos: undefined as PhotoRef[] | undefined,
}));
vi.mock('@/hooks/useTrips', () => ({
  useTripsByRecent: () => hooks.trips,
  useRegionNames: () => ({}),
  useAllPhotos: () => hooks.photos,
}));

function photo(id: string): PhotoRef {
  return { localIdentifier: id, lat: 33.5, lon: 126.5, takenAt: 0, localTZoffsetSeconds: 0,
    regionCode: null, tripID: null, sortIndex: 0, userOverride: false };
}

import { TripListScreen } from '@/components/trip/TripListScreen';

describe('TripListScreen 빈 상태', () => {
  beforeEach(() => { hooks.trips = undefined; hooks.photos = undefined; });

  it('여행 0개 + loose 사진 있음 → 안내 문구(지도 폴백 없음, 경로지도로 안내)', async () => {
    hooks.trips = [];
    hooks.photos = [photo('a')];
    render(<TripListScreen />);
    // 경로지도 탭이 전체-핀 지도를 담당하므로, 여행목록은 지도를 중복 표시하지 않고 안내만 한다.
    expect(await screen.findByText(/여행으로 묶인 사진이 없/)).toBeInTheDocument();
    expect(screen.getByText(/경로지도/)).toBeInTheDocument();
    expect(screen.queryByTestId('photo-map')).not.toBeInTheDocument();
  });

  it('여행 0개 + 사진 0장 → "아직 여행이 없습니다"', () => {
    hooks.trips = [];
    hooks.photos = [];
    render(<TripListScreen />);
    expect(screen.getByText('아직 여행이 없습니다')).toBeInTheDocument();
    expect(screen.queryByTestId('photo-map')).not.toBeInTheDocument();
  });
});
