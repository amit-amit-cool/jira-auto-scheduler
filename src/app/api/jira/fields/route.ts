import { NextRequest, NextResponse } from 'next/server';
import { getServerCredentials, jiraFetch } from '@/lib/jira/client';
import { JiraField } from '@/types/jira';
import { discoverFieldIds } from '@/lib/jira/fields';

export async function GET(request: NextRequest) {
  try {
    const credentials = getServerCredentials(request.headers);

    if (!credentials.baseUrl || !credentials.email || !credentials.token) {
      return NextResponse.json(
        { error: 'Missing Jira credentials. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN or pass X-Jira-* headers.' },
        { status: 400 }
      );
    }

    const fields = await jiraFetch<JiraField[]>('/rest/api/3/field', credentials);
    const discovered = discoverFieldIds(fields);

    return NextResponse.json({ fields, ...discovered });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
