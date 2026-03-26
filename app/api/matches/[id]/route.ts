import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    const match = await db.getMatchById(id);
    if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(match);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    const body = await req.json();
    const match = await db.updateMatch(id, body);
    return NextResponse.json(match);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    const match = await db.getMatchById(id);
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    await db.deleteMatch(id);
    return NextResponse.json({ success: true, deleted_id: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
