import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get('season_id') || '';
    if (!seasonId) return NextResponse.json({ error: 'season_id required' }, { status: 400 });
    const teams = await db.getTeams(seasonId);

    // Attach budget info
    const teamsWithBudget = await Promise.all(teams.map(async t => {
      const budget = await db.getTeamBudget(t.id, seasonId);
      return { ...t, ...budget };
    }));

    return NextResponse.json(teamsWithBudget);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDB();
    const body = await req.json();
    const team = await db.createTeam(body);
    return NextResponse.json(team, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
