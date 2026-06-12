// tests/components/RegionMapScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RegionStatus, PhotoRef } from '@/data/models';

// 무거운 dynamic import(maplibre) 차단 + 선택/해제 트리거 스텁.
vi.mock('@/components/region/RegionMapView', () => ({
  RegionMapView: ({ onSelectRegion }: { onSelectRegion?: (c: string | null) => void }) => (
    <div data-testid="region-map">
      <button onClick={() => onSelectRegion?.('11140')}>지역선택</button>
      <button onClick={() => onSelectRegion?.(null)}>지역해제</button>
    </div>
  ),
}));
vi.mock('@/components/trip/PhotoMapView', () => ({
  PhotoMapView: ({ title, photos }: { title?: string; photos: PhotoRef[] }) => (
    <div data-testid="photo-map">map:{title}:{photos.length}</div>
  ),
}));
const hooks = vi.hoisted(() => ({ row: null as RegionStatus | null, photos: [] as PhotoRef[] }));
vi.mock('@/hooks/useRegionDetail', () => ({
  useRegionStatusRow: () => hooks.row,
  usePhotosForRegion: () => hooks.photos,
}));
vi.mock('@/hooks/useRegionStatuses', () => ({ useRegionStatuses: () => ({ sigungu: {}, sido: {}, loaded: true }) }));
vi.mock('@/hooks/useTrips', () => ({ useRegionNames: () => ({ '11140': '서울 중구' }) }));
const setWantToGo = vi.fn().mockResolvedValue(undefined);
vi.mock('@/data/repo', () => ({ repo: () => ({ setWantToGo }) }));

import { RegionMapScreen } from '@/components/region/RegionMapScreen';

beforeEach(() => { hooks.row = null; hooks.photos = []; setWantToGo.mockClear(); });

describe('RegionMapScreen 지역 상세', () => {
  it('초기엔 시트 없음', () => {
    render(<RegionMapScreen />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('지역 선택 → 미방문 시트(지역명 + 가고싶음 저장)', async () => {
    const user = userEvent.setup();
    render(<RegionMapScreen />);
    await user.click(screen.getByRole('button', { name: '지역선택' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', '서울 중구 상세');
    expect(screen.getByRole('button', { name: '가고싶음 저장' })).toBeInTheDocument();
  });
  it('가고싶음 저장 클릭 → repo.setWantToGo(code, true)', async () => {
    const user = userEvent.setup();
    render(<RegionMapScreen />);
    await user.click(screen.getByRole('button', { name: '지역선택' }));
    await user.click(screen.getByRole('button', { name: '가고싶음 저장' }));
    expect(setWantToGo).toHaveBeenCalledWith('11140', true);
  });
  it('가고싶음 지역 → 해제 클릭 시 setWantToGo(code, false)', async () => {
    hooks.row = { regionCode: '11140', level: 'sigungu', state: 'wantToGo', photoCount: 0, firstVisit: null, lastVisit: null, userOverride: true };
    const user = userEvent.setup();
    render(<RegionMapScreen />);
    await user.click(screen.getByRole('button', { name: '지역선택' }));
    await user.click(screen.getByRole('button', { name: '가고싶음 해제' }));
    expect(setWantToGo).toHaveBeenCalledWith('11140', false);
  });
  it('방문 지역 → 가고싶음 버튼 없음(요청 핵심)', async () => {
    hooks.row = { regionCode: '11140', level: 'sigungu', state: 'visited', photoCount: 2, firstVisit: 100, lastVisit: 300, userOverride: false };
    const user = userEvent.setup();
    render(<RegionMapScreen />);
    await user.click(screen.getByRole('button', { name: '지역선택' }));
    expect(screen.queryByRole('button', { name: /가고싶음/ })).not.toBeInTheDocument();
  });
  it('사진 보기 → PhotoMapView 진입(지역 사진 수)', async () => {
    hooks.row = { regionCode: '11140', level: 'sigungu', state: 'visited', photoCount: 2, firstVisit: 100, lastVisit: 300, userOverride: false };
    hooks.photos = [{ localIdentifier: 'a' } as PhotoRef, { localIdentifier: 'b' } as PhotoRef];
    const user = userEvent.setup();
    render(<RegionMapScreen />);
    await user.click(screen.getByRole('button', { name: '지역선택' }));
    await user.click(screen.getByRole('button', { name: '사진 보기' }));
    expect(screen.getByTestId('photo-map')).toHaveTextContent('map:서울 중구:2');
  });
  it('닫기 → 시트 사라짐', async () => {
    const user = userEvent.setup();
    render(<RegionMapScreen />);
    await user.click(screen.getByRole('button', { name: '지역선택' }));
    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('지역해제(바깥 탭, code=null) → 시트 사라짐', async () => {
    const user = userEvent.setup();
    render(<RegionMapScreen />);
    await user.click(screen.getByRole('button', { name: '지역선택' }));
    await user.click(screen.getByRole('button', { name: '지역해제' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
