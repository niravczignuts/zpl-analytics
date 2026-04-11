import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { compareTeams } from '@/lib/analysis/engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { team1_id, team2_id, season_id } = body;
    if (!team1_id || !team2_id || !season_id) {
      return NextResponse.json({ error: 'team1_id, team2_id, season_id required' }, { status: 400 });
    }

    const db = getDB();
    const team1 = await db.getTeamWithSquad(team1_id, season_id);
    const team2 = await db.getTeamWithSquad(team2_id, season_id);

    if (!team1 || !team2) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const comparison = compareTeams({ team1, team2 });
    return NextResponse.json({ comparison });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
