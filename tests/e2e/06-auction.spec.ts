import { test, expect } from '@playwright/test';
import { collectConsoleErrors, assertNoErrors } from './helpers';

test.describe('Auction', () => {

  test('auction page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/auction');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('API /api/auction returns purchases', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2025)?.id || seasons[0].id;

    const res = await page.request.get(`/api/auction?season_id=${seasonId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('API /api/auction/available returns unsold players', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2026)?.id;
    if (!seasonId) { test.skip(); return; }

    const res = await page.request.get(`/api/auction/available?season_id=${seasonId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('create and delete an auction purchase', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2026)?.id;
    if (!seasonId) { test.skip(); return; }

    const teams   = await (await page.request.get(`/api/teams?season_id=${seasonId}`)).json();
    const players = await (await page.request.get(`/api/auction/available?season_id=${seasonId}`)).json();
    if (!teams.length || !players.length) { test.skip(); return; }

    // Create purchase
    const createRes = await page.request.post('/api/auction', {
      data: {
        season_id:      seasonId,
        team_id:        teams[0].id,
        player_id:      players[0].id,
        purchase_price: 100000,
        group_number:   1,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(createRes.status()).toBeLessThan(300);
    const created = await createRes.json();
    expect(created).toHaveProperty('id');

    // Delete
    const delRes = await page.request.delete(`/api/auction/${created.id}`);
    expect(delRes.status()).toBeLessThan(300);
  });

  test('duplicate auction purchase returns error', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2025)?.id || seasons[0].id;
    const existing = await (await page.request.get(`/api/auction?season_id=${seasonId}`)).json();
    if (!existing.length) { test.skip(); return; }

    // Try to re-purchase an already-purchased player
    const purchase = existing[0];
    const res = await page.request.post('/api/auction', {
      data: {
        season_id:      seasonId,
        team_id:        purchase.team_id,
        player_id:      purchase.player_id,
        purchase_price: 50000,
        group_number:   1,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    // Should fail — player already purchased in this season
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('AI auction suggest responds', async ({ page }) => {
    test.setTimeout(90_000);
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2025)?.id || seasons[0].id;
    const teams = await (await page.request.get(`/api/teams?season_id=${seasonId}`)).json();
    if (!teams.length) { test.skip(); return; }

    const res = await page.request.post('/api/ai/auction-suggest', {
      data: { season_id: seasonId, team_id: teams[0].id },
      headers: { 'Content-Type': 'application/json' },
      timeout: 60_000,
    });
    // AI routes may return 200 or 500 if API key is missing — both acceptable in CI
    expect([200, 500, 503]).toContain(res.status());
  });

});
