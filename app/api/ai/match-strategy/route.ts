import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { getMatchStrategy } from '@/lib/analysis/engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { team_id, opponent_id, season_id } = body;

    if (!team_id || !opponent_id || !season_id) {
      return NextResponse.json({ error: 'team_id, opponent_id, season_id required' }, { status: 400 });
    }

    const db = getDB();
    const yourTeam = await db.getTeamWithSquad(team_id, season_id);
    const opponentTeam = await db.getTeamWithSquad(opponent_id, season_id);

    if (!yourTeam || !opponentTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const strategy = getMatchStrategy({ yourTeam, opponentTeam });
    return NextResponse.json({ strategy });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
