import { NextResponse } from 'next/server';

const JIRA_BASE_URL = process.env.NEXT_PUBLIC_JIRA_BASE_URL ?? '';
const JIRA_EMAIL = process.env.NEXT_PUBLIC_JIRA_EMAIL ?? '';

export async function GET() {
  return NextResponse.json({ configured: false, baseUrl: JIRA_BASE_URL, email: JIRA_EMAIL });
}
