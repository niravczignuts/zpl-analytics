#!/usr/bin/env node
/**
 * ZPL Performance Monitor
 * Measures Core Web Vitals and API response times for every route.
 * Auto-starts the dev server if it is not already running.
 * Run: node tests/performance/perf-monitor.js
 */

const { chromium } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const BASE_URL  = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD  = process.env.APP_PASSWORD || 'Ai@1234';
const OUT_FILE  = path.join(__dirname, '../reports/perf-report.json');
const THRESHOLDS = {
  fcp:  3000,   // First Contentful Paint  < 3s
  lcp:  4000,   // Largest Contentful Paint < 4s
  ttfb:  800,   // Time To First Byte      < 800ms
  api:  2000,   // API response time       < 2s
};

const ROUTES = [
  { path: '/',                label: 'Dashboard'        },
  { path: '/teams',           label: 'Teams List'       },
  { path: '/players',         label: 'Players List'     },
  { path: '/matches',         label: 'Matches List'     },
  { path: '/auction',         label: 'Auction'          },
  { path: '/compare',         label: 'Compare'          },
  { path: '/strategy',        label: 'Strategy'         },
  { path: '/campaign',        label: 'Campaign'         },
  { path: '/admin',           label: 'Admin Home'       },
  { path: '/admin/players',   label: 'Admin Players'    },
  { path: '/admin/teams',     label: 'Admin Teams'      },
  { path: '/admin/season',    label: 'Admin Season'     },
];

const API_ENDPOINTS = [
  '/api/seasons',
  '/api/teams?season_id=season-2025',
  '/api/players?season_id=season-2025',
  '/api/matches?season_id=season-2025',
  '/api/auction?season_id=season-2025',
  '/api/dashboard?season_id=season-2025',
  '/api/leaderboard?season_id=season-2025&stat_type=batting',
  '/api/leaderboard?season_id=season-2025&stat_type=bowling',
  '/api/leaderboard?season_id=season-2025&stat_type=mvp',
];

// ── Server management ─────────────────────────────────────────────────────────

/** Returns true if BASE_URL is reachable. */
function isServerUp(url) {
  return new Promise(resolve => {
    const req = http.get(url, res => { res.resume(); resolve(res.statusCode < 600); });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

/** Polls until the server responds or timeout (ms) is exceeded. */
async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  process.stdout.write(`  Waiting for server at ${url} `);
  while (Date.now() < deadline) {
    if (await isServerUp(url)) { process.stdout.write(' ready\n'); return true; }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 1500));
  }
  process.stdout.write(' timed out\n');
  return false;
}

/** Starts `npm run dev` in the project root and returns the child process. */
function startDevServer(root) {
  const child = spawn('npm', ['run', 'dev'], {
    cwd: root,
    stdio: 'ignore',
    shell: true,   // required on Windows to resolve npm through cmd.exe
    env: process.env,
  });
  child.on('error', err => console.error('\x1b[31m  Dev server spawn error:\x1b[0m', err.message));
  return child;
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function colorize(val, threshold, unit = 'ms') {
  const ok = val <= threshold;
  const str = `${val.toFixed(0)}${unit}`;
  return ok ? `\x1b[32m${str}\x1b[0m` : `\x1b[31m${str}\x1b[0m`;
}

async function authenticate(context) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.close();
  return context;
}

async function measurePage(page, route) {
  const start = Date.now();

  // Capture console errors
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' });

  const elapsed = Date.now() - start;

  const vitals = await page.evaluate(() => {
    const nav   = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    return {
      ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : 0,
      fcp:  Math.round(paint.find(p => p.name === 'first-contentful-paint')?.startTime ?? 0),
      lcp:  Math.round(lcpEntries.slice(-1)[0]?.startTime ?? 0),
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : 0,
      loadComplete:     nav ? Math.round(nav.loadEventEnd - nav.startTime) : 0,
    };
  });

  return {
    route: route.path,
    label: route.label,
    wallTime: elapsed,
    ...vitals,
    consoleErrors: consoleErrors.filter(e => !e.includes('favicon')),
    pass: vitals.fcp < THRESHOLDS.fcp && vitals.ttfb < THRESHOLDS.ttfb,
  };
}

async function measureAPI(context, endpoint) {
  const page  = await context.newPage();
  const start = Date.now();
  const res   = await page.request.get(`${BASE_URL}${endpoint}`);
  const ms    = Date.now() - start;
  await page.close();
  return {
    endpoint,
    status:   res.status(),
    ms,
    pass:     res.status() < 300 && ms < THRESHOLDS.api,
  };
}

