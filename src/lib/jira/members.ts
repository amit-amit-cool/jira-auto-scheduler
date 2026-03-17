import { JiraCredentials, jiraFetch } from './client';

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

const TEAMS_BASE = 'https://api.atlassian.com/gateway/api/public/teams/v1';

// Module-level cache: orgId → (teamName → teamId)
const teamNameCache = new Map<string, Map<string, string>>();

function buildAuth(credentials: JiraCredentials): string {
  const encoded = Buffer.from(`${credentials.email}:${credentials.token}`).toString('base64');
  return `Basic ${encoded}`;
}

// Normalize team/project name for matching: strip common suffixes, lowercase
function normalize(name: string): string {
  return name
    .replace(/\s*[-–]\s*(R&D|RnD|Tech|Engineering|Dev)$/i, '')
    .trim()
    .toLowerCase();
}

// Fetch ALL teams for the org and build a name→teamId map
async function buildTeamCache(orgId: string, credentials: JiraCredentials): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let cursor: string | undefined;

  while (true) {
    const url = new URL(`${TEAMS_BASE}/org/${orgId}/teams`);
    url.searchParams.set('maxResults', '50');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: { Authorization: buildAuth(credentials), Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Teams list failed ${res.status}`);

    const data = await res.json();
    const teams: Array<{ teamId: string; displayName: string }> = data.entities ?? [];

    for (const t of teams) {
      map.set(normalize(t.displayName), t.teamId);
      map.set(t.displayName.toLowerCase(), t.teamId); // also store exact lowercase
    }

    cursor = data.cursor;
    if (!cursor || teams.length === 0) break;
  }

  return map;
}

async function findTeamId(orgId: string, projectName: string, credentials: JiraCredentials): Promise<string | null> {
  if (!teamNameCache.has(orgId)) {
    teamNameCache.set(orgId, await buildTeamCache(orgId, credentials));
  }
  const cache = teamNameCache.get(orgId)!;
  return cache.get(normalize(projectName)) ?? cache.get(projectName.toLowerCase()) ?? null;
}

// POST /members → { results: [{ accountId }], pageInfo: { hasNextPage, endCursor } }
async function fetchTeamMemberIds(orgId: string, teamId: string, credentials: JiraCredentials): Promise<string[]> {
  const accountIds: string[] = [];
  let cursor: string | undefined;

  while (true) {
    const body: Record<string, unknown> = { maxResults: 50 };
    if (cursor) body.cursor = cursor;

    const res = await fetch(`${TEAMS_BASE}/org/${orgId}/teams/${teamId}/members`, {
      method: 'POST',
      headers: {
        Authorization: buildAuth(credentials),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Team members fetch failed ${res.status}`);

    const data = await res.json();
    const results: Array<{ accountId: string }> = data.results ?? [];
    accountIds.push(...results.map((r) => r.accountId));

    if (!data.pageInfo?.hasNextPage || results.length === 0) break;
    cursor = data.pageInfo.endCursor;
  }

  return accountIds;
}

// Resolve accountIds → display names via Jira bulk user API
async function resolveUsers(accountIds: string[], credentials: JiraCredentials): Promise<JiraUser[]> {
  if (accountIds.length === 0) return [];
  const params = accountIds.map((id) => `accountId=${encodeURIComponent(id)}`).join('&');
  const data = await jiraFetch<{ values: JiraUser[] } | JiraUser[]>(
    `/rest/api/3/user/bulk?${params}&maxResults=200`,
    credentials
  );
  return Array.isArray(data) ? data : (data as { values: JiraUser[] }).values ?? [];
}

export async function fetchProjectMembers(
  projectKey: string,
  credentials: JiraCredentials,
  projectName?: string,
  atlassianTeamId?: string
): Promise<JiraUser[]> {
  const orgId = process.env.ATLASSIAN_ORG_ID;
  if (!orgId) throw new Error('ATLASSIAN_ORG_ID is not set in environment.');

  // Use explicit teamId if provided, otherwise try name matching
  const teamId = atlassianTeamId ?? await findTeamId(orgId, projectName ?? projectKey, credentials);
  if (!teamId) throw new Error(`No Atlassian team found matching "${projectName ?? projectKey}".`);

  const accountIds = await fetchTeamMemberIds(orgId, teamId, credentials);
  if (accountIds.length === 0) return [];

  return resolveUsers(accountIds, credentials);
}
