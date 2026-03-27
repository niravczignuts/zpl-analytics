import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { findBestMatch } from '@/lib/import/name-matcher';
import { v4 as uuidv4 } from 'uuid';

// Fixed captain valuations for 2026
const CAPTAIN_PRICES: Record<string, number> = {
  'sagar bhayani':   7500000,  // 75 L
  'rahul joshi':     7500000,  // 75 L
  'nirav chaudhari': 5000000,  // 50 L
  'nihar bhatt':     5000000,  // 50 L
  'harsh chauhan':   5000000,  // 50 L
  'parth trivedi':   5000000,  // 50 L
  'gunjan kalariya': 2500000,  // 25 L
  'divyesh patel':    500000,  //  5 L
};

// Pre-assigned captains and managers for 2026
const TEAM_ROLES_2026 = [
  { team: 'Mavericks',       captain: 'Sagar Bhayani',   manager: 'Margi Dadhaniya' },
  { team: 'Marvel Monsters', captain: 'Parth Trivedi',   manager: 'Suhani Patel' },
  { team: 'Trojan Horse',    captain: 'Nihar Bhatt',     manager: 'Hemali Virda' },
  { team: 'Super Smashers',  captain: 'Nirav Chaudhari', manager: 'Rishita Katoch' },
  { team: 'Star Strikers',   captain: 'Rahul Joshi',     manager: 'Dhara Gohil' },
  { team: 'Gray Mighty',     captain: 'Divyesh Patel',   manager: 'Priyanka Prajapati' },
  { team: 'Tech Titans',     captain: 'Harsh Chauhan',   manager: 'Janki Radiya' },
  { team: 'Red Squad',       captain: 'Gunjan Kalariya', manager: 'Swati Bais' },
];

const SEASON_ID = 'season-2026';

export async function POST() {
  try {
    const db = getDB();
    const log: string[] = [];

    // ── 1. Update season-2026 budget and squad size ──────────────────────────
    await db.rawRun(
      `UPDATE seasons SET auction_budget = 30000000, boys_budget = 0, girls_budget = 0,
       max_players_per_team = 13 WHERE id = ?`,
      [SEASON_ID]
    );
    log.push('✅ Season 2026: budget set to 3 CR, squad size 13');

    // ── 2. Load all players for matching ────────────────────────────────────
    const allPlayers = await db.rawQuery('SELECT id, first_name, last_name FROM players', []) as any[];
    const candidates = allPlayers.map((p: any) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`.trim(),
    }));

    // ── 3. Set fixed captain base_price in season_registrations ─────────────
    for (const [name, price] of Object.entries(CAPTAIN_PRICES)) {
      const match = findBestMatch(name, candidates, 0.8);
      if (!match) { log.push(`⚠️  Captain not found: ${name}`); continue; }
      await db.rawRun(
        `UPDATE season_registrations SET base_price = ? WHERE player_id = ? AND season_id = ?`,
        [price, match.id, SEASON_ID]
      );
      log.push(`✅ Captain valuation: ${match.name} → ₹${(price / 100000).toFixed(0)} L`);
    }

    // ── 4. Clear existing captain/manager assignments for 2026 ──────────────
    await db.rawRun(
      `DELETE FROM auction_purchases WHERE season_id = ? AND team_role IN ('captain','manager')`,
      [SEASON_ID]
    );
    await db.rawRun(
      `DELETE FROM season_registrations WHERE season_id = ? AND registration_status = 'not_for_sale'`,
      [SEASON_ID]
    );
    log.push('✅ Cleared old captain/manager assignments');

    // ── 5. Assign captains and managers per team ─────────────────────────────
    const dbTeams = await db.getTeams(SEASON_ID);
    const teamCandidates = dbTeams.map((t: any) => ({ id: t.id, name: t.name }));

    for (const row of TEAM_ROLES_2026) {
      const teamMatch = findBestMatch(row.team, teamCandidates, 0.5);
      const team = teamMatch ? dbTeams.find((t: any) => t.id === teamMatch.id) : null;
      if (!team) { log.push(`⚠️  Team not found: ${row.team}`); continue; }

      for (const { name, role } of [
        { name: row.captain, role: 'captain' as const },
        { name: row.manager, role: 'manager' as const },
      ]) {
        let playerId: string;
        const match = findBestMatch(name, candidates, 0.75);
        if (match) {
          playerId = match.id;
        } else {
          const parts = name.trim().split(/\s+/);
          playerId = uuidv4();
          await db.createPlayer({ id: playerId, first_name: parts[0], last_name: parts.slice(1).join(' ') || '', gender: role === 'manager' ? 'Female' : 'Male' });
          candidates.push({ id: playerId, name });
          log.push(`  ➕ Created player: ${name}`);
        }

        // Mark not_for_sale
        await db.upsertRegistration({ season_id: SEASON_ID, player_id: playerId, registration_status: 'not_for_sale' });

        // Record as pre-assigned (purchase_price = 0)
        await db.recordPurchase({ season_id: SEASON_ID, team_id: team.id, player_id: playerId, purchase_price: 0, is_captain: role === 'captain', team_role: role });

        if (role === 'captain') {
          await db.updateTeam(team.id, { captain_id: playerId });
        }
        log.push(`✅ ${team.name}: ${role} → ${name}`);
      }
    }

    log.push('');
    log.push('🏏 Season 2026 initialized successfully');
    return NextResponse.json({ success: true, log });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
