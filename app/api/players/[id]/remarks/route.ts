import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    const remarks = await db.getPlayerRemarks(id);
    return NextResponse.json(remarks);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    const body = await req.json();
    const remark = await db.createRemark({
      player_id: id,
      remark_type: body.remark_type || 'general',
      remark: body.remark,
      season_id: body.season_id || null,
    });
    return NextResponse.json(remark, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
