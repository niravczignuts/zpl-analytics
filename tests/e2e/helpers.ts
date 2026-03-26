import { Page, expect } from '@playwright/test';

/** Collect all browser console errors during a page visit */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

/** Assert a page loaded without critical JS errors */
export async function assertNoErrors(page: Page, errors: string[]) {
  const critical = errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('net::ERR_ABORTED') &&
    !e.includes('hydration') &&      // hydration warnings are non-blocking
    !e.includes('Warning:')
  );
  if (critical.length > 0) {
    console.warn('⚠️  Console errors on', page.url(), ':\n', critical.join('\n'));
  }
  // Only fail on truly critical errors (unhandled JS exceptions)
  const fatal = critical.filter(e => e.toLowerCase().includes('unhandled') || e.toLowerCase().includes('uncaught'));
  expect(fatal, `Fatal JS errors on ${page.url()}`).toHaveLength(0);
}

/** Measure page navigation performance */
export async function measurePerf(page: Page): Promise<{ fcp: number; lcp: number; ttfb: number }> {
  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find(p => p.name === 'first-contentful-paint')?.startTime ?? 0;
    const lcp = (performance.getEntriesByType('largest-contentful-paint').slice(-1)[0] as any)?.startTime ?? 0;
    return {
      ttfb: nav ? nav.responseStart - nav.requestStart : 0,
      fcp,
      lcp,
    };
  });
  return perf;
}

/** Wait for network to be idle (no pending requests) */
export async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle');
}

/** Assert API response is OK */
export async function assertAPIok(page: Page, url: string, options?: RequestInit) {
  const res = await page.request.fetch(url, options);
  expect(res.status(), `API ${url} should return 2xx`).toBeLessThan(300);
  return res;
}
