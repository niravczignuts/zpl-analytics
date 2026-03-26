import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    await db.deletePurchase(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
