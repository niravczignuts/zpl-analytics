import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    const player = await db.getPlayerById(id);
    if (!player) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [stats, remarks, ownerData, latestReg] = await Promise.all([
      db.getPlayerStats(id),
      db.getPlayerRemarks(id),
      (db as any).getPlayerOwnerData(id).catch(() => null),
      (db as any).getLatestPlayerRegistration(id).catch(() => null),
    ]);

    return NextResponse.json({
      ...player,
      stats,
      remarks,
      base_price: latestReg?.base_price ?? null,
      owner_data: ownerData ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    const body = await req.json();
    const player = await db.updatePlayer(id, body);
    return NextResponse.json(player);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
