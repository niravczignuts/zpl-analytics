import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get('season_id') || undefined;
    const team = await db.getTeamWithSquad(id, seasonId);
    if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(team);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    const body = await req.json();
    const team = await db.updateTeam(id, body);
    return NextResponse.json(team);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
