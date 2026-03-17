import { JiraEpic } from '@/types/jira';
import { JiraCredentials, jiraFetch } from './client';

interface SearchPage {
  issues: JiraEpic[];
  isLast: boolean;
  nextPageToken?: string;
}

export async function fetchAllEpics(
  projectKeys: string[],
  credentials: JiraCredentials,
  extraFields: string[] = []
): Promise<JiraEpic[]> {
  if (projectKeys.length === 0) return [];

  const projectList = projectKeys.join(',');
  const baseFields = ['summary', 'status', 'assignee', 'priority', 'project'];
  const allFields = Array.from(new Set([...baseFields, ...extraFields]));

  const pageSize = 100;
  const allIssues: JiraEpic[] = [];
  let nextPageToken: string | undefined;
  let isLast = false;

  while (!isLast) {
    const body: Record<string, unknown> = {
      jql: `project in (${projectList}) AND issuetype = Epic ORDER BY rank ASC`,
      fields: allFields,
      maxResults: pageSize,
    };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const page = await jiraFetch<SearchPage>(
      `/rest/api/3/search/jql`,
      credentials,
      { method: 'POST', body: JSON.stringify(body) }
    );
    allIssues.push(...page.issues);
    isLast = page.isLast;
    nextPageToken = page.nextPageToken;
    if (page.issues.length === 0) break;
  }

  return allIssues;
}
