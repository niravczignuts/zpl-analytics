import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findBestMatch } from '@/lib/import/name-matcher';
import { v4 as uuidv4 } from 'uuid';

const SEASON_ID = 'season-2026';

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

export async function POST() {
  // Use Supabase client directly — rawRun is a no-op in the JS adapter
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const log: string[] = [];

  try {
    // ── 1. Update season-2026: 3 CR budget, 13 players per team ─────────────
    const { error: seasonErr } = await supabase
      .from('seasons')
      .update({ auction_budget: 30000000, max_players_per_team: 13 })
      .eq('id', SEASON_ID);
    if (seasonErr) throw new Error(`Season update failed: ${seasonErr.message}`);
    log.push('✅ Season 2026: budget = 3 CR, squad size = 13');

    // ── 2. Load all players for matching ────────────────────────────────────
    const { data: allPlayers, error: playersErr } = await supabase
      .from('players')
      .select('id, first_name, last_name');
    if (playersErr) throw new Error(`Load players failed: ${playersErr.message}`);

    const candidates = (allPlayers ?? []).map((p: any) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`.trim(),
    }));

    // ── 3. Set fixed captain base_price in season_registrations ─────────────
    for (const [name, price] of Object.entries(CAPTAIN_PRICES)) {
      const match = findBestMatch(name, candidates, 0.8);
      if (!match) { log.push(`⚠️  Captain not found: ${name}`); continue; }
      const { error: regErr } = await supabase
        .from('season_registrations')
        .update({ base_price: price })
        .eq('player_id', match.id)
        .eq('season_id', SEASON_ID);
      if (regErr) log.push(`⚠️  base_price update failed for ${match.name}: ${regErr.message}`);
      else log.push(`✅ Captain valuation: ${match.name} → ₹${(price / 100000).toFixed(0)} L`);
    }

    // ── 4. Clear existing captain/manager assignments for 2026 ──────────────
    const { error: delPurchasesErr } = await supabase
      .from('auction_purchases')
      .delete()
      .eq('season_id', SEASON_ID)
      .in('team_role', ['captain', 'manager']);
    if (delPurchasesErr) throw new Error(`Delete captain/manager purchases failed: ${delPurchasesErr.message}`);

    const { error: delRegsErr } = await supabase
      .from('season_registrations')
      .delete()
      .eq('season_id', SEASON_ID)
      .eq('registration_status', 'not_for_sale');
    if (delRegsErr) throw new Error(`Delete not_for_sale registrations failed: ${delRegsErr.message}`);

    log.push('✅ Cleared existing captain/manager assignments');

    // ── 5. Load 2026 teams ───────────────────────────────────────────────────
    const { data: dbTeams, error: teamsErr } = await supabase
      .from('teams')
      .select('id, name')
      .eq('season_id', SEASON_ID);
    if (teamsErr) throw new Error(`Load teams failed: ${teamsErr.message}`);

    const teamCandidates = (dbTeams ?? []).map((t: any) => ({ id: t.id, name: t.name }));

    // ── 6. Assign captains and managers per team ─────────────────────────────
    let maxOrder = 0;

    for (const row of TEAM_ROLES_2026) {
      const teamMatch = findBestMatch(row.team, teamCandidates, 0.5);
      if (!teamMatch) { log.push(`⚠️  Team not found: ${row.team}`); continue; }
      const teamId = teamMatch.id;

      for (const { name, role } of [
        { name: row.captain, role: 'captain' as const },
        { name: row.manager, role: 'manager' as const },
      ]) {
        // Find or create player
        let playerId: string;
        const match = findBestMatch(name, candidates, 0.75);
        if (match) {
          playerId = match.id;
        } else {
          playerId = uuidv4();
          const parts = name.trim().split(/\s+/);
          const { error: createErr } = await supabase.from('players').insert({
            id: playerId,
            first_name: parts[0],
            last_name: parts.slice(1).join(' ') || '',
            gender: role === 'manager' ? 'Female' : 'Male',
          });
          if (createErr) { log.push(`⚠️  Could not create player ${name}: ${createErr.message}`); continue; }
          candidates.push({ id: playerId, name });
          log.push(`  ➕ Created player: ${name}`);
        }

        // Upsert registration as not_for_sale
        await supabase.from('season_registrations').upsert({
          id: uuidv4(),
          season_id: SEASON_ID,
          player_id: playerId,
          registration_status: 'not_for_sale',
        }, { onConflict: 'season_id,player_id' });

        // Upsert into auction_purchases (conflict on season_id+player_id)
        const { error: purchaseErr } = await supabase.from('auction_purchases').upsert({
          id: uuidv4(),
          season_id: SEASON_ID,
          team_id: teamId,
          player_id: playerId,
          purchase_price: 0,
          purchase_order: ++maxOrder,
          group_number: null,
          is_captain: role === 'captain' ? 1 : 0,
          team_role: role,
        }, { onConflict: 'season_id,player_id' });
        if (purchaseErr) { log.push(`⚠️  Purchase insert failed for ${name}: ${purchaseErr.message}`); continue; }

        // For captain: update teams.captain_id
        if (role === 'captain') {
          await supabase.from('teams').update({ captain_id: playerId }).eq('id', teamId);
        }

        log.push(`✅ ${row.team}: ${role} → ${name}`);
      }
    }

    log.push('');
    log.push('🏏 Season 2026 initialized successfully');
    return NextResponse.json({ success: true, log });
  } catch (e: any) {
    log.push(`❌ Error: ${e.message}`);
    return NextResponse.json({ success: false, log, error: e.message }, { status: 500 });
  }
}
