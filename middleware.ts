import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets, login page, and auth API
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon') ||
    /\.(?:png|jpe?g|svg|ico|webp|gif|woff2?|ttf|otf|mp3|wav)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // RUNTIME_TOKEN changes on every server restart — old cookies are automatically invalid
  const auth = request.cookies.get('zpl_auth')?.value;
  if (auth && auth === process.env.RUNTIME_TOKEN) return NextResponse.next();

  // API routes → 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pages → redirect to login
  const url = new URL('/login', request.url);
  url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Only run middleware on page/API routes — never on static files or Next.js internals
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|ico|webp|woff2?|ttf|otf|mp3|wav|pdf)).*)',
  ],
};
