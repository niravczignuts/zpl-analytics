import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { findBestMatch } from '@/lib/import/name-matcher';
import { v4 as uuidv4 } from 'uuid';

// Default captain/manager suggestions — team name is used only to pre-fill the UI;
// the actual POST always receives team_id from the client so names never need to match exactly.
const TEAM_ROLES = [
  { team: 'Mavericks',    captain: 'Sagar Bhayani',    manager: 'Margi Dadhaniya' },
  { team: 'Marvel Monsters',  captain: 'Parth Trivedi',    manager: 'Suhani Patel' },
  { team: 'Trojan Horse',     captain: 'Nihar Bhatt',      manager: 'Hemali Virda' },
  { team: 'Super Smashers',   captain: 'Nirav Chaudhari',  manager: 'Rishita Katoch' },
  { team: 'Star Strikers',    captain: 'Rahul Joshi',      manager: 'Dhara Gohil' },
  { team: 'Gray Mighty',      captain: 'Divyesh Patel',    manager: 'Priyanka Prajapati' },
  { team: 'Tech Titans',      captain: 'Harsh Chauhan',    manager: 'Janki Radiya' },
  { team: 'Red Squad',        captain: 'Gunjan Kalariya',  manager: 'Swati Bais' },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { season_id } = body;
    // Accept custom roles from UI; fall back to hardcoded defaults
    const roles: typeof TEAM_ROLES = body.roles ?? TEAM_ROLES;
    if (!season_id) return NextResponse.json({ error: 'season_id required' }, { status: 400 });

    const db = getDB();
    const season = await db.getSeasonById(season_id);
    if (!season) return NextResponse.json({ error: `Season not found: ${season_id}` }, { status: 404 });

    const allPlayers = await db.rawQuery('SELECT id, first_name, last_name FROM players', []);
    const candidates = allPlayers.map((p: any) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`.trim(),
    }));

    // Remove ALL existing captain/manager assignments for this season first —
    // ensures a clean re-run with correct team_role values
    await db.rawRun(
      "DELETE FROM auction_purchases WHERE season_id = ? AND team_role IN ('captain','manager')",
      [season_id]
    );
    await db.rawRun(
      "DELETE FROM season_registrations WHERE season_id = ? AND registration_status = 'not_for_sale'",
      [season_id]
    );

    const result = { assigned: 0, created: 0, errors: [] as string[], matched: [] as string[] };
    const dbTeams = await db.getTeams(season_id);
    const teamCandidates = dbTeams.map(t => ({ id: t.id, name: t.name }));

    for (const row of roles) {
      // Prefer explicit team_id sent from UI; fall back to fuzzy name match
      let team = row.team_id
        ? dbTeams.find(t => t.id === row.team_id)
        : undefined;

      if (!team) {
        const teamMatch = findBestMatch(row.team, teamCandidates, 0.5);
        team = teamMatch ? dbTeams.find(t => t.id === teamMatch.id) : undefined;
      }

      if (!team) {
        result.errors.push(`Team not found: "${row.team}" — check the team exists for this season`);
        continue;
      }

      for (const { name, role } of [
        { name: row.captain, role: 'captain' as const },
        { name: row.manager, role: 'manager' as const },
      ]) {
        try {
          // Find player by fuzzy match
          let playerId: string;
          const match = findBestMatch(name, candidates, 0.75);
          if (match) {
            playerId = match.id;
            result.matched.push(`${name} → ${match.name} (${role})`);
          } else {
            // Create new player
            const parts = name.trim().split(/\s+/);
            playerId = uuidv4();
            await db.createPlayer({
              id: playerId,
              first_name: parts[0],
              last_name: parts.slice(1).join(' ') || '',
              gender: 'Male',
            });
            candidates.push({ id: playerId, name });
            result.created++;
          }

          // Ensure registered for this season as not_for_sale
          await db.upsertRegistration({
            season_id,
            player_id: playerId,
            registration_status: 'not_for_sale',
          });

          // Pre-assign to team with purchase_price = 0, team_role set
          await db.recordPurchase({
            season_id,
            team_id: team.id,
            player_id: playerId,
            purchase_price: 0,
            is_captain: role === 'captain',
            team_role: role,
          });

          // For captains, also update teams.captain_id
          if (role === 'captain') {
            await db.updateTeam(team.id, { captain_id: playerId });
          }

          result.assigned++;
        } catch (e: any) {
          result.errors.push(`${name} (${role}): ${e.message}`);
        }
      }
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET returns the hardcoded list so the UI can display it
export async function GET() {
  return NextResponse.json(TEAM_ROLES);
}
