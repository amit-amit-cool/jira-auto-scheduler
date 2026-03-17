import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'site-auth';
const VALID_USERNAME = process.env.SITE_USERNAME ?? '';
const VALID_PASSWORD = process.env.SITE_PASSWORD ?? '';
const SESSION_TOKEN = process.env.SITE_SESSION_TOKEN ?? '';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect username or password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, SESSION_TOKEN, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
  return response;
}
