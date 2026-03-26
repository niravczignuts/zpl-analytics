import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get('season_id') || '';

    if (!seasonId) {
      // Return latest season data
      const seasons = await db.getSeasons();
      const latest = seasons[0];
      if (!latest) return NextResponse.json({ error: 'No seasons found' }, { status: 404 });
      return dashboardData(db, latest.id);
    }

    return dashboardData(db, seasonId);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function dashboardData(db: any, seasonId: string) {
  const stats = await db.getDashboardStats(seasonId);
  const teams = await db.getTeams(seasonId);
  const pointsTable = await db.getPointsTable(seasonId);
  const topBatters = (await db.getSeasonLeaderboard(seasonId, 'batting')).slice(0, 5);
  const topBowlers = (await db.getSeasonLeaderboard(seasonId, 'bowling')).slice(0, 5);
  const topMvp = (await db.getSeasonLeaderboard(seasonId, 'mvp')).slice(0, 5);
  const matches = await db.getMatches(seasonId);
  const upcoming = matches.filter((m: any) => m.status === 'upcoming').slice(0, 3);
  const recent = matches.filter((m: any) => m.status === 'completed').slice(-3).reverse();

  return NextResponse.json({
    seasonId,
    stats,
    teams: teams.length,
    pointsTable,
    topBatters,
    topBowlers,
    topMvp,
    upcomingMatches: upcoming,
    recentMatches: recent,
  });
}
