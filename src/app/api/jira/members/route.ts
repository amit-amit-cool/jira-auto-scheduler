import { NextRequest, NextResponse } from 'next/server';
import { getServerCredentials } from '@/lib/jira/client';
import { fetchProjectMembers, JiraUser } from '@/lib/jira/members';

export async function GET(request: NextRequest) {
  try {
    const credentials = getServerCredentials(request.headers);
    const { searchParams } = new URL(request.url);

    if (!credentials.baseUrl || !credentials.email || !credentials.token) {
      return NextResponse.json({ error: 'Missing Jira credentials.' }, { status: 400 });
    }

    const projectKey = searchParams.get('project');
    if (!projectKey) {
      return NextResponse.json({ error: 'No project key provided.' }, { status: 400 });
    }

    const members = await fetchProjectMembers(projectKey, credentials);
    return NextResponse.json({ members, projectKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
