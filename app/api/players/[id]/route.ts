import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    const player = await db.getPlayerById(id);
    if (!player) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const stats = await db.getPlayerStats(id);
    const remarks = await db.getPlayerRemarks(id);

    return NextResponse.json({ ...player, stats, remarks });
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
