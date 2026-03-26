import { test, expect } from '@playwright/test';

// These tests deliberately use a fresh context (no saved auth)
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/ZPL/i);
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeDisabled(); // disabled when empty
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=/incorrect/i')).toBeVisible({ timeout: 8_000 });
  });

  test('correct password logs in and redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="password"]', 'Ai@1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 });
    expect(page.url()).not.toContain('/login');
  });

  test('unauthenticated access redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated API returns 401', async ({ page }) => {
    const res = await page.request.get('/api/seasons');
    expect(res.status()).toBe(401);
  });

  test('show/hide password toggle works', async ({ page }) => {
    await page.goto('/login');
    const input = page.locator('input[type="password"]');
    await input.fill('testpass');
    // click eye icon button
    await page.locator('button[type="button"]').click();
    await expect(page.locator('input[type="text"]')).toBeVisible();
    // click again to hide
    await page.locator('button[type="button"]').click();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('submit disabled when password empty', async ({ page }) => {
    await page.goto('/login');
    const btn = page.locator('button[type="submit"]');
    await expect(btn).toBeDisabled();
    await page.fill('input[type="password"]', 'x');
    await expect(btn).toBeEnabled();
    await page.fill('input[type="password"]', '');
    await expect(btn).toBeDisabled();
  });

  test('redirects back to original page after login', async ({ page }) => {
    await page.goto('/teams');
    await page.waitForURL(/\/login\?from/);
    await page.fill('input[type="password"]', 'Ai@1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/teams/, { timeout: 15_000 });
    expect(page.url()).toContain('/teams');
  });

});
