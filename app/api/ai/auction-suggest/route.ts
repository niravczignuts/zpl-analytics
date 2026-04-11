import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { getAuctionSuggestion } from '@/lib/analysis/engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { team_id, season_id } = body;

    if (!team_id || !season_id) {
      return NextResponse.json({ error: 'team_id and season_id required' }, { status: 400 });
    }

    const db = getDB();
    const team = await db.getTeamWithSquad(team_id, season_id);
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const availablePlayers = await db.getAvailablePlayers(season_id);

    // Get all other teams with their budget info
    const allTeams = await db.getTeams(season_id);
    const otherTeams = await Promise.all(allTeams
      .filter(t => t.id !== team_id)
      .map(async t => {
        const budget = await db.getTeamBudget(t.id, season_id);
        return { ...t, ...budget };
      }));

    // Enrich available players with stats
    const enrichedPlayers = await Promise.all(availablePlayers.slice(0, 50).map(async p => {
      const stats = await db.getPlayerStats(p.id, season_id);
      const latestStats = Object.values(stats)[0] as any;
      return {
        ...p,
        batting: latestStats?.batting || null,
        bowling: latestStats?.bowling || null,
        mvp: latestStats?.mvp || null,
      };
    }));

    const budget = await db.getTeamBudget(team_id, season_id);
    const suggestion = getAuctionSuggestion({
      teamName: team.name,
      remainingBudget: budget.remaining,
      playersCount: budget.players_bought,
      maxPlayers: budget.max_players,
      currentSquad: team.players,
      availablePlayers: enrichedPlayers,
      otherTeams,
    });

    return NextResponse.json(suggestion);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
