import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const db = getDB();
    const { season_id, player_id, undo } = await req.json();
    if (!season_id || !player_id) {
      return NextResponse.json({ error: 'season_id and player_id required' }, { status: 400 });
    }
    const status = undo ? 'registered' : 'unsold';
    await db.updateRegistrationStatus(player_id, season_id, status);
    return NextResponse.json({ success: true, status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
