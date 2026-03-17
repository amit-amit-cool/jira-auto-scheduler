import { NextRequest, NextResponse } from 'next/server';
import { getServerCredentials } from '@/lib/jira/client';
import { fetchAllEpics } from '@/lib/jira/epics';
import { discoverFieldIds } from '@/lib/jira/fields';
import { JiraField } from '@/types/jira';
import { jiraFetch } from '@/lib/jira/client';

export async function GET(request: NextRequest) {
  try {
    const credentials = getServerCredentials(request.headers);
    const { searchParams } = new URL(request.url);

    if (!credentials.baseUrl || !credentials.email || !credentials.token) {
      return NextResponse.json({ error: 'Missing Jira credentials.' }, { status: 400 });
    }

    const projectKeys = searchParams.get('projects')?.split(',').filter(Boolean) || [];
    if (projectKeys.length === 0) {
      return NextResponse.json({ error: 'No project keys provided.' }, { status: 400 });
    }

    // Discover field IDs (or use overrides)
    const spOverride = searchParams.get('storyPointsFieldId') || undefined;
    const tsOverride = searchParams.get('timeSpentFieldId') || undefined;

    let storyPointsFieldId: string | null = spOverride || null;
    let timeSpentFieldId: string | null = tsOverride || null;

    if (!storyPointsFieldId || !timeSpentFieldId) {
      const allFields = await jiraFetch<JiraField[]>('/rest/api/3/field', credentials);
      const discovered = discoverFieldIds(allFields, {
        storyPointsFieldId: spOverride,
        timeSpentFieldId: tsOverride,
      });
      storyPointsFieldId = storyPointsFieldId || discovered.storyPointsFieldId;
      timeSpentFieldId = timeSpentFieldId || discovered.timeSpentFieldId;
    }

    // Fetch epics with custom fields
    const extraFields = [
      storyPointsFieldId,
      timeSpentFieldId,
    ].filter((f): f is string => !!f);

    const epics = await fetchAllEpics(projectKeys, credentials, extraFields);

    return NextResponse.json({
      epics,
      storyPointsFieldId,
      timeSpentFieldId,
      total: epics.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
