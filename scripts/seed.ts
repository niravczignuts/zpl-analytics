/**
 * ZPL Analytics — Database Seed Script
 *
 * Usage: npx tsx scripts/seed.ts
 *
 * What it does:
 *  1. Creates seasons: 2024, 2025, 2026
 *  2. Imports players from 2026 registration XLSX
 *  3. Cross-references with 2024/2025 CSV data (fuzzy match)
 *  4. Imports all historical stats
 *  5. Creates 2025 teams from Analysis XLSX
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { SQLiteDB } from '../lib/db-sqlite';
import { parseBattingCsv, parseBowlingCsv, parseFieldingCsv, parseMvpCsv } from '../lib/import/csv-parser';
import { parseRegistrationXlsx, parseAuctionXlsx, getTeamColor } from '../lib/import/xlsx-parser';

// Helpers: read file and pass as buffer/string (parsers no longer accept file paths directly)
const readXlsxBuf = (p: string) => fs.readFileSync(p);
const readCsvStr = (p: string) => fs.readFileSync(p, 'utf-8');
import { findBestMatch, normalizeName } from '../lib/import/name-matcher';

const db = new SQLiteDB();
const DATA_DIR = path.join(process.cwd(), 'data', 'seed');

// ─── File paths ────────────────────────────────────────────────────────────────
const FILES = {
  reg2026: path.join(DATA_DIR, 'ZPL 2026 Registration Verification.xlsx'),
  auction2025: path.join(DATA_DIR, "ZPL '25 - Analysis.xlsx"),
  // 2025 stats (season ID 936991 on CricHeroes)
  batting2025: path.join(DATA_DIR, '936991_batting_leaderboard.csv'),
  bowling2025: path.join(DATA_DIR, '936991_bowling_leaderboard.csv'),
  fielding2025: path.join(DATA_DIR, '936991_fielding_leaderboard.csv'),
  mvp2025: path.join(DATA_DIR, '936991_mvp_leaderboard.csv'),
  // 2024 stats (season ID 1410878 on CricHeroes)
  batting2024: path.join(DATA_DIR, '1410878_batting_leaderboard.csv'),
  bowling2024: path.join(DATA_DIR, '1410878_bowling_leaderboard.csv'),
  fielding2024: path.join(DATA_DIR, '1410878_fielding_leaderboard.csv'),
  mvp2024: path.join(DATA_DIR, '1410878_mvp_leaderboard.csv'),
};

function checkFile(p: string, label: string): boolean {
  if (!fs.existsSync(p)) {
    console.warn(`  ⚠️  Not found: ${label} (${path.basename(p)})`);
    return false;
  }
  return true;
}

// ─── Step 1: Create seasons ────────────────────────────────────────────────────
function seedSeasons() {
  console.log('\n📅 Creating seasons...');

  const zplRules = JSON.stringify({
    max_overs: 12,
    max_bowler_overs: 3,
    girls_over: { position: 1, min_players_on_field: 4, runs_multiplier: 2, extras_normal: true },
    impact_player: true,
    drs_per_innings: 1,
    powerplay_overs: [1, 2, 3],
    min_girls_in_squad: 2,
    squad_size: 12,
    playing_xi: 11,
  });

  db.createSeason({ id: 'season-2024', name: 'ZPL 2024', year: 2024, status: 'completed', rules_json: zplRules });
  db.createSeason({ id: 'season-2025', name: 'ZPL 2025', year: 2025, status: 'completed', rules_json: zplRules });
  db.createSeason({ id: 'season-2026', name: 'ZPL 2026', year: 2026, status: 'registration', rules_json: zplRules });

  console.log('  ✅ Seasons created: 2024, 2025, 2026');
}

// ─── Step 2: Collect all player names from CSVs ────────────────────────────────
interface CsvPlayer {
  external_id: string;
  name: string;
  batting_hand?: string;
  bowling_style?: string;
  player_role?: string;
  gender?: string;
}

function collectCsvPlayers(): CsvPlayer[] {
  const seen = new Map<string, CsvPlayer>();

  const addFromBatting = (file: string) => {
    if (!fs.existsSync(file)) return;
    const rows = parseBattingCsv(readCsvStr(file));
    for (const r of rows) {
      if (!seen.has(r.external_id)) {
        seen.set(r.external_id, {
          external_id: r.external_id,
          name: r.name,
          batting_hand: r.stats.batting_hand,
        });
      }
    }
  };

  const addFromBowling = (file: string) => {
    if (!fs.existsSync(file)) return;
    const rows = parseBowlingCsv(readCsvStr(file));
    for (const r of rows) {
      const existing = seen.get(r.external_id);
      if (existing) {
        existing.bowling_style = r.stats.bowling_style;
      } else {
        seen.set(r.external_id, { external_id: r.external_id, name: r.name, bowling_style: r.stats.bowling_style });
      }
    }
  };

  const addFromMvp = (file: string) => {
    if (!fs.existsSync(file)) return;
    const rows = parseMvpCsv(readCsvStr(file));
    for (const r of rows) {
      // MVP rows don't have external_id, so match by name
      for (const [extId, p] of seen.entries()) {
        if (normalizeName(p.name) === normalizeName(r.name)) {
          p.player_role = r.stats.player_role || p.player_role;
          p.batting_hand = r.stats.batting_hand || p.batting_hand;
          p.bowling_style = r.stats.bowling_style || p.bowling_style;
          break;
        }
      }
    }
  };

  addFromBatting(FILES.batting2025);
  addFromBatting(FILES.batting2024);
  addFromBowling(FILES.bowling2025);
  addFromBowling(FILES.bowling2024);
  addFromMvp(FILES.mvp2025);
  addFromMvp(FILES.mvp2024);

  return Array.from(seen.values());
}

// ─── Step 3: Import players ────────────────────────────────────────────────────
function seedPlayers(): Map<string, string> {
  console.log('\n👤 Importing players...');

  // nameToId: normalized full name → player DB id
  const nameToId = new Map<string, string>();

  // First, load historical CSV players
  const csvPlayers = collectCsvPlayers();
  console.log(`  Found ${csvPlayers.length} unique players from CSV stats`);

  const csvDbPlayers: { id: string; first_name: string; last_name: string; external_id: string }[] = [];
  for (const cp of csvPlayers) {
    const parts = cp.name.trim().split(/\s+/);
    const first_name = parts[0] || cp.name;
    const last_name = parts.slice(1).join(' ') || '';
    const id = uuidv4();
    db.createPlayer({
      id, external_id: cp.external_id, first_name, last_name,
      batting_hand: cp.batting_hand, bowling_style: cp.bowling_style,
      player_role: cp.player_role, name_variants: cp.name,
    });
    nameToId.set(normalizeName(cp.name), id);
    csvDbPlayers.push({ id, first_name, last_name, external_id: cp.external_id });
  }

  // Now import 2026 registrations
  if (checkFile(FILES.reg2026, 'ZPL 2026 Registration')) {
    const regPlayers = parseRegistrationXlsx(readXlsxBuf(FILES.reg2026));
    console.log(`  Found ${regPlayers.length} 2026 registrations`);

    const candidates = csvDbPlayers.map(p => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`.trim(),
    }));

    let matched = 0, created = 0;
    for (const rp of regPlayers) {
      if (!rp.full_name.trim()) continue;
      const norm = normalizeName(rp.full_name);

      // Check exact match first
      if (nameToId.has(norm)) {
        // Register existing player for 2026
        db.upsertRegistration({
          season_id: 'season-2026',
          player_id: nameToId.get(norm)!,
          registration_status: 'verified',
        });
        matched++;
        continue;
      }

      // Fuzzy match
      const match = findBestMatch(rp.full_name, candidates, 0.80);
      if (match) {
        const existingPlayer = db.getPlayerById(match.id);
        if (existingPlayer) {
          // Update gender if known
          db.updatePlayer(match.id, { gender: rp.gender });
          db.upsertRegistration({
            season_id: 'season-2026',
            player_id: match.id,
            registration_status: 'verified',
          });
          matched++;
        }
      } else {
        // Create new player (registered but no historical stats)
        const parts = rp.full_name.trim().split(/\s+/);
        const first_name = parts[0];
        const last_name = parts.slice(1).join(' ');
        const id = uuidv4();
        db.createPlayer({ id, first_name, last_name, gender: rp.gender });
        nameToId.set(norm, id);
        db.upsertRegistration({
          season_id: 'season-2026',
          player_id: id,
          registration_status: 'verified',
        });
        candidates.push({ id, name: rp.full_name });
        created++;
      }
    }
    console.log(`  ✅ 2026 registrations: ${matched} matched existing, ${created} new players`);
  }

  console.log(`  ✅ Total players in DB: ${nameToId.size}`);
  return nameToId;
}

// ─── Step 4: Import stats ──────────────────────────────────────────────────────
function seedStats(nameToId: Map<string, string>) {
  console.log('\n📊 Importing historical stats...');

  function importBatting(file: string, seasonId: string) {
    if (!checkFile(file, `batting ${seasonId}`)) return;
    const rows = parseBattingCsv(readCsvStr(file));
    let count = 0;
    for (const r of rows) {
      // Try external_id match first, then name match
      let playerId: string | undefined;

      // Search by external_id
      const allPlayers = db.rawQuery('SELECT id, external_id FROM players WHERE external_id = ?', [r.external_id]);
      if (allPlayers.length) playerId = allPlayers[0].id;

      // Fallback: name match
      if (!playerId) {
        playerId = nameToId.get(normalizeName(r.name));
      }

      if (playerId) {
        db.upsertPlayerStats(playerId, seasonId, 'batting', r.stats);
        count++;
      }
    }
    console.log(`    Batting ${seasonId}: ${count}/${rows.length} matched`);
  }

  function importBowling(file: string, seasonId: string) {
    if (!checkFile(file, `bowling ${seasonId}`)) return;
    const rows = parseBowlingCsv(readCsvStr(file));
    let count = 0;
    for (const r of rows) {
      let playerId: string | undefined;
      const byExtId = db.rawQuery('SELECT id FROM players WHERE external_id = ?', [r.external_id]);
      if (byExtId.length) playerId = byExtId[0].id;
      if (!playerId) playerId = nameToId.get(normalizeName(r.name));
      if (playerId) {
        db.upsertPlayerStats(playerId, seasonId, 'bowling', r.stats);
        // Also update bowling_style if not set
        const p = db.getPlayerById(playerId);
        if (p && !p.bowling_style && r.stats.bowling_style) {
          db.updatePlayer(playerId, { bowling_style: r.stats.bowling_style });
        }
        count++;
      }
    }
    console.log(`    Bowling ${seasonId}: ${count}/${rows.length} matched`);
  }

  function importFielding(file: string, seasonId: string) {
    if (!checkFile(file, `fielding ${seasonId}`)) return;
    const rows = parseFieldingCsv(readCsvStr(file));
    let count = 0;
    for (const r of rows) {
      let playerId: string | undefined;
      const byExtId = db.rawQuery('SELECT id FROM players WHERE external_id = ?', [r.external_id]);
      if (byExtId.length) playerId = byExtId[0].id;
      if (!playerId) playerId = nameToId.get(normalizeName(r.name));
      if (playerId) {
        db.upsertPlayerStats(playerId, seasonId, 'fielding', r.stats);
        count++;
      }
    }
    console.log(`    Fielding ${seasonId}: ${count}/${rows.length} matched`);
  }

  function importMvp(file: string, seasonId: string) {
    if (!checkFile(file, `mvp ${seasonId}`)) return;
    const rows = parseMvpCsv(readCsvStr(file));
    let count = 0;
    for (const r of rows) {
      const playerId = nameToId.get(normalizeName(r.name));
      if (playerId) {
        db.upsertPlayerStats(playerId, seasonId, 'mvp', r.stats);
        // Update role/hand/style from MVP data
        const p = db.getPlayerById(playerId);
        if (p) {
          const updates: any = {};
          if (!p.player_role && r.stats.player_role) updates.player_role = r.stats.player_role;
          if (!p.batting_hand && r.stats.batting_hand) updates.batting_hand = r.stats.batting_hand;
          if (!p.bowling_style && r.stats.bowling_style) updates.bowling_style = r.stats.bowling_style;
          if (Object.keys(updates).length) db.updatePlayer(playerId, updates);
        }
        count++;
      }
    }
    console.log(`    MVP ${seasonId}: ${count}/${rows.length} matched`);
  }

  importBatting(FILES.batting2025, 'season-2025');
  importBowling(FILES.bowling2025, 'season-2025');
  importFielding(FILES.fielding2025, 'season-2025');
  importMvp(FILES.mvp2025, 'season-2025');

  importBatting(FILES.batting2024, 'season-2024');
  importBowling(FILES.bowling2024, 'season-2024');
  importFielding(FILES.fielding2024, 'season-2024');
  importMvp(FILES.mvp2024, 'season-2024');

  console.log('  ✅ Stats imported');
}

// ─── Step 5: Create 2025 teams from Analysis XLSX ─────────────────────────────
function seedTeams2025(nameToId: Map<string, string>) {
  console.log('\n🏏 Creating 2025 teams...');

  if (!checkFile(FILES.auction2025, 'ZPL 2025 Analysis')) {
    // Fallback: create known teams with default data
    const knownTeams = [
      { name: 'Trojan Horse', short: 'TH', color: '#8B0000' },
      { name: 'The Mavericks', short: 'MAV', color: '#FF6B35' },
      { name: 'Marvel Monsters', short: 'MM', color: '#6A0DAD' },
      { name: 'Red Squad', short: 'RS', color: '#DC143C' },
      { name: 'Super Smashers', short: 'SS', color: '#FF4500' },
      { name: 'Star Strikers', short: 'STR', color: '#FFD700' },
      { name: 'Gray Mighty', short: 'GM', color: '#808080' },
      { name: 'The Tech Titans', short: 'TT', color: '#00CED1' },
      { name: 'Thunder Strikers', short: 'TS', color: '#4169E1' },
      { name: 'Boundary Blazers', short: 'BB', color: '#228B22' },
    ];
    for (const t of knownTeams) {
      db.createTeam({ id: uuidv4(), season_id: 'season-2025', name: t.name, short_name: t.short, color_primary: t.color });
    }
    console.log('  ✅ Created 10 default 2025 teams');
    return;
  }

  const { teams } = parseAuctionXlsx(readXlsxBuf(FILES.auction2025));
  console.log(`  Found ${teams.length} teams in analysis sheet`);

  const candidates = Array.from(nameToId.entries()).map(([name, id]) => ({ id, name }));

  for (const team of teams) {
    const teamId = uuidv4();
    db.createTeam({
      id: teamId,
      season_id: 'season-2025',
      name: team.name,
      color_primary: team.color_primary,
    });

    // Also register all players for 2025
    let purchaseOrder = 1;
    let captainId: string | undefined;

    for (const ap of team.players) {
      const playerMatch = findBestMatch(ap.player_name, candidates, 0.78);
      if (!playerMatch) {
        console.warn(`    ⚠️  No match for "${ap.player_name}" in team ${team.name}`);
        continue;
      }

      const playerId = playerMatch.id;

      // Register for 2025
      db.upsertRegistration({
        season_id: 'season-2025',
        player_id: playerId,
        group_number: ap.group_number,
        registration_status: 'verified',
      });

      // Record purchase
      if (ap.purchase_price > 0) {
        db.recordPurchase({
          season_id: 'season-2025',
          team_id: teamId,
          player_id: playerId,
          purchase_price: ap.purchase_price,
          purchase_order: purchaseOrder++,
          group_number: ap.group_number,
          is_captain: ap.is_captain,
        });
      }

      if (ap.is_captain && !captainId) captainId = playerId;
    }

    // Set captain
    if (captainId) {
      db.updateTeam(teamId, { captain_id: captainId });
    }
  }

  console.log('  ✅ 2025 teams and auction data imported');
}

// ─── Also register 2025 CSV players for season-2025 ──────────────────────────
function registerCsvPlayersForSeasons(nameToId: Map<string, string>) {
  console.log('\n📋 Registering CSV players for 2024/2025 seasons...');

  // Everyone who appeared in 2025 CSVs
  const battingRows2025 = fs.existsSync(FILES.batting2025) ? parseBattingCsv(readCsvStr(FILES.batting2025)) : [];
  for (const r of battingRows2025) {
    const playerId = nameToId.get(normalizeName(r.name));
    if (playerId) {
      db.upsertRegistration({ season_id: 'season-2025', player_id: playerId, registration_status: 'verified' });
    }
  }

  // Everyone who appeared in 2024 CSVs
  const battingRows2024 = fs.existsSync(FILES.batting2024) ? parseBattingCsv(readCsvStr(FILES.batting2024)) : [];
  for (const r of battingRows2024) {
    const playerId = nameToId.get(normalizeName(r.name));
    if (playerId) {
      db.upsertRegistration({ season_id: 'season-2024', player_id: playerId, registration_status: 'verified' });
    }
  }

  console.log('  ✅ Season registrations updated');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏏 ZPL Analytics — Database Seed Script');
  console.log('═'.repeat(50));

  // Ensure seed data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`\n📁 Created data/seed directory. Please place your data files there:\n`);
    for (const [key, file] of Object.entries(FILES)) {
      console.log(`  ${path.basename(file)}`);
    }
    console.log('\nThen re-run this script.');
    return;
  }

  try {
    seedSeasons();
    const nameToId = seedPlayers();
    registerCsvPlayersForSeasons(nameToId);
    seedStats(nameToId);
    seedTeams2025(nameToId);

    console.log('\n' + '═'.repeat(50));
    console.log('✅ Seed complete! Database ready at data/zpl.db');
    console.log('\nSummary:');

    const seasons = db.getSeasons();
    for (const s of seasons) {
      const players = db.getPlayers({ season_id: s.id });
      console.log(`  ${s.name}: ${players.length} registered players`);
    }

  } catch (err) {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  }
}

main();
