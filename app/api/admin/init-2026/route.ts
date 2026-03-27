import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const SEASON_ID = 'season-2026';

const CAPTAINS: { first: string; last: string; price: number }[] = [
  { first: 'Sagar',   last: 'Bhayani',    price: 7500000 },
  { first: 'Rahul',   last: 'Joshi',      price: 7500000 },
  { first: 'Nirav',   last: 'Chaudhari',  price: 5000000 },
  { first: 'Nihar',   last: 'Bhatt',      price: 5000000 },
  { first: 'Harsh',   last: 'Chauhan',    price: 5000000 },
  { first: 'Parth',   last: 'Trivedi',    price: 5000000 },
  { first: 'Gunjan',  last: 'Kalariya',   price: 2500000 },
  { first: 'Divyesh', last: 'Patel',      price:  500000 },
];

const TEAM_ROLES: { team: string; captain: string; manager: string }[] = [
  { team: 'Mavericks',       captain: 'Sagar Bhayani',   manager: 'Margi Dadhaniya' },
  { team: 'Marvel Monsters', captain: 'Parth Trivedi',   manager: 'Suhani Patel' },
  { team: 'Trojan Horse',    captain: 'Nihar Bhatt',     manager: 'Hemali Virda' },
  { team: 'Super Smashers',  captain: 'Nirav Chaudhari', manager: 'Rishita Katoch' },
  { team: 'Star Strikers',   captain: 'Rahul Joshi',     manager: 'Dhara Gohil' },
  { team: 'Gray Mighty',     captain: 'Divyesh Patel',   manager: 'Priyanka Prajapati' },
  { team: 'Tech Titans',     captain: 'Harsh Chauhan',   manager: 'Janki Radiya' },
  { team: 'Red Squad',       captain: 'Gunjan Kalariya', manager: 'Swati Bais' },
];

async function findPlayer(supabase: any, first: string, last: string): Promise<string | null> {
  const { data } = await supabase
    .from('players')
    .select('id')
    .ilike('first_name', `%${first}%`)
    .ilike('last_name', `%${last}%`)
    .limit(1);
  return data?.[0]?.id ?? null;
}

async function findTeam(supabase: any, name: string): Promise<string | null> {
  // Try exact name first, then each word, then short_name
  const { data: all } = await supabase
    .from('teams')
    .select('id, name, short_name')
    .eq('season_id', SEASON_ID);
  if (!all?.length) return null;

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/grey/g, 'gray');
  const target = norm(name);
  const match = all.find((t: any) =>
    norm(t.name) === target ||
    norm(t.name).includes(target) ||
    target.includes(norm(t.name)) ||
    norm(t.short_name ?? '') === norm(name.split(' ').map(w => w[0]).join(''))
  );
  return match?.id ?? null;
}

export async function POST() {
  const log: string[] = [];

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ success: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars', log }, { status: 500 });
    }

    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // ── 1. Season budget + squad size ────────────────────────────────────────
    const { error: e1 } = await sb.from('seasons')
      .update({ auction_budget: 30000000, max_players_per_team: 13 })
      .eq('id', SEASON_ID);
    if (e1) return NextResponse.json({ success: false, error: `Season update: ${e1.message}`, log }, { status: 500 });
    log.push('✅ Season 2026: 3 CR budget, 13-player squads');

    // ── 1b. Rename "Grey Mighty" → "Gray Mighty" in teams table ─────────────
    const { error: e1b } = await sb.from('teams')
      .update({ name: 'Gray Mighty' })
      .eq('season_id', SEASON_ID)
      .eq('name', 'Grey Mighty');
    if (e1b) log.push(`⚠️  Team rename: ${e1b.message}`);
    else log.push('✅ Team renamed: Grey Mighty → Gray Mighty');

    // Build captain price lookup by normalised name
    const captainPriceMap: Record<string, number> = {};
    for (const c of CAPTAINS) {
      captainPriceMap[`${c.first} ${c.last}`.toLowerCase()] = c.price;
    }

    // ── 2. Clear old captain/manager assignments ──────────────────────────────
    await sb.from('auction_purchases').delete().eq('season_id', SEASON_ID).in('team_role', ['captain', 'manager']);
    await sb.from('season_registrations').delete().eq('season_id', SEASON_ID).eq('registration_status', 'not_for_sale');
    log.push('✅ Cleared old assignments');

    // ── 3. Assign captains + managers (base_price included for captains) ──────
    let order = 0;
    for (const row of TEAM_ROLES) {
      const teamId = await findTeam(sb, row.team);
      if (!teamId) { log.push(`⚠️  Team not found: ${row.team}`); continue; }

      for (const { fullName, role } of [
        { fullName: row.captain, role: 'captain' as const },
        { fullName: row.manager, role: 'manager' as const },
      ]) {
        const [first, ...rest] = fullName.trim().split(' ');
        const last = rest.join(' ');
        let pid = await findPlayer(sb, first, last);

        if (!pid) {
          pid = uuidv4();
          const { error: ce } = await sb.from('players').insert({ id: pid, first_name: first, last_name: last, gender: role === 'manager' ? 'Female' : 'Male' });
          if (ce) { log.push(`⚠️  Create player failed: ${fullName}: ${ce.message}`); continue; }
          log.push(`  ➕ Created: ${fullName}`);
        }

        // For captains, include their fixed base_price so getTeamBudget can deduct it
        const basePrice = role === 'captain' ? (captainPriceMap[fullName.toLowerCase()] ?? 0) : null;

        // Upsert season registration — base_price is the captain's fixed valuation
        await sb.from('season_registrations').upsert(
          { id: uuidv4(), season_id: SEASON_ID, player_id: pid, registration_status: 'not_for_sale', base_price: basePrice },
          { onConflict: 'season_id,player_id' }
        );

        // Upsert auction purchase
        const { error: pe } = await sb.from('auction_purchases').upsert(
          { id: uuidv4(), season_id: SEASON_ID, team_id: teamId, player_id: pid, purchase_price: 0, purchase_order: ++order, is_captain: role === 'captain' ? 1 : 0, team_role: role },
          { onConflict: 'season_id,player_id' }
        );
        if (pe) { log.push(`⚠️  Purchase failed: ${fullName}: ${pe.message}`); continue; }

        if (role === 'captain') {
          await sb.from('teams').update({ captain_id: pid }).eq('id', teamId);
        }

        const priceLabel = basePrice ? ` (₹${basePrice / 100000}L)` : '';
        log.push(`✅ ${row.team}: ${role} → ${fullName}${priceLabel}`);
      }
    }

    log.push('');
    log.push('🏏 Season 2026 initialized!');
    return NextResponse.json({ success: true, log });

  } catch (err: any) {
    log.push(`❌ Uncaught: ${err?.message ?? String(err)}`);
    return NextResponse.json({ success: false, error: err?.message ?? String(err), log }, { status: 500 });
  }
}
