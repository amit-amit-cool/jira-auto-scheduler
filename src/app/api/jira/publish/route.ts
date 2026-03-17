import { NextRequest, NextResponse } from 'next/server';
import { getServerCredentials, jiraFetch, buildAuthHeader, JiraCredentials } from '@/lib/jira/client';
import { JiraField } from '@/types/jira';

const PLUS_START_FIELD = 'PLUS Start Date';
const PLUS_END_FIELD = 'PLUS End Date';

interface PublishEpic {
  key: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

async function ensureField(
  name: string,
  allFields: JiraField[],
  credentials: JiraCredentials
): Promise<string> {
  const existing = allFields.find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;

  const created = await jiraFetch<{ id: string }>('/rest/api/3/field', credentials, {
    method: 'POST',
    body: JSON.stringify({
      name,
      type: 'com.atlassian.jira.plugin.system.customfieldtypes:datepicker',
      searcherKey: 'com.atlassian.jira.plugin.system.customfieldtypes:daterange',
    }),
  });
  return created.id;
}

async function updateEpic(
  key: string,
  fields: Record<string, string>,
  credentials: JiraCredentials
): Promise<void> {
  const url = `${credentials.baseUrl}/rest/api/2/issue/${key}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: buildAuthHeader(credentials),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to update ${key}: ${res.status} ${body}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const credentials = getServerCredentials(request.headers);
    if (!credentials.baseUrl || !credentials.email || !credentials.token) {
      return NextResponse.json({ error: 'Missing Jira credentials.' }, { status: 400 });
    }

    const { epics }: { epics: PublishEpic[] } = await request.json();
    if (!epics?.length) {
      return NextResponse.json({ error: 'No epics provided.' }, { status: 400 });
    }

    const allFields = await jiraFetch<JiraField[]>('/rest/api/3/field', credentials);
    const startFieldId = await ensureField(PLUS_START_FIELD, allFields, credentials);
    const endFieldId = await ensureField(PLUS_END_FIELD, allFields, credentials);

    const results = await Promise.allSettled(
      epics.map((epic) =>
        updateEpic(epic.key, { [startFieldId]: epic.startDate, [endFieldId]: epic.endDate }, credentials)
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason?.message ?? String(r.reason));

    return NextResponse.json({ succeeded, failed, total: epics.length, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
