import { NextRequest, NextResponse } from 'next/server';

const PASSWORD = process.env.APP_PASSWORD || 'Ai@1234';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (password !== PASSWORD) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }
    // Cookie stores the RUNTIME_TOKEN — becomes invalid the moment the server restarts
    const token = process.env.RUNTIME_TOKEN;
    if (!token) return NextResponse.json({ error: 'Server not ready' }, { status: 503 });

    const res = NextResponse.json({ success: true });
    res.cookies.set('zpl_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 hours within a single server run
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('zpl_auth', '', { maxAge: 0, path: '/' });
  return res;
}
