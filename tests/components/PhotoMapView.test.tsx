import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PhotoRef } from '@/data/models';
import { PhotoMapView } from '@/components/trip/PhotoMapView';
import { TILE_NOTICE_KEY } from '@/components/map/tileConsent';

function p(id: string): PhotoRef {
  return { localIdentifier: id, lat: 33.5, lon: 126.5, takenAt: 0, localTZoffsetSeconds: 0,
    regionCode: null, tripID: null, sortIndex: 0, userOverride: false };
}

// 타일 미동의 상태로 고정 → 지도 effect 가 maplibre 를 로드하지 않게(렌더 계층만 검증).
beforeEach(() => { localStorage.removeItem(TILE_NOTICE_KEY); });

describe('PhotoMapView — Direction A 힌트 칩', () => {
  it('hint 를 주면 지도 위 힌트 칩으로 노출', () => {
    render(<PhotoMapView photos={[p('a')]} hint="핀을 탭하면 같은 날 경로가 이어져요" />);
    expect(screen.getByText('핀을 탭하면 같은 날 경로가 이어져요')).toBeInTheDocument();
  });
  it('hint 가 없으면 칩 미노출', () => {
    render(<PhotoMapView photos={[p('a')]} />);
    expect(screen.queryByText(/핀을 탭하면/)).not.toBeInTheDocument();
  });
});
