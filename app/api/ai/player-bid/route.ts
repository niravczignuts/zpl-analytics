import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { getPlayerBidRecommendation } from '@/lib/analysis/engine';


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { player_id, season_id } = body;

    if (!player_id || !season_id) {
      return NextResponse.json({ error: 'player_id and season_id required' }, { status: 400 });
    }

    const db = getDB();
    const player = await db.getPlayerById(player_id);
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    // ── Find Super Smashers in this season ──────────────────────────────────
    const allTeams = await db.getTeams(season_id);
    const ssTeam = allTeams.find(t =>
      t.name.toLowerCase().includes('super') && t.name.toLowerCase().includes('smash')
    ) || allTeams.find(t => t.name.toLowerCase().includes('smash'));

    if (!ssTeam) {
      return NextResponse.json({ error: 'Super Smashers team not found for this season.' }, { status: 404 });
    }

    // ── Super Smashers budget + squad ───────────────────────────────────────
    const ssBudget = await db.getTeamBudget(ssTeam.id, season_id);
    const ssSquad = await db.getTeamWithSquad(ssTeam.id, season_id);

    // ── Player full historical stats ────────────────────────────────────────
    const allStats = await db.getPlayerStats(player_id); // all seasons

    // ── Market intelligence: what other teams paid for similar-role players ─
    const allPurchases = await db.getAuctionPurchases(season_id) as any[];
    const similarPurchases = allPurchases.filter((p: any) =>
      p.team_id !== ssTeam.id &&
      p.purchase_price > 0 &&
      p.team_role === 'player' // exclude captains/managers
    );

    // ── Rule-based bid recommendation ───────────────────────────────────────
    const otherTeamsBudgetsData = await Promise.all(allTeams
      .filter(t => t.id !== ssTeam.id)
      .map(async t => {
        const b = await db.getTeamBudget(t.id, season_id);
        return { ...t, ...b };
      }));

    const result = getPlayerBidRecommendation({
      player,
      playerStats: allStats,
      ssTeam: { ...ssTeam, budget: ssBudget, squad: ssSquad?.players || [] },
      ssBudget,
      marketPurchases: similarPurchases,
      otherTeamsBudgets: otherTeamsBudgetsData,
    });

    return NextResponse.json({ ...result, ss_team_name: ssTeam.name });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
