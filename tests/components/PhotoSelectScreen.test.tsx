// tests/components/PhotoSelectScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PhotoRef } from '@/data/models';

const deletePhotos = vi.fn().mockResolvedValue(undefined);
vi.mock('@/data/repo', () => ({ repo: () => ({ deletePhotos }) }));
vi.mock('@/hooks/useThumbUrls', () => ({ useThumbUrls: () => ({}) }));

const KST = 32400;
function p(id: string): PhotoRef {
  return { localIdentifier: id, lat: 33.5, lon: 126.5, takenAt: 1704078000, localTZoffsetSeconds: KST, regionCode: 'R1', tripID: null, sortIndex: 0, userOverride: false };
}
import { PhotoSelectScreen } from '@/components/trip/PhotoSelectScreen';

describe('PhotoSelectScreen', () => {
  beforeEach(() => deletePhotos.mockClear());

  it('0장 선택 시 삭제 버튼 비활성', () => {
    render(<PhotoSelectScreen title="t" photos={[p('a'), p('b')]} onDeleted={() => {}} onBack={() => {}} />);
    expect(screen.getByRole('button', { name: /삭제 \(0\)/ })).toBeDisabled();
  });
  it('선택 → 카운트 갱신 + 활성', async () => {
    const user = userEvent.setup();
    render(<PhotoSelectScreen title="t" photos={[p('a'), p('b')]} onDeleted={() => {}} onBack={() => {}} />);
    await user.click(screen.getByRole('button', { name: '사진 선택 a' }));
    expect(screen.getByRole('button', { name: /삭제 \(1\)/ })).toBeEnabled();
  });
  it('다시 클릭 → 토글 오프 → "삭제 (0)" 복귀 + 비활성', async () => {
    const user = userEvent.setup();
    render(<PhotoSelectScreen title="t" photos={[p('a'), p('b')]} onDeleted={() => {}} onBack={() => {}} />);
    const cell = screen.getByRole('button', { name: '사진 선택 a' });
    await user.click(cell);
    await user.click(cell); // 토글 오프
    expect(screen.getByRole('button', { name: /삭제 \(0\)/ })).toBeDisabled();
  });
  it('삭제 → 확인 → repo.deletePhotos(선택 1장) → onDeleted', async () => {
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<PhotoSelectScreen title="t" photos={[p('a'), p('b')]} onDeleted={onDeleted} onBack={() => {}} />);
    await user.click(screen.getByRole('button', { name: '사진 선택 a' }));
    await user.click(screen.getByRole('button', { name: /삭제 \(1\)/ }));
    // 확인 버튼은 다이얼로그 스코프 내에서 정확 매칭(액션바 "삭제 (1)"과 충돌 방지).
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));
    expect(deletePhotos).toHaveBeenCalledWith(['a']);
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
  it('2장 선택 → 일괄 삭제 → deletePhotos([a,b]) (결정6 핵심)', async () => {
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<PhotoSelectScreen title="t" photos={[p('a'), p('b')]} onDeleted={onDeleted} onBack={() => {}} />);
    await user.click(screen.getByRole('button', { name: '사진 선택 a' }));
    await user.click(screen.getByRole('button', { name: '사진 선택 b' }));
    await user.click(screen.getByRole('button', { name: /삭제 \(2\)/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));
    expect(deletePhotos).toHaveBeenCalledWith(['a', 'b']); // Set 삽입 순서 보존
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
  it('삭제 실패 → 에러 메시지 노출 + onDeleted 미호출 + 선택 유지(재시도 가능)', async () => {
    deletePhotos.mockRejectedValueOnce(new Error('boom'));
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<PhotoSelectScreen title="t" photos={[p('a'), p('b')]} onDeleted={onDeleted} onBack={() => {}} />);
    await user.click(screen.getByRole('button', { name: '사진 선택 a' }));
    await user.click(screen.getByRole('button', { name: /삭제 \(1\)/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(screen.getByText(/삭제에 실패/)).toBeInTheDocument());
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /삭제 \(1\)/ })).toBeEnabled(); // 선택 유지 → 재시도 가능
  });
  it('확인 다이얼로그 취소 → deletePhotos 미호출', async () => {
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<PhotoSelectScreen title="t" photos={[p('a'), p('b')]} onDeleted={onDeleted} onBack={() => {}} />);
    await user.click(screen.getByRole('button', { name: '사진 선택 a' }));
    await user.click(screen.getByRole('button', { name: /삭제 \(1\)/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));
    expect(deletePhotos).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
