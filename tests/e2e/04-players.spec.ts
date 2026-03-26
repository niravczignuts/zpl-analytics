import { test, expect } from '@playwright/test';
import { collectConsoleErrors, assertNoErrors } from './helpers';
import path from 'path';

test.describe('Players', () => {

  test('players list page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/players');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('players list shows player cards', async ({ page }) => {
    await page.goto('/players');
    await page.waitForLoadState('networkidle');
    const cards = page.locator('[class*="card"], [class*="player"]');
    await expect(cards.first()).toBeVisible({ timeout: 8_000 });
  });

  test('API /api/players returns list with filters', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2025)?.id || seasons[0].id;

    const res = await page.request.get(`/api/players?season_id=${seasonId}`);
    expect(res.status()).toBe(200);
    const players = await res.json();
    expect(Array.isArray(players)).toBe(true);
    expect(players.length).toBeGreaterThan(0);

    // Validate player shape
    const p = players[0];
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('first_name');
    expect(p).toHaveProperty('last_name');
  });

  test('search filter narrows results', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons[0].id;
    const all = await (await page.request.get(`/api/players?season_id=${seasonId}`)).json();
    const firstName = all[0].first_name;

    const filtered = await (await page.request.get(
      `/api/players?season_id=${seasonId}&search=${encodeURIComponent(firstName)}`
    )).json();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThanOrEqual(all.length);
  });

  test('gender filter works', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons[0].id;

    const male   = await (await page.request.get(`/api/players?season_id=${seasonId}&gender=male`)).json();
    const female = await (await page.request.get(`/api/players?season_id=${seasonId}&gender=female`)).json();
    expect(Array.isArray(male)).toBe(true);
    expect(Array.isArray(female)).toBe(true);
    // No female player should appear in male results
    if (female.length > 0) {
      const femaleId = female[0].id;
      expect(male.find((p: any) => p.id === femaleId)).toBeUndefined();
    }
  });

  test('player detail page loads', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons[0].id;
    const players = await (await page.request.get(`/api/players?season_id=${seasonId}`)).json();
    expect(players.length).toBeGreaterThan(0);

    const errors = collectConsoleErrors(page);
    await page.goto(`/players/${players[0].id}`);
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('player detail API returns stats', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons[0].id;
    const players = await (await page.request.get(`/api/players?season_id=${seasonId}`)).json();

    const res = await page.request.get(`/api/players/${players[0].id}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('first_name');
  });

  test('player remarks API works', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2025)?.id || seasons[0].id;
    const players = await (await page.request.get(`/api/players?season_id=${seasonId}`)).json();
    if (!players.length) { test.skip(); return; }
    const playerId = players[0].id;

    // GET remarks — should return an array (empty is fine)
    const getRes = await page.request.get(`/api/players/${playerId}/remarks`);
    expect(getRes.status()).toBe(200);
    expect(Array.isArray(await getRes.json())).toBe(true);

    // POST a remark
    const postRes = await page.request.post(`/api/players/${playerId}/remarks`, {
      data: { season_id: seasonId, remark_type: 'general', remark: 'E2E test remark' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(postRes.status()).toBeLessThan(300);
  });

  test('bulk import rejects invalid file type', async ({ page }) => {
    const res = await page.request.post('/api/players/bulk-import', {
      multipart: {
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('not a spreadsheet'),
        },
      },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('bulk import accepts valid CSV', async ({ page }) => {
    const csv = [
      'name,gender,player_role,batting_hand,bowling_style',
      'E2E Test Player,male,All-Rounder,RHB,Right-arm fast',
    ].join('\n');

    const res = await page.request.post('/api/players/bulk-import', {
      multipart: {
        file: {
          name: 'players.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(csv),
        },
      },
    });
    expect(res.status()).toBeLessThan(300);
    const data = await res.json();
    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('total');
  });

  test('admin players page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/admin/players');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

});
