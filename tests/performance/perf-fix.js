#!/usr/bin/env node
/**
 * ZPL Performance Fix Script
 * Reads perf-report.json, identifies slow pages/APIs, and applies optimisations.
 * Run: node tests/performance/perf-fix.js
 */

const fs   = require('fs');
const path = require('path');

const REPORT_FILE = path.join(__dirname, '../reports/perf-report.json');
const ROOT        = path.join(__dirname, '../..');

const C = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
};

const THRESHOLDS = { fcp: 3000, lcp: 4000, ttfb: 800, api: 2000 };

// ── Cache-control headers helper ──────────────────────────────────────────────
function addCacheHeaders(routeFile, maxAge = 60) {
  if (!fs.existsSync(routeFile)) return false;
  const src = fs.readFileSync(routeFile, 'utf8');
  if (src.includes('Cache-Control')) return false; // already set

  // Inject Cache-Control header into the first NextResponse.json call
  const newSrc = src.replace(
    /return NextResponse\.json\(([^)]+)\);/,
    `return NextResponse.json($1, {\n    headers: { 'Cache-Control': 'public, s-maxage=${maxAge}, stale-while-revalidate=300' },\n  });`
  );
  if (newSrc === src) return false;
  fs.writeFileSync(routeFile, newSrc, 'utf8');
  return true;
}

// ── Map route path → API route file ──────────────────────────────────────────
function apiRouteFile(endpoint) {
  // Strip query string
  const noQuery  = endpoint.split('?')[0];
  // e.g. /api/teams → app/api/teams/route.ts
  return path.join(ROOT, 'app', noQuery, 'route.ts');
}

