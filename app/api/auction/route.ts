import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get('season_id') || '';
    if (!seasonId) return NextResponse.json({ error: 'season_id required' }, { status: 400 });
    const purchases = await db.getAuctionPurchases(seasonId);
    return NextResponse.json(purchases);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDB();
    const body = await req.json();
    const { season_id, team_id, player_id, purchase_price, group_number, is_captain } = body;
    if (!season_id || !team_id || !player_id || !purchase_price) {
      return NextResponse.json({ error: 'season_id, team_id, player_id, purchase_price required' }, { status: 400 });
    }

    // Block purchasing a captain or manager — they are pre-assigned and not for sale
    // Also block duplicate purchases of the same player in the same season
    const existing = await db.rawQuery(
      "SELECT team_role FROM auction_purchases WHERE season_id = ? AND player_id = ?",
      [season_id, player_id]
    ) as { team_role: string }[];
    if (existing.length > 0) {
      if (existing[0].team_role === 'captain' || existing[0].team_role === 'manager') {
        return NextResponse.json(
          { error: 'This player is a team captain or manager and cannot be purchased at auction.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Player has already been purchased in this season.' },
        { status: 409 }
      );
    }

    const purchase = await db.recordPurchase({ season_id, team_id, player_id, purchase_price, group_number, is_captain });
    return NextResponse.json(purchase, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
