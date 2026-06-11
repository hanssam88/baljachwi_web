// tests/hooks/useThumbUrls.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const thumbFor = vi.fn();
vi.mock('@/data/repo', () => ({ repo: () => ({ thumbFor }) }));

import { useThumbUrls } from '@/hooks/useThumbUrls';

describe('useThumbUrls', () => {
  beforeEach(() => {
    thumbFor.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:x') as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
  });
  it('id별 objectURL 맵 생성', async () => {
    thumbFor.mockResolvedValue(new Blob());
    const { result } = renderHook(() => useThumbUrls(['a', 'b']));
    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(2));
    expect(result.current.a).toBe('blob:x');
  });
  it('썸네일 없으면 키 생략', async () => {
    thumbFor.mockResolvedValue(null);
    const { result } = renderHook(() => useThumbUrls(['a']));
    await waitFor(() => expect(thumbFor).toHaveBeenCalled());
    expect(result.current.a).toBeUndefined();
  });
  it('id에 콤마가 있어도 키 분리 안 됨(split 금지 회귀 가드)', async () => {
    thumbFor.mockResolvedValue(new Blob());
    const { result } = renderHook(() => useThumbUrls(['a,b']));
    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(1));
    expect(result.current['a,b']).toBe('blob:x'); // 'a'/'b'로 쪼개지면 이 키가 없어 실패
  });
  it('언마운트 시 생성된 objectURL 전량 revoke(누수 가드)', async () => {
    thumbFor.mockResolvedValue(new Blob());
    const { result, unmount } = renderHook(() => useThumbUrls(['a', 'b']));
    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(2));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
