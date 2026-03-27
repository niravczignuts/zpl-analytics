import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// Temporary debug endpoint — remove after investigation
// GET /api/debug?season_id=xxx
export async function GET(req: NextRequest) {
  try {
    const db = getDB() as any;
    const seasonId = req.nextUrl.searchParams.get('season_id') || '';

    const provider = process.env.DATABASE_PROVIDER || 'sqlite';

    // Get teams for the season
    const teams = await db.getTeams(seasonId);

    // For first team, try getTeamWithSquad
    let squadSample: any = null;
    let squadError: string | null = null;
    if (teams.length > 0) {
      try {
        squadSample = await db.getTeamWithSquad(teams[0].id, seasonId);
      } catch (e: any) {
        squadError = e.message;
      }
    }

    // Check player_owner_data table
    let ownerDataSample: any = null;
    let ownerDataError: string | null = null;
    try {
      ownerDataSample = await db.getPlayerOwnerDataBulk(
        squadSample?.players?.slice(0, 3).map((p: any) => p.id).filter(Boolean) ?? []
      );
    } catch (e: any) {
      ownerDataError = e.message;
    }

    return NextResponse.json({
      provider,
      season_id: seasonId,
      teams_count: teams.length,
      first_team: teams[0] ? { id: teams[0].id, name: teams[0].name } : null,
      squad_player_count: squadSample?.players?.length ?? 0,
      squad_error: squadError,
      first_3_players: squadSample?.players?.slice(0, 3).map((p: any) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        player_role: p.player_role,
        has_batting: !!p.batting,
        has_bowling: !!p.bowling,
        purchase_price: p.purchase_price,
        team_role: p.team_role,
      })) ?? [],
      owner_data_sample: ownerDataSample,
      owner_data_error: ownerDataError,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
