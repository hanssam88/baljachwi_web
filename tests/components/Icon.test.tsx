import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Icon, ICON_NAMES, type IconName } from '@/components/common/Icon';

describe('Icon', () => {
  it('모든 등록된 name 은 <svg>(24 viewBox) 를 렌더한다', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg, name).not.toBeNull();
      expect(svg!.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg!.getAttribute('fill')).toBe('none');
      unmount();
    }
  });

  it('Direction A 이식에 필요한 핵심 아이콘을 포함', () => {
    for (const need of [
      'region', 'route', 'list', 'plus', 'upload', 'lock', 'footprint',
      'camera', 'bookmark', 'calendar', 'chevronLeft', 'dots', 'check', 'trash',
    ] as const) {
      expect(ICON_NAMES).toContain(need);
    }
  });

  it('size/color/strokeWidth prop 을 svg 속성에 반영', () => {
    const { container } = render(<Icon name="region" size={32} color="#2E7D5B" strokeWidth={2.4} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('height')).toBe('32');
    expect(svg.getAttribute('stroke')).toBe('#2E7D5B');
    expect(svg.getAttribute('stroke-width')).toBe('2.4');
  });

  it('color 기본값은 currentColor (부모 색 상속)', () => {
    const { container } = render(<Icon name="list" />);
    expect(container.querySelector('svg')!.getAttribute('stroke')).toBe('currentColor');
  });

  it('기본은 장식용(aria-hidden=true)', () => {
    const { container } = render(<Icon name="camera" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
  });

  it('label 주면 role=img + aria-label, aria-hidden 해제', () => {
    const { container } = render(<Icon name="bookmark" label="가고싶음" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBeNull();
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('가고싶음');
  });

  it('알 수 없는 name 도 크래시 없이 <svg> 를 렌더(빈 아이콘)', () => {
    const { container } = render(<Icon name={'nope' as IconName} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
