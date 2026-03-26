import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get('season_id') || '';
    if (!seasonId) return NextResponse.json({ error: 'season_id required' }, { status: 400 });
    const players = await db.getAvailablePlayers(seasonId);
    return NextResponse.json(players);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
