import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    const batting = await db.getPlayerMatchHistory(id, 15);
    const bowling = await db.getPlayerBowlingHistory(id, 15);
    return NextResponse.json({ batting, bowling });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
