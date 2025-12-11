import { NextResponse } from 'next/server';
import { requireAuthToken, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  const expectedToken = requireAuthToken();

  let providedToken = '';
  try {
    const payload = await request.json();
    providedToken = payload?.token ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!providedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  setSessionCookie(response);
  return response;
}
