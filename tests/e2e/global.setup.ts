/**
 * Global Setup — runs once before all tests.
 * Logs in and saves auth state so every test starts authenticated.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '../.auth/session.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('input[type="password"]')).toBeVisible();

  await page.fill('input[type="password"]', 'Ai@1234');
  await page.click('button[type="submit"]');

  // Wait until redirected away from /login
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 });

  // Save storage state (cookies + localStorage)
  await page.context().storageState({ path: AUTH_FILE });
  console.log('✅ Auth session saved');
});
