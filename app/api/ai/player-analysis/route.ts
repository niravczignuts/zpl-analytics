import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { analyzePlayer } from '@/lib/analysis/engine';
import { getPlayerAnalysis } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { player_id, useAI = false } = body;
    if (!player_id) return NextResponse.json({ error: 'player_id required' }, { status: 400 });

    const db = getDB();
    const player = await db.getPlayerById(player_id);
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const allStats = await db.getPlayerStats(player_id);
    const analysis = useAI
      ? await getPlayerAnalysis({ player, allStats })
      : analyzePlayer({ player, allStats });
    return NextResponse.json({ analysis });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
