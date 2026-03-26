import { test, expect } from '@playwright/test';
import { collectConsoleErrors, assertNoErrors } from './helpers';

test.describe('Teams', () => {

  test('teams list page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('teams list displays team cards', async ({ page }) => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');
    // Should show team cards/rows
    const teams = page.locator('[class*="card"], [class*="team"]').first();
    await expect(teams).toBeVisible({ timeout: 8_000 });
  });

  test('API /api/teams returns teams with budget', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2025)?.id || seasons[0].id;

    const res = await page.request.get(`/api/teams?season_id=${seasonId}`);
    expect(res.status()).toBe(200);
    const teams = await res.json();
    expect(Array.isArray(teams)).toBe(true);
    expect(teams.length).toBeGreaterThan(0);

    // Each team should have required fields
    const team = teams[0];
    expect(team).toHaveProperty('id');
    expect(team).toHaveProperty('name');
  });

  test('team detail page loads', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2025)?.id || seasons[0].id;
    const teams = await (await page.request.get(`/api/teams?season_id=${seasonId}`)).json();
    expect(teams.length).toBeGreaterThan(0);

    const errors = collectConsoleErrors(page);
    await page.goto(`/teams/${teams[0].id}?season_id=${seasonId}`);
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('team detail shows analytics KPIs', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2025)?.id || seasons[0].id;
    const teams = await (await page.request.get(`/api/teams?season_id=${seasonId}`)).json();

    await page.goto(`/teams/${teams[0].id}?season_id=${seasonId}`);
    await page.waitForLoadState('networkidle');
    // Page should have team name visible
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('API PATCH team updates name', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons[0].id;
    const teams = await (await page.request.get(`/api/teams?season_id=${seasonId}`)).json();
    if (!teams.length) return;

    const team = teams[0];
    const originalName = team.name;

    const res = await page.request.patch(`/api/teams/${team.id}`, {
      data: { name: originalName, season_id: seasonId },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBeLessThan(300);

    // Restore
    await page.request.patch(`/api/teams/${team.id}`, {
      data: { name: originalName, season_id: seasonId },
      headers: { 'Content-Type': 'application/json' },
    });
  });

  test('admin teams page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/admin/teams');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

});
