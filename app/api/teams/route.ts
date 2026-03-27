import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get('season_id') || '';
    if (!seasonId) return NextResponse.json({ error: 'season_id required' }, { status: 400 });

    // Batch: fetch teams + all budgets in parallel (2 queries total instead of N+1)
    const [teams, budgets] = await Promise.all([
      db.getTeams(seasonId),
      db.getAllTeamBudgets(seasonId),
    ]);
    const budgetMap = new Map(budgets.map(b => [b.team_id, b]));
    const teamsWithBudget = teams.map(t => ({ ...t, ...(budgetMap.get(t.id) ?? {}) }));

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
