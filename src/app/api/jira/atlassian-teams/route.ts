import { NextRequest, NextResponse } from 'next/server';
import { getServerCredentials } from '@/lib/jira/client';

const TEAMS_BASE = 'https://api.atlassian.com/gateway/api/public/teams/v1';

function buildAuth(email: string, token: string) {
  const encoded = Buffer.from(`${email}:${token}`).toString('base64');
  return `Basic ${encoded}`;
}

export async function GET(request: NextRequest) {
  try {
    const credentials = getServerCredentials(request.headers);
    const orgId = process.env.ATLASSIAN_ORG_ID;

    if (!orgId) return NextResponse.json({ error: 'ATLASSIAN_ORG_ID not set.' }, { status: 500 });
    if (!credentials.email || !credentials.token) {
      return NextResponse.json({ error: 'Missing credentials.' }, { status: 400 });
    }

    const auth = buildAuth(credentials.email, credentials.token);
    const allTeams: Array<{ teamId: string; displayName: string }> = [];
    let cursor: string | undefined;

    while (true) {
      const url = new URL(`${TEAMS_BASE}/org/${orgId}/teams`);
      url.searchParams.set('maxResults', '50');
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await fetch(url.toString(), {
        headers: { Authorization: auth, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Teams list failed ${res.status}`);

      const data = await res.json();
      const teams: Array<{ teamId: string; displayName: string }> = data.entities ?? [];
      allTeams.push(...teams.filter((t) => t.displayName.startsWith('Plus')));

      cursor = data.cursor;
      if (!cursor || teams.length === 0) break;
    }

    allTeams.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return NextResponse.json({ teams: allTeams });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