async function run() {
  console.log('\n\x1b[1m╔══════════════════════════════════════════════════════╗\x1b[0m');
  console.log(  '\x1b[1m║         ZPL Analytics — Performance Monitor           ║\x1b[0m');
  console.log(  '\x1b[1m╚══════════════════════════════════════════════════════╝\x1b[0m\n');

  // ── Ensure dev server is running ──────────────────────────────────────────
  const ROOT = path.join(__dirname, '../..');
  let devServer = null;

  const alreadyUp = await isServerUp(BASE_URL);
  if (!alreadyUp) {
    console.log('\x1b[33m⚡ Dev server not detected — starting it automatically...\x1b[0m');
    devServer = startDevServer(ROOT);

    const ready = await waitForServer(BASE_URL, 90_000);
    if (!ready) {
      if (devServer) devServer.kill();
      console.error('\x1b[31m✗ Dev server did not start within 90s. Aborting.\x1b[0m');
      console.error('  Try running  npm run dev  manually first, then re-run the monitor.\n');
      process.exit(1);
    }
  } else {
    console.log('\x1b[32m✓ Dev server already running at ' + BASE_URL + '\x1b[0m\n');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await authenticate(context);

  // ── Warmup phase ───────────────────────────────────────────────────────────
  // In dev mode Turbopack compiles each route on first request (~1-2s per new
  // segment). Visiting every route once before measuring ensures compilation
  // is cached so TTFB reflects real server/DB time, not compile time.
  console.log('\x1b[33m🔥 Warming up routes (pre-compiling Turbopack bundles)...\x1b[0m');
  const warmPage = await context.newPage();
  for (const route of ROUTES) {
    try {
      await warmPage.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch (_) { /* ignore warmup errors */ }
  }
  await warmPage.close();
  console.log('\x1b[32m✓ Warmup complete — measuring now\x1b[0m\n');

  const results = { pages: [], apis: [], summary: {}, timestamp: new Date().toISOString() };

  // ── Page Performance ───────────────────────────────────────────────────────
  console.log('\x1b[1m📄 PAGE PERFORMANCE\x1b[0m');
  console.log('─'.repeat(75));
  console.log(`${'Route'.padEnd(24)} ${'TTFB'.padStart(7)} ${'FCP'.padStart(7)} ${'LCP'.padStart(7)} ${'Load'.padStart(7)} ${'Errors'.padStart(6)}`);
  console.log('─'.repeat(75));

  const page = await context.newPage();
  for (const route of ROUTES) {
    const r = await measurePage(page, route);
    results.pages.push(r);
    const errCount = r.consoleErrors.length;
    console.log(
      `${r.label.padEnd(24)} ` +
      `${colorize(r.ttfb, THRESHOLDS.ttfb).padStart(14)} ` +
      `${colorize(r.fcp,  THRESHOLDS.fcp).padStart(14)} ` +
      `${colorize(r.lcp,  THRESHOLDS.lcp).padStart(14)} ` +
      `${String(r.loadComplete + 'ms').padStart(7)} ` +
      `${errCount > 0 ? '\x1b[31m' + errCount + '\x1b[0m' : '\x1b[32m0\x1b[0m'}`
    );
    if (errCount > 0) {
      r.consoleErrors.forEach(e => console.log(`  \x1b[33m↳ ${e.substring(0, 100)}\x1b[0m`));
    }
  }
  await page.close();

  // ── API Performance ────────────────────────────────────────────────────────
  console.log('\n\x1b[1m⚡ API PERFORMANCE\x1b[0m');
  console.log('─'.repeat(65));
  console.log(`${'Endpoint'.padEnd(50)} ${'Status'.padStart(6)} ${'Time'.padStart(7)}`);
  console.log('─'.repeat(65));

  for (const endpoint of API_ENDPOINTS) {
    const r = await measureAPI(context, endpoint);
    results.apis.push(r);
    const statusColor = r.status < 300 ? '\x1b[32m' : '\x1b[31m';
    console.log(
      `${endpoint.padEnd(50)} ` +
      `${statusColor}${String(r.status).padStart(6)}\x1b[0m ` +
      `${colorize(r.ms, THRESHOLDS.api).padStart(14)}`
    );
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const pageFails   = results.pages.filter(p => !p.pass).length;
  const apiFails    = results.apis.filter(a => !a.pass).length;
  const pageErrors  = results.pages.reduce((n, p) => n + p.consoleErrors.length, 0);
  const avgFcp      = results.pages.reduce((s, p) => s + p.fcp, 0) / results.pages.length;
  const avgTtfb     = results.pages.reduce((s, p) => s + p.ttfb, 0) / results.pages.length;
  const avgApiMs    = results.apis.reduce((s, a) => s + a.ms, 0) / results.apis.length;

  results.summary = { pageFails, apiFails, pageErrors, avgFcp, avgTtfb, avgApiMs };

  console.log('\n\x1b[1m📊 SUMMARY\x1b[0m');
  console.log('─'.repeat(45));
  console.log(`  Pages checked      : ${results.pages.length}`);
  console.log(`  Page failures      : ${pageFails > 0 ? '\x1b[31m' + pageFails + '\x1b[0m' : '\x1b[32m0\x1b[0m'}`);
  console.log(`  Console errors     : ${pageErrors > 0 ? '\x1b[31m' + pageErrors + '\x1b[0m' : '\x1b[32m0\x1b[0m'}`);
  console.log(`  API endpoints      : ${results.apis.length}`);
  console.log(`  API failures       : ${apiFails > 0 ? '\x1b[31m' + apiFails + '\x1b[0m' : '\x1b[32m0\x1b[0m'}`);
  console.log(`  Avg FCP            : ${colorize(avgFcp, THRESHOLDS.fcp)}`);
  console.log(`  Avg TTFB           : ${colorize(avgTtfb, THRESHOLDS.ttfb)}`);
  console.log(`  Avg API response   : ${colorize(avgApiMs, THRESHOLDS.api)}`);

  const overall = pageFails === 0 && apiFails === 0;
  console.log(`\n  Overall            : ${overall ? '\x1b[32m✅ PASS\x1b[0m' : '\x1b[31m❌ ISSUES FOUND\x1b[0m'}`);
  console.log('─'.repeat(45));

  // Save report
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n  Report saved → ${OUT_FILE}\n`);

  await browser.close();
  if (devServer) devServer.kill();
  process.exit(overall ? 0 : 1);
}

run().catch(err => {
  console.error('\x1b[31mPerformance monitor failed:\x1b[0m', err.message);
  process.exit(1);
});
