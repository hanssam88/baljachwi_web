import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RootTabs } from '@/components/RootTabs';

// 여행 목록이 길어져도 하단 탭바가 밀려나지 않으려면, 셸이 뷰포트 높이로 고정되고
// 자체 스크롤을 막아야 한다(내부 main 만 스크롤). jsdom 은 레이아웃이 없으므로
// 이 메커니즘을 회귀 가드로 인라인 스타일에서 단언한다. 실제 거동은 브라우저로 검증.
describe('RootTabs — 셸 고정 높이(탭바 고정)', () => {
  it('셸은 뷰포트 높이(100dvh)로 고정되고 자체 오버플로를 숨긴다', () => {
    render(<RootTabs />);
    const shell = screen.getByTestId('app-shell');
    expect(shell.style.height).toBe('100dvh');
    expect(shell.style.overflow).toBe('hidden');
  });
});
