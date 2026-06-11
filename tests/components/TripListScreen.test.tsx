import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PhotoRef, TripRecord } from '@/data/models';

// 무거운 의존(dynamic import maplibre) 차단 — PhotoMapView를 가벼운 스텁으로.
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

  it('여행 0개 + loose 사진 1장 → 마커맵 표시(빈 문구 아님)', async () => {
    hooks.trips = [];
    hooks.photos = [photo('a')];
    render(<TripListScreen />);
    // PhotoMapView는 next/dynamic 지연 로드 → 비동기 해소 후 등장.
    expect(await screen.findByTestId('photo-map')).toBeInTheDocument();
    expect(screen.queryByText('아직 여행이 없습니다')).not.toBeInTheDocument();
  });

  it('여행 0개 + 사진 0장 → "아직 여행이 없습니다"', () => {
    hooks.trips = [];
    hooks.photos = [];
    render(<TripListScreen />);
    expect(screen.getByText('아직 여행이 없습니다')).toBeInTheDocument();
    expect(screen.queryByTestId('photo-map')).not.toBeInTheDocument();
  });
});
