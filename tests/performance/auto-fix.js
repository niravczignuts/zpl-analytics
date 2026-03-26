#!/usr/bin/env node
/**
 * ZPL Auto-Fix Script
 * Reads Playwright test results JSON and attempts automated fixes for common failures.
 * Run: node tests/performance/auto-fix.js
 */

const fs   = require('fs');
const path = require('path');

const RESULTS_FILE = path.join(__dirname, '../reports/results.json');
const ROOT         = path.join(__dirname, '../..');

// ── Colour helpers ────────────────────────────────────────────────────────────
const C = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
};

// ── Known fix patterns ────────────────────────────────────────────────────────
// Each entry: { match(error) → bool, fix(error) → { file, description, applied } }
const FIX_PATTERNS = [

  // 1. Missing useEffect / useState import
  {
    label: 'Missing React hook import',
    match: e => /is not defined/.test(e.message) && /(useState|useEffect|useRef|useCallback|useMemo)/.test(e.message),
    fix(e) {
      const hookName = e.message.match(/(useState|useEffect|useRef|useCallback|useMemo)/)?.[1];
      if (!hookName) return null;

      // Find all tsx files that reference the hook but may lack the import
      const files = findFiles('app', '.tsx').concat(findFiles('components', '.tsx'));
      const fixed = [];

      for (const file of files) {
        const src = fs.readFileSync(file, 'utf8');
        if (!src.includes(hookName)) continue;

        // Already imported?
        if (new RegExp(`import[^}]+${hookName}`).test(src)) continue;

        // Add the hook to the existing React import
        const newSrc = src.replace(
          /import\s*\{([^}]+)\}\s*from\s*['"]react['"]/,
          (m, hooks) => {
            if (hooks.includes(hookName)) return m;
            return `import { ${hooks.trim()}, ${hookName} } from 'react'`;
          }
        );
        if (newSrc !== src) {
          fs.writeFileSync(file, newSrc, 'utf8');
          fixed.push(path.relative(ROOT, file));
        }
      }
      return fixed.length ? { files: fixed, description: `Added ${hookName} to React imports` } : null;
    },
  },

  // 2. Hydration mismatch — onError DOM mutation
  {
    label: 'Hydration mismatch (onError DOM mutation)',
    match: e => /hydrat/i.test(e.message) && /onError/i.test(e.message || e.title || ''),
    fix(_e) {
      // Pattern: replace onError={() => { el.style.display='none' }} with useState pattern
      const files = findFiles('app', '.tsx').concat(findFiles('components', '.tsx'));
      const fixed = [];
      for (const file of files) {
        let src = fs.readFileSync(file, 'utf8');
        if (!src.includes('onError') || !src.includes('style.display')) continue;
        // Replace direct DOM style manipulation inside onError with state setter pattern
        const newSrc = src.replace(
          /onError=\{[^}]*\.style\.display\s*=\s*['"]none['"][^}]*\}/g,
          `onError={() => setLogoError(true)}`
        );
        if (newSrc !== src) {
          fs.writeFileSync(file, newSrc, 'utf8');
          fixed.push(path.relative(ROOT, file));
        }
      }
      return fixed.length ? { files: fixed, description: 'Replaced DOM-mutation onError with setState' } : null;
    },
  },

  // 3. next/image received null
  {
    label: 'next/image received null',
    match: e => /received null/i.test(e.message) || /Image.*null/i.test(e.message),
    fix(_e) {
      const files = findFiles('app', '.tsx').concat(findFiles('components', '.tsx'));
      const fixed = [];
      for (const file of files) {
        let src = fs.readFileSync(file, 'utf8');
        if (!src.includes("from 'next/image'") && !src.includes('from "next/image"')) continue;

        // Replace <Image fill ...> with <img>
        let newSrc = src
          // Remove next/image import
          .replace(/import\s+Image\s+from\s+['"]next\/image['"];\n?/g, '')
          // Replace <Image fill ... /> patterns (simplified)
          .replace(/<Image\s+([^>]*?)fill([^>]*?)\/>/gs, (m, before, after) => {
            const attrs = (before + after).replace(/\bfill\b/, '').trim();
            return `{/* eslint-disable-next-line @next/next/no-img-element */}\n<img ${attrs} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />`;
          });

        if (newSrc !== src) {
          fs.writeFileSync(file, newSrc, 'utf8');
          fixed.push(path.relative(ROOT, file));
        }
      }
      return fixed.length ? { files: fixed, description: 'Replaced next/image fill with plain <img>' } : null;
    },
  },

  // 4. API returning 404 — missing route file
  {
    label: 'API route 404',
    match: e => /404/.test(e.message) && /\/api\//.test(e.message || e.title || ''),
    fix(e) {
      const apiMatch = (e.message || e.title || '').match(/\/api\/[\w/-]+/);
      if (!apiMatch) return null;
      const routePath = apiMatch[0];
      const routeFile = path.join(ROOT, 'app', routePath, 'route.ts');
      if (fs.existsSync(routeFile)) return null;

      const dir = path.dirname(routeFile);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(routeFile, `import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
`);
      return { files: [path.relative(ROOT, routeFile)], description: `Created stub route for ${routePath}` };
    },
  },

  // 5. Missing 'use client' directive
  {
    label: "Missing 'use client' directive",
    match: e => /cannot use.*hook.*server/i.test(e.message) || /useState.*server/i.test(e.message),
    fix(e) {
      const fileMatch = e.location?.file;
      if (!fileMatch) return null;
      const absFile = path.isAbsolute(fileMatch) ? fileMatch : path.join(ROOT, fileMatch);
      if (!fs.existsSync(absFile)) return null;

      const src = fs.readFileSync(absFile, 'utf8');
      if (src.startsWith("'use client'") || src.startsWith('"use client"')) return null;

      fs.writeFileSync(absFile, `'use client';\n${src}`, 'utf8');
      return { files: [path.relative(ROOT, absFile)], description: "Added 'use client' directive" };
    },
  },
];

// ── Utilities ─────────────────────────────────────────────────────────────────
function findFiles(dir, ext) {
  const results = [];
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return results;

  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
        walk(path.join(d, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(path.join(d, entry.name));
      }
    }
  }
  walk(abs);
  return results;
}

function loadResults() {
  if (!fs.existsSync(RESULTS_FILE)) return null;
  return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
}

// ── Extract failures from Playwright JSON report ──────────────────────────────
function extractFailures(report) {
  const failures = [];

  function walk(suite) {
    if (!suite) return;
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        if (test.status !== 'passed') {
          const result = test.results?.[0];
          const errorMsg = result?.error?.message || result?.error || '';
          const errorTitle = spec.title || '';
          failures.push({
            title:    `${suite.title} › ${spec.title}`,
            status:   test.status,
            message:  errorMsg,
            location: result?.error?.location,
          });
        }
      }
    }
    for (const child of suite.suites || []) {
      walk(child);
    }
  }

  if (Array.isArray(report.suites)) {
    for (const s of report.suites) walk(s);
  } else if (report.suites) {
    walk(report.suites);
  }

  return failures;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n' + C.bold('╔══════════════════════════════════════════════════════╗'));
  console.log(       C.bold('║         ZPL Analytics — Auto-Fix Script               ║'));
  console.log(       C.bold('╚══════════════════════════════════════════════════════╝') + '\n');

  const report = loadResults();
  if (!report) {
    console.log(C.yellow('⚠  No test results found.'));
    console.log('  Run: npm run test:e2e -- --reporter=json 2>&1 | tee tests/reports/test-results.json\n');
    process.exit(0);
  }

  const failures = extractFailures(report);
  if (failures.length === 0) {
    console.log(C.green('✅ No failures found — nothing to fix!\n'));
    process.exit(0);
  }

  console.log(C.bold(`Found ${failures.length} failure(s):\n`));

  let fixCount  = 0;
  let skipCount = 0;

  for (const failure of failures) {
    console.log(`  ${C.red('✗')} ${failure.title}`);
    if (failure.message) {
      console.log(`    ${C.yellow('↳')} ${failure.message.substring(0, 120)}`);
    }

    let applied = false;
    for (const pattern of FIX_PATTERNS) {
      if (pattern.match(failure)) {
        const result = pattern.fix(failure);
        if (result) {
          console.log(`    ${C.green('✔ Fix applied:')} ${result.description}`);
          for (const f of result.files || []) {
            console.log(`      ${C.cyan('→')} ${f}`);
          }
          fixCount++;
          applied = true;
          break;
        }
      }
    }

    if (!applied) {
      console.log(`    ${C.yellow('⚠  No automatic fix available — manual review needed')}`);
      skipCount++;
    }
    console.log();
  }

  console.log('─'.repeat(55));
  console.log(`  ${C.green('Fixed automatically')} : ${fixCount}`);
  console.log(`  ${C.yellow('Needs manual review')} : ${skipCount}`);
  console.log('─'.repeat(55));

  if (fixCount > 0) {
    console.log(`\n  ${C.bold('Next step:')} Re-run tests to verify fixes:\n`);
    console.log('    npm run test:e2e\n');
  }
}

run().catch(err => {
  console.error(C.red('Auto-fix failed:'), err.message);
  process.exit(1);
});
