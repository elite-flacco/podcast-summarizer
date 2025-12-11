import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function GET(request: Request) {
  const redirectUrl = new URL('/', request.url);
  const response = NextResponse.redirect(redirectUrl);
  clearSessionCookie(response);
  return response;
}
