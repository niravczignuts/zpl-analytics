import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const filters = {
      season_id: searchParams.get('season_id') || undefined,
      gender: searchParams.get('gender') || undefined,
      player_role: searchParams.get('player_role') || undefined,
      team_id: searchParams.get('team_id') || undefined,
      search: searchParams.get('search') || undefined,
    };
    const players = await db.getPlayers(filters);
    return NextResponse.json(players);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDB();
    const body = await req.json();
    const player = await db.createPlayer(body);
    return NextResponse.json(player, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
