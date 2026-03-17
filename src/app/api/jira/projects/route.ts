import { NextRequest, NextResponse } from 'next/server';
import { getServerCredentials, jiraFetch } from '@/lib/jira/client';
import { JiraProject } from '@/types/jira';

interface ProjectSearchResponse {
  values: JiraProject[];
  total: number;
  isLast: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const credentials = getServerCredentials(request.headers);

    if (!credentials.baseUrl || !credentials.email || !credentials.token) {
      return NextResponse.json(
        { error: 'Missing Jira credentials.' },
        { status: 400 }
      );
    }

    const allProjects: JiraProject[] = [];
    let startAt = 0;
    let isLast = false;

    while (!isLast) {
      const page = await jiraFetch<ProjectSearchResponse>(
        `/rest/api/3/project/search?maxResults=50&startAt=${startAt}&orderBy=name`,
        credentials
      );
      allProjects.push(...page.values);
      isLast = page.isLast;
      startAt += page.values.length;
      if (page.values.length === 0) break;
    }

    return NextResponse.json({ projects: allProjects });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
