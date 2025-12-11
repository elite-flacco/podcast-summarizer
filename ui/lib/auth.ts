import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'pod-worker-session';

export function requireAuthToken(): string {
  const token = process.env.AUTH_TOKEN;
  if (!token) {
    throw new Error(
      'Missing AUTH_TOKEN environment variable for the UI authentication gate.'
    );
  }
  return token;
}

export function getSessionTokenFromCookies(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}

export function setSessionCookie(response: NextResponse) {
  const token = requireAuthToken();
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE);
}
