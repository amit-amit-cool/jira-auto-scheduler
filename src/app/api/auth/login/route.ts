import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'site-auth';
const SESSION_TOKEN = process.env.SITE_SESSION_TOKEN ?? '';

const VALID_USERS = [
  { username: process.env.SITE_USERNAME ?? '', password: process.env.SITE_PASSWORD ?? '' },
  { username: 'amit', password: 'amit' },
];

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const isValid = VALID_USERS.some(u => u.username === username && u.password === password);
  if (!isValid) {
    return NextResponse.json({ error: 'Incorrect username or password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, SESSION_TOKEN, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return response;
}
