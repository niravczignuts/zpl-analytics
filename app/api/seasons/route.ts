import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET() {
  try {
    const db = getDB();
    const seasons = await db.getSeasons();
    return NextResponse.json(seasons);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDB();
    const body = await req.json();
    const season = await db.createSeason(body);
    return NextResponse.json(season, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
