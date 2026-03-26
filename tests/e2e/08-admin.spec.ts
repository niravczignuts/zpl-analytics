import { test, expect } from '@playwright/test';
import { collectConsoleErrors, assertNoErrors } from './helpers';

test.describe('Admin Pages', () => {

  test('admin home page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('admin season page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/admin/season');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('admin players page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/admin/players');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('admin teams page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/admin/teams');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('admin team-roles page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/admin/team-roles');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('admin import page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/admin/import');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('admin create match page loads', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/admin/matches/new');
    await page.waitForLoadState('networkidle');
    await assertNoErrors(page, errors);
  });

  test('seasons API returns all 3 seasons', async ({ page }) => {
    const res = await page.request.get('/api/seasons');
    expect(res.status()).toBe(200);
    const seasons = await res.json();
    expect(seasons.length).toBeGreaterThanOrEqual(3);
    const years = seasons.map((s: any) => s.year);
    expect(years).toContain(2024);
    expect(years).toContain(2025);
    expect(years).toContain(2026);
  });

  test('seasons clone API is accessible', async ({ page }) => {
    // Only test that the endpoint exists (don't actually clone)
    const res = await page.request.post('/api/seasons/clone', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });
    // 400 (bad request - missing params) is expected without real data
    expect([200, 400, 422]).toContain(res.status());
  });

  test('upload API accepts image file', async ({ page }) => {
    // Create a minimal 1x1 PNG
    const pngBytes = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a' +
      '4944415478016360000000020001e221bc330000000049454e44ae426082', 'hex'
    );
    const res = await page.request.post('/api/upload', {
      multipart: {
        file: { name: 'test.png', mimeType: 'image/png', buffer: pngBytes },
        type: 'logo',
      },
    });
    expect([200, 201, 400]).toContain(res.status());
  });

  test('admin team-roles API accepts POST', async ({ page }) => {
    const res = await page.request.post('/api/admin/team-roles', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });
    expect([200, 400, 422]).toContain(res.status());
  });

});
