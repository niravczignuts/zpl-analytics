import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get('season_id') || '';
    if (!seasonId) return NextResponse.json({ error: 'season_id required' }, { status: 400 });
    const matches = await db.getMatches(seasonId);
    return NextResponse.json(matches);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDB();
    const body = await req.json();
    const match = await db.createMatch(body);
    return NextResponse.json(match, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
