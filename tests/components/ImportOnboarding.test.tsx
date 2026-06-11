import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ImportOnboarding } from '@/components/ImportOnboarding';

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
