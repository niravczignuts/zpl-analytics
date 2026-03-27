/**
 * Import 2024 and 2025 stats CSVs into Vercel (Supabase) via the app API.
 *
 * Usage:
 *   node scripts/import-stats.mjs https://your-app.vercel.app
 *
 * Or set VERCEL_URL env var:
 *   VERCEL_URL=https://your-app.vercel.app node scripts/import-stats.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOWNLOADS = join(__dirname, '..', '..', '..', 'Downloads');

const BASE_URL = process.env.VERCEL_URL || process.argv[2];
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN || process.argv[3] || '';

if (!BASE_URL) {
  console.error('Usage: node scripts/import-stats.mjs https://your-app.vercel.app [bypass-token]');
  console.error('       Or set VERCEL_URL and VERCEL_BYPASS_TOKEN env vars');
  process.exit(1);
}
const URL = BASE_URL.replace(/\/$/, '');
const PASSWORD = process.env.APP_PASSWORD || 'Ai@1234';

// Build headers that bypass Vercel Deployment Protection if token provided
function bypassHeaders() {
  if (!BYPASS_TOKEN) return {};
  return { 'x-vercel-protection-bypass': BYPASS_TOKEN };
}

// ─── Files mapping ────────────────────────────────────────────────────────────
// 936991  = 2024 season (10 teams)
// 1410878 = 2025 season (8 teams)
const FILES = [
  { season_year: 2024, type: 'batting',  file: '936991_batting_leaderboard (1).csv' },
  { season_year: 2024, type: 'bowling',  file: '936991_bowling_leaderboard (1).csv' },
  { season_year: 2024, type: 'fielding', file: '936991_fielding_leaderboard (1).csv' },
  { season_year: 2024, type: 'mvp',      file: '936991_mvp_leaderboard (1).csv' },
  { season_year: 2025, type: 'batting',  file: '1410878_batting_leaderboard.csv' },
  { season_year: 2025, type: 'bowling',  file: '1410878_bowling_leaderboard.csv' },
  { season_year: 2025, type: 'fielding', file: '1410878_fielding_leaderboard.csv' },
  { season_year: 2025, type: 'mvp',      file: '1410878_mvp_leaderboard.csv' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function login() {
  const res = await fetch(`${URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bypassHeaders() },
    body: JSON.stringify({ password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  // Extract Set-Cookie header
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('No auth cookie received');
  // Parse cookie value
  const match = setCookie.match(/zpl_auth=([^;]+)/);
  if (!match) throw new Error('Could not parse zpl_auth cookie');
  console.log('✓ Logged in');
  return `zpl_auth=${match[1]}`;
}

async function getSeasons(cookie) {
  const res = await fetch(`${URL}/api/seasons`, { headers: { Cookie: cookie, ...bypassHeaders() } });
  if (!res.ok) throw new Error(`getSeasons failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.seasons ?? []);
}

async function createSeason(cookie, year) {
  const body = { name: `ZPL ${year}`, year, status: 'completed' };
  const res = await fetch(`${URL}/api/seasons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie, ...bypassHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`createSeason ${year} failed: ${res.status} ${await res.text()}`);
  const season = await res.json();
  console.log(`✓ Created season: ${season.name} (id: ${season.id})`);
  return season;
}

async function ensureSeason(cookie, year, existingSeasons) {
  const found = existingSeasons.find(s => Number(s.year) === year);
  if (found) {
    console.log(`  Season ${year} already exists (id: ${found.id})`);
    return found;
  }
  return createSeason(cookie, year);
}

async function importFile(cookie, seasonId, type, filePath) {
  let buffer;
  try {
    buffer = readFileSync(filePath);
  } catch {
    // Try just the filename in Downloads
    const alt = join(DOWNLOADS, filePath.split(/[/\\]/).pop());
    buffer = readFileSync(alt);
  }

  const blob = new Blob([buffer], { type: 'text/csv' });
  const form = new FormData();
  form.append('file', blob, filePath.split(/[/\\]/).pop());
  form.append('type', type);
  form.append('season_id', seasonId);

  const res = await fetch(`${URL}/api/import`, {
    method: 'POST',
    headers: { Cookie: cookie, ...bypassHeaders() },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Import failed: ${JSON.stringify(data)}`);
  return data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nImporting stats to: ${URL}\n`);

  const cookie = await login();

  // Get or create seasons
  const existingSeasons = await getSeasons(cookie);
  console.log(`\nExisting seasons: ${existingSeasons.map(s => s.name).join(', ') || 'none'}`);

  const season2024 = await ensureSeason(cookie, 2024, existingSeasons);
  const season2025 = await ensureSeason(cookie, 2025, existingSeasons);
  const seasonMap = { 2024: season2024.id, 2025: season2025.id };

  console.log('\n--- Importing stats ---\n');
  const results = [];

  for (const { season_year, type, file } of FILES) {
    const filePath = join(DOWNLOADS, file);
    const seasonId = seasonMap[season_year];
    process.stdout.write(`[${season_year}] ${type.padEnd(8)} ${file} ... `);
    try {
      const r = await importFile(cookie, seasonId, type, filePath);
      const summary = `imported=${r.imported} matched=${r.matched} created=${r.created ?? 0} skipped=${r.skipped}`;
      console.log(`✓ ${summary}`);
      if (r.errors?.length) console.log(`  ⚠ errors: ${r.errors.slice(0, 3).join('; ')}`);
      if (r.skipped_names?.length) console.log(`  ⚠ skipped: ${r.skipped_names.slice(0, 5).join(', ')}${r.skipped_names.length > 5 ? '...' : ''}`);
      results.push({ season_year, type, ...r, ok: true });
    } catch (e) {
      console.log(`✗ ${e.message}`);
      results.push({ season_year, type, ok: false, error: e.message });
    }
  }

  console.log('\n--- Summary ---');
  const ok = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`${ok}/${results.length} files imported successfully`);
  if (fail > 0) {
    console.log('Failed:');
    results.filter(r => !r.ok).forEach(r => console.log(`  [${r.season_year}] ${r.type}: ${r.error}`));
  }
  const totalPlayers = results.filter(r => r.ok).reduce((sum, r) => sum + (r.created ?? 0), 0);
  if (totalPlayers > 0) console.log(`\n${totalPlayers} new historical players auto-created`);
}

main().catch(e => { console.error(e); process.exit(1); });
