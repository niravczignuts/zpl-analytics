/**
 * Re-seeds 2025 teams from Analysis XLSX.
 * Run after fixing the parser: npx tsx scripts/seed-teams.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SQLiteDB } from '../lib/db-sqlite';
import { parseAuctionXlsx } from '../lib/import/xlsx-parser';
import { findBestMatch, normalizeName } from '../lib/import/name-matcher';

const db = new SQLiteDB();
const AUCTION_FILE = path.join(process.cwd(), 'data', 'seed', "ZPL '25 - Analysis.xlsx");

async function main() {
  console.log('🏏 Seeding 2025 teams from Analysis XLSX...');

  const { teams } = parseAuctionXlsx(AUCTION_FILE);
  console.log(`Found ${teams.length} teams`);

  const allPlayers = db.rawQuery('SELECT id, first_name, last_name FROM players', []);
  const candidates = allPlayers.map((p: any) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`.trim(),
  }));

  for (const team of teams) {
    console.log(`\n  Team: ${team.name} (${team.players.length} players)`);

    // Check if team already exists
    const existing = db.rawQuery('SELECT id FROM teams WHERE season_id = ? AND name = ?', ['season-2025', team.name]);
    let teamId: string;
    if (existing.length) {
      teamId = existing[0].id;
      console.log(`    Already exists: ${teamId}`);
    } else {
      teamId = uuidv4();
      db.createTeam({ id: teamId, season_id: 'season-2025', name: team.name, color_primary: team.color_primary });
      console.log(`    Created: ${teamId}`);
    }

    let captainId: string | undefined;
    let purchaseOrder = 1;
    let matched = 0, unmatched = 0;

    for (const ap of team.players) {
      const playerMatch = findBestMatch(ap.player_name, candidates, 0.72);
      if (!playerMatch) {
        console.log(`    ⚠️  No match: "${ap.player_name}"`);
        unmatched++;
        continue;
      }

      // Register for 2025
      db.upsertRegistration({ season_id: 'season-2025', player_id: playerMatch.id, group_number: ap.group_number, registration_status: 'verified' });

      // Record purchase (skip if already exists)
      const existingPurchase = db.rawQuery('SELECT id FROM auction_purchases WHERE season_id = ? AND player_id = ?', ['season-2025', playerMatch.id]);
      if (!existingPurchase.length && ap.purchase_price > 0) {
        db.recordPurchase({
          season_id: 'season-2025', team_id: teamId, player_id: playerMatch.id,
          purchase_price: ap.purchase_price, purchase_order: purchaseOrder++,
          group_number: ap.group_number, is_captain: ap.is_captain,
        });
      }

      if (ap.is_captain && !captainId) captainId = playerMatch.id;
      matched++;
    }

    if (captainId) db.updateTeam(teamId, { captain_id: captainId });
    console.log(`    ✅ Matched: ${matched}, Unmatched: ${unmatched}`);
  }

  console.log('\n✅ Done! Verify with:');
  const teams2025 = db.getTeams('season-2025');
  teams2025.forEach(t => {
    const budget = db.getTeamBudget(t.id, 'season-2025');
    console.log(`  ${t.name}: ${budget.players_bought} players, ₹${(budget.spent/100000).toFixed(1)}L spent`);
  });
}

main().catch(console.error);
