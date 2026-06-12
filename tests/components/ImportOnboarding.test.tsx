import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportOnboarding } from '@/components/ImportOnboarding';

// useScan 을 모킹하여 phase 를 테스트별로 제어(error 색 토큰화 검증용).
// 기본은 idle — webkitdirectory 효과와 dropzone 정적 렌더는 phase 와 무관하므로 기존 테스트 영향 없음.
const h = vi.hoisted(() => ({
  state: { phase: 'idle', progress: 0, label: '', error: null as string | null },
}));
vi.mock('@/hooks/useScan', () => ({
  useScan: () => ({ state: h.state, importFiles: vi.fn(), reset: vi.fn() }),
}));

beforeEach(() => {
  h.state = { phase: 'idle', progress: 0, label: '', error: null };
});

function mockPointer(fine: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('fine') ? fine : !fine,
    media: q, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('ImportOnboarding file input', () => {
  it('모바일(coarse 포인터)은 webkitdirectory 미부여 → 사진 앱 열림', () => {
    mockPointer(false); // (pointer: fine) 미매치 = 모바일
    const { container } = render(<ImportOnboarding />);
    const input = container.querySelector('input[type="file"]')!;
    expect(input.hasAttribute('webkitdirectory')).toBe(false);
    expect(input.getAttribute('accept')).toBe('image/*');
    expect(input.hasAttribute('multiple')).toBe(true);
  });
  it('데스크톱(fine 포인터)은 webkitdirectory 부여 → 폴더 선택', () => {
    mockPointer(true);
    const { container } = render(<ImportOnboarding />);
    const input = container.querySelector('input[type="file"]')!;
    expect(input.hasAttribute('webkitdirectory')).toBe(true);
  });
});

describe('ImportOnboarding — Direction A 정제 (아이콘 + 데이터 정직성 + 토큰)', () => {
  it('브랜드 히어로로 footprint SVG 아이콘(발자취)을 렌더', () => {
    render(<ImportOnboarding />);
    expect(screen.getByRole('img', { name: '발자취' })).toBeInTheDocument();
  });

  it('프라이버시 안내 라인에 lock SVG 아이콘을 동반', () => {
    render(<ImportOnboarding />);
    const privacy = screen.getByText('사진은 기기 밖으로 전송되지 않습니다');
    expect(privacy.querySelector('svg')).not.toBeNull();
  });

  it('목업의 4단계 온보딩 체크리스트(목록)를 이식하지 않는다(실데이터 결정)', () => {
    const { container } = render(<ImportOnboarding />);
    expect(container.querySelector('li')).toBeNull();
    expect(container.querySelector('ul, ol')).toBeNull();
    // 단계별 라벨(EXIF/지역 매칭/여행 분할/썸네일)은 idle 화면에 정적 노출되지 않는다.
    expect(screen.queryByText(/EXIF/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/지역 매칭/)).not.toBeInTheDocument();
    expect(screen.queryByText(/여행 분할/)).not.toBeInTheDocument();
  });

  it('에러 메시지 색은 하드코딩 hex 가 아니라 --danger 토큰을 쓴다', () => {
    h.state = { phase: 'error', progress: 0, label: '', error: '테스트 오류' };
    render(<ImportOnboarding />);
    const alert = screen.getByRole('alert');
    // #C2453A 는 jsdom 에서 rgb(194, 69, 58) 로 정규화된다 — 토큰화 후에는 이 값이 아니어야 한다.
    expect((alert as HTMLElement).style.color).not.toBe('rgb(194, 69, 58)');
    expect((alert as HTMLElement).style.color).not.toBe('#C2453A');
  });
});
