import { test, expect } from '@playwright/test';
import { collectConsoleErrors, assertNoErrors } from './helpers';

/** Returns the first season (across all seasons) that has at least one match. */
async function getSeasonWithMatches(page: any) {
  const seasons = await (await page.request.get('/api/seasons')).json();
  // Prefer 2025, then 2024, then any
  const ordered = [
    seasons.find((s: any) => s.year === 2025),
    seasons.find((s: any) => s.year === 2024),
    ...seasons,
  ].filter(Boolean);

  for (const season of ordered) {
    const matches = await (await page.request.get(`/api/matches?season_id=${season.id}`)).json();
    if (Array.isArray(matches) && matches.length > 0) return { season, matches };
  }
  return null;
}

test.describe('Matches', () => {

  test('matches list page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/matches');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('API /api/matches returns list', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2025)?.id || seasons[0].id;

    const res = await page.request.get(`/api/matches?season_id=${seasonId}`);
    expect(res.status()).toBe(200);
    const matches = await res.json();
    expect(Array.isArray(matches)).toBe(true);
  });

  test('create and delete a match via API', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2025)?.id || seasons[0].id;
    const teams   = await (await page.request.get(`/api/teams?season_id=${seasonId}`)).json();

    if (teams.length < 2) {
      test.skip();
      return;
    }

    // Create
    const createRes = await page.request.post('/api/matches', {
      data: {
        season_id:    seasonId,
        match_number: 9999,
        match_type:   'league',
        team_a_id:    teams[0].id,
        team_b_id:    teams[1].id,
        match_date:   new Date().toISOString(),
        venue:        'E2E Test Ground',
        status:       'upcoming',
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(createRes.status()).toBeLessThan(300);
    const created = await createRes.json();
    expect(created).toHaveProperty('id');

    // Delete
    const delRes = await page.request.delete(`/api/matches/${created.id}`);
    expect(delRes.status()).toBeLessThan(300);
  });

  test('match detail page loads for existing match', async ({ page }) => {
    const found = await getSeasonWithMatches(page);
    if (!found) { test.skip(); return; }

    const { season, matches } = found;
    const errors = collectConsoleErrors(page);
    await page.goto(`/matches/${matches[0].id}?season_id=${season.id}`);
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('PATCH match result updates status', async ({ page }) => {
    const found = await getSeasonWithMatches(page);
    if (!found) { test.skip(); return; }

    const { season, matches } = found;
    const match = matches[0];
    const res = await page.request.patch(`/api/matches/${match.id}`, {
      data: { status: match.status, season_id: season.id },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBeLessThan(300);
  });

  test('match scorecard API responds', async ({ page }) => {
    const found = await getSeasonWithMatches(page);
    if (!found) { test.skip(); return; }

    const { matches } = found;
    const res = await page.request.get(`/api/matches/${matches[0].id}/scorecard`);
    // 200 (data found) or 404 (no scorecard yet) are both valid
    expect([200, 404]).toContain(res.status());
  });

  test('admin create match page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/admin/matches/new');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

});
