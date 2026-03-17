import { NextResponse } from 'next/server';

export async function GET() {
  const configured = !!(
    process.env.JIRA_BASE_URL &&
    process.env.JIRA_EMAIL &&
    process.env.JIRA_API_TOKEN
  );

  return NextResponse.json({
    configured,
    baseUrl: configured ? process.env.JIRA_BASE_URL : null,
    email: configured ? process.env.JIRA_EMAIL : null,
  });
}
