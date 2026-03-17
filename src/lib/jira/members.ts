import { JiraCredentials, jiraFetch } from './client';

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  accountType: string;
  active: boolean;
  avatarUrls?: Record<string, string>;
}

export async function fetchProjectMembers(
  projectKey: string,
  credentials: JiraCredentials
): Promise<JiraUser[]> {
  const allUsers: JiraUser[] = [];
  let startAt = 0;

  while (true) {
    const page = await jiraFetch<JiraUser[]>(
      `/rest/api/3/user/assignable/search?project=${projectKey}&maxResults=50&startAt=${startAt}`,
      credentials
    );

    if (!page || page.length === 0) break;

    // Only include active human accounts (not apps/bots)
    const humans = page.filter(
      (u) => u.active && u.accountType === 'atlassian'
    );
    allUsers.push(...humans);

    if (page.length < 50) break;
    startAt += page.length;
  }

  return allUsers;
}
