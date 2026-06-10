import { test, expect } from '@playwright/test';

// Phase 0 게이트: 빌드된 앱에서 두 탭이 렌더된다.
// 실행 전 1회: `npx playwright install chromium`
test('홈에서 지역지도/경로지도 두 탭이 보인다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: '지역지도' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '경로지도' })).toBeVisible();
});
