export interface JiraCredentials {
  baseUrl: string;
  email: string;
  token: string;
}

export function getServerCredentials(headers?: Headers): JiraCredentials {
  // Allow per-request override via X-Jira-* headers (multi-user mode)
  const baseUrl =
    headers?.get('X-Jira-Url') ||
    process.env.JIRA_BASE_URL ||
    '';
  const email =
    headers?.get('X-Jira-Email') ||
    process.env.JIRA_EMAIL ||
    '';
  const token =
    headers?.get('X-Jira-Token') ||
    process.env.JIRA_API_TOKEN ||
    '';

  return { baseUrl: baseUrl.replace(/\/$/, ''), email, token };
}

export function buildAuthHeader(credentials: JiraCredentials): string {
  const encoded = Buffer.from(`${credentials.email}:${credentials.token}`).toString('base64');
  return `Basic ${encoded}`;
}

export async function jiraFetch<T>(
  path: string,
  credentials: JiraCredentials,
  options: RequestInit = {}
): Promise<T> {
  const url = `${credentials.baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': buildAuthHeader(credentials),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira API error ${res.status} for ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}
