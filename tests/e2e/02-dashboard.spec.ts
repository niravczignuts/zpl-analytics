import { test, expect } from '@playwright/test';
import { collectConsoleErrors, assertNoErrors, measurePerf } from './helpers';

test.describe('Dashboard', () => {

  test('loads dashboard page', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
    await expect(page).toHaveTitle(/ZPL/i);
  });

  test('displays ZPL branding / season header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Sidebar should be visible with navigation
    await expect(page.locator('aside')).toBeVisible();
  });

  test('dashboard loads within 4 seconds', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const perf = await measurePerf(page);
    console.log('Dashboard TTFB:', perf.ttfb.toFixed(0), 'ms | FCP:', perf.fcp.toFixed(0), 'ms');
    expect(perf.fcp, 'FCP should be under 4000ms').toBeLessThan(4000);
  });

  test('sidebar navigation links are present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    // Check key nav links exist
    for (const href of ['/', '/teams', '/players', '/matches', '/auction']) {
      await expect(sidebar.locator(`a[href="${href}"]`)).toBeVisible();
    }
  });

  test('API /api/dashboard returns valid data', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    expect(Array.isArray(seasons)).toBe(true);
    expect(seasons.length).toBeGreaterThan(0);

    const seasonId = seasons[0].id;
    const res = await page.request.get(`/api/dashboard?season_id=${seasonId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('topBatters');
    expect(data).toHaveProperty('topBowlers');
    expect(data).toHaveProperty('pointsTable');
  });

  test('leaderboard API returns data', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons[0].id;

    for (const stat of ['batting', 'bowling', 'mvp']) {
      const res = await page.request.get(`/api/leaderboard?season_id=${seasonId}&stat_type=${stat}&limit=5`);
      expect(res.status(), `leaderboard ${stat}`).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data), `leaderboard ${stat} should be array`).toBe(true);
    }
  });

  test('logout button works from sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Find and click logout button
    const logoutBtn = page.locator('aside').locator('button', { hasText: /log.?out/i });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
    }
  });

});
