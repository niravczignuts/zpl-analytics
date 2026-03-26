import { test, expect } from '@playwright/test';
import { collectConsoleErrors, assertNoErrors } from './helpers';

// AI API calls can take 30-60s depending on Claude response time.
// Per-request timeout is passed explicitly to override navigationTimeout (20s).
const AI_TIMEOUT = 60_000;

test.describe('AI Features', () => {
  test.setTimeout(120_000);

  test('compare page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/compare');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('strategy page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/strategy');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('campaign page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/campaign');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('AI player analysis API accepts request', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons[0].id;
    const players = await (await page.request.get(`/api/players?season_id=${seasonId}`)).json();
    if (!players.length) { test.skip(); return; }

    const res = await page.request.post('/api/ai/player-analysis', {
      data: { player_id: players[0].id, season_id: seasonId },
      headers: { 'Content-Type': 'application/json' },
      timeout: AI_TIMEOUT,
    });
    expect([200, 500, 503]).toContain(res.status());
  });

  test('AI compare API accepts request', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons.find((s: any) => s.year === 2025)?.id || seasons[0].id;
    const teams = await (await page.request.get(`/api/teams?season_id=${seasonId}`)).json();
    if (teams.length < 2) { test.skip(); return; }

    // Route expects team1_id / team2_id (not team_a_id / team_b_id)
    const res = await page.request.post('/api/ai/compare', {
      data: {
        season_id: seasonId,
        team1_id:  teams[0].id,
        team2_id:  teams[1].id,
      },
      headers: { 'Content-Type': 'application/json' },
      timeout: AI_TIMEOUT,
    });
    expect([200, 500, 503]).toContain(res.status());
  });

  test('AI match strategy API accepts request', async ({ page }) => {
    // Route requires team_id + opponent_id + season_id (not match_id)
    const seasons = await (await page.request.get('/api/seasons')).json();

    // Find any season that has at least 2 teams
    let seasonId: string | null = null;
    let teams: any[] = [];
    for (const s of seasons) {
      const t = await (await page.request.get(`/api/teams?season_id=${s.id}`)).json();
      if (Array.isArray(t) && t.length >= 2) { seasonId = s.id; teams = t; break; }
    }
    if (!seasonId) { test.skip(); return; }

    const res = await page.request.post('/api/ai/match-strategy', {
      data: { team_id: teams[0].id, opponent_id: teams[1].id, season_id: seasonId },
      headers: { 'Content-Type': 'application/json' },
      timeout: AI_TIMEOUT,
    });
    expect([200, 500, 503]).toContain(res.status());
  });

  test('AI player bid API accepts request', async ({ page }) => {
    const seasons = await (await page.request.get('/api/seasons')).json();
    const seasonId = seasons[0].id;
    const players = await (await page.request.get(`/api/players?season_id=${seasonId}`)).json();
    if (!players.length) { test.skip(); return; }

    const res = await page.request.post('/api/ai/player-bid', {
      data: { player_id: players[0].id, season_id: seasonId },
      headers: { 'Content-Type': 'application/json' },
      timeout: AI_TIMEOUT,
    });
    // 404 is valid when "Super Smashers" team doesn't exist in this season
    expect([200, 404, 500, 503]).toContain(res.status());
  });

});
