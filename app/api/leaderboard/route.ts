import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import type { StatType } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get('season_id') || '';
    const statType = (searchParams.get('stat_type') || 'batting') as StatType;
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!seasonId) return NextResponse.json({ error: 'season_id required' }, { status: 400 });

    const leaderboard = await db.getSeasonLeaderboard(seasonId, statType);
    return NextResponse.json(leaderboard.slice(0, limit));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