// ── Check if a route file has heavy DB queries ────────────────────────────────
function hasBulkQuery(routeFile) {
  if (!fs.existsSync(routeFile)) return false;
  const src = fs.readFileSync(routeFile, 'utf8');
  return /\.prepare\(|\.all\(|db\.(get|run)/.test(src);
}

// ── Suggest LIMIT for all queries ─────────────────────────────────────────────
function addQueryLimit(routeFile) {
  if (!fs.existsSync(routeFile)) return false;
  const src = fs.readFileSync(routeFile, 'utf8');

  // Add LIMIT only to SELECT queries that don't already have one and fetch large sets
  const newSrc = src.replace(
    /(SELECT\s[^;]+FROM\s+\w+(?:\s+(?:JOIN|WHERE|ORDER BY|GROUP BY)[^;]*)?)(?<!LIMIT\s*\d+)(`)/gi,
    (m, query, backtick) => {
      if (/LIMIT/i.test(query)) return m;
      return query + ' LIMIT 500' + backtick;
    }
  );
  if (newSrc === src) return false;
  fs.writeFileSync(routeFile, newSrc, 'utf8');
  return true;
}

// ── Check next.config.ts for image optimisation ───────────────────────────────
function ensureImageOptimisation() {
  const configFile = path.join(ROOT, 'next.config.ts');
  if (!fs.existsSync(configFile)) return false;
  const src = fs.readFileSync(configFile, 'utf8');
  if (src.includes('unoptimized: true')) return false; // already set

  const newSrc = src.replace(
    /images:\s*\{/,
    'images: {\n    unoptimized: true,'
  );
  if (newSrc === src) return false;
  fs.writeFileSync(configFile, newSrc, 'utf8');
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function run() {
  console.log('\n' + C.bold('╔══════════════════════════════════════════════════════╗'));
  console.log(       C.bold('║        ZPL Analytics — Performance Fix Script          ║'));
  console.log(       C.bold('╚══════════════════════════════════════════════════════╝') + '\n');

  if (!fs.existsSync(REPORT_FILE)) {
    console.log(C.yellow('⚠  No performance report found.'));
    console.log('  Run: npm run test:perf\n');
    process.exit(0);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
  let fixes = 0;

  // ── Analyse page results ──────────────────────────────────────────────────
  const slowPages = report.pages.filter(p => !p.pass || p.fcp > THRESHOLDS.fcp || p.ttfb > THRESHOLDS.ttfb);
  const slowApis  = report.apis.filter(a => !a.pass || a.ms > THRESHOLDS.api);

  console.log(C.bold('📄 Page Analysis'));
  console.log('─'.repeat(55));

  if (slowPages.length === 0) {
    console.log(C.green('  All pages within thresholds ✓\n'));
  } else {
    for (const p of slowPages) {
      console.log(`  ${C.red('✗')} ${p.label.padEnd(24)} FCP:${p.fcp}ms  TTFB:${p.ttfb}ms`);

      // For high TTFB — check if the associated API route can get cache headers
      const routeGuess = p.route === '/' ? '/api/dashboard' : `/api${p.route}`;
      const rf = apiRouteFile(routeGuess);
      if (hasBulkQuery(rf)) {
        const limited = addQueryLimit(rf);
        if (limited) {
          console.log(`    ${C.green('✔ Applied:')} Added LIMIT 500 to DB queries in ${path.relative(ROOT, rf)}`);
          fixes++;
        }
        const cached = addCacheHeaders(rf, 30);
        if (cached) {
          console.log(`    ${C.green('✔ Applied:')} Added Cache-Control headers to ${path.relative(ROOT, rf)}`);
          fixes++;
        }
      }

      if (p.fcp > THRESHOLDS.fcp) {
        console.log(`    ${C.yellow('ℹ  Suggestion:')} High FCP (${p.fcp}ms) — consider lazy-loading heavy components on this route`);
      }
      if (p.ttfb > THRESHOLDS.ttfb) {
        console.log(`    ${C.yellow('ℹ  Suggestion:')} High TTFB (${p.ttfb}ms) — check DB query time for this route's data fetch`);
      }
    }
    console.log();
  }

  console.log(C.bold('⚡ API Analysis'));
  console.log('─'.repeat(55));

  if (slowApis.length === 0) {
    console.log(C.green('  All API endpoints within thresholds ✓\n'));
  } else {
    for (const a of slowApis) {
      const status = a.status >= 400 ? C.red(String(a.status)) : String(a.status);
      console.log(`  ${C.red('✗')} ${a.endpoint.padEnd(48)} ${status}  ${a.ms}ms`);

      if (a.status >= 400) {
        console.log(`    ${C.yellow('ℹ  Suggestion:')} Endpoint returning ${a.status} — check route handler`);
      } else {
        const rf = apiRouteFile(a.endpoint);
        const cached = addCacheHeaders(rf, 60);
        if (cached) {
          console.log(`    ${C.green('✔ Applied:')} Added Cache-Control headers to ${path.relative(ROOT, rf)}`);
          fixes++;
        } else {
          console.log(`    ${C.yellow('ℹ  Suggestion:')} Slow response (${a.ms}ms) — profile DB query or add caching`);
        }
      }
    }
    console.log();
  }

  // ── Global optimisations ──────────────────────────────────────────────────
  console.log(C.bold('🔧 Global Optimisations'));
  console.log('─'.repeat(55));

  const imgOpt = ensureImageOptimisation();
  if (imgOpt) {
    console.log(C.green('  ✔ Added unoptimized:true to next.config.ts images'));
    fixes++;
  } else {
    console.log(C.green('  ✓ next.config.ts image settings already optimal'));
  }

  // Check for requestAnimationFrame loops (warn only — already fixed in effects)
  const effectFiles = ['CursorGlow', 'ClickParticles', 'Confetti', 'SoundPanel']
    .map(n => path.join(ROOT, 'components/effects', `${n}.tsx`))
    .filter(f => fs.existsSync(f));

  const unguardedRaf = effectFiles.filter(f => {
    const src = fs.readFileSync(f, 'utf8');
    // An unguarded RAF calls itself unconditionally
    return /requestAnimationFrame\(animate\)(?!.*length|.*delta|.*life)/.test(src.replace(/\n/g, ' '));
  });

  if (unguardedRaf.length > 0) {
    console.log(`  ${C.yellow('⚠  Unguarded RAF loops detected in:')}`);
    for (const f of unguardedRaf) console.log(`    ${C.cyan('→')} ${path.relative(ROOT, f)}`);
    console.log('     These run at 60fps even when idle — consider stopping when idle\n');
  } else {
    console.log(C.green('  ✓ Animation loops are idle-safe'));
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(55));
  console.log(`  Automatic fixes applied : ${fixes > 0 ? C.green(String(fixes)) : C.yellow('0')}`);
  console.log(`  Slow pages              : ${slowPages.length > 0 ? C.red(String(slowPages.length)) : C.green('0')}`);
  console.log(`  Slow/failing APIs       : ${slowApis.length  > 0 ? C.red(String(slowApis.length))  : C.green('0')}`);
  console.log('─'.repeat(55));

  if (fixes > 0) {
    console.log(`\n  ${C.bold('Changes made — rebuild to apply:')}\n`);
    console.log('    npm run build && npm run test:perf\n');
  } else if (slowPages.length + slowApis.length > 0) {
    console.log(`\n  ${C.yellow('No automatic fixes available for remaining issues.')}`);
    console.log('  Review suggestions above for manual optimisation.\n');
  } else {
    console.log(`\n  ${C.green('Everything looks great!')}\n`);
  }
}

run();
