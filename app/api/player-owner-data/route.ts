import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// GET /api/player-owner-data?ids=id1,id2,id3
export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const ids = req.nextUrl.searchParams.get('ids')?.split(',').filter(Boolean) ?? [];
    if (!ids.length) return NextResponse.json({});
    const result: Record<string, any> = {};
    await Promise.all(
      ids.map(async id => {
        const d = await (db as any).getPlayerOwnerData(id);
        if (d) result[id] = d;
      })
    );
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
