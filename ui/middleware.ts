import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, isAuthDisabled, requireAuthToken } from './lib/auth';

const PUBLIC_PATHS = [
  '/login',
  '/api/login',
  '/api/logout',
  '/_next',
  '/favicon',
  '/icon',
  '/manifest',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAuthDisabled()) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (isPublic) {
    return NextResponse.next();
  }

  const expectedToken = (() => {
    try {
      return requireAuthToken();
    } catch {
      return null;
    }
  })();

  if (!expectedToken) {
    return NextResponse.json(
      { error: 'Server missing AUTH_TOKEN' },
      { status: 500 }
    );
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  if (sessionToken === expectedToken) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt).*)'],
};
