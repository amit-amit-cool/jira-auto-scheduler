'use client';
import useSWR from 'swr';
import { useSettings } from './useSettings';
import { useServerConfig } from './useServerConfig';
import { buildClientHeaders } from '@/lib/jira/clientHeaders';
import { JiraRoleActor } from '@/types/jira';

const fetcher = (url: string, headers: Record<string, string>) =>
  fetch(url, { headers }).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch members');
    return r.json();
  });

export function useMembers(projectKey: string | null) {
  const { settings, isLoaded } = useSettings();
  const serverConfig = useServerConfig();
  const headers = buildClientHeaders(settings);
  const hasCredentials =
    serverConfig.configured ||
    !!(settings.jiraBaseUrl && settings.jiraEmail && settings.jiraToken);

  const { data, error, isLoading } = useSWR(
    isLoaded && hasCredentials && projectKey
      ? [`/api/jira/members?project=${projectKey}`, headers]
      : null,
    ([url, hdrs]) => fetcher(url, hdrs),
    { revalidateOnFocus: false }
  );

  return {
    members: (data?.members ?? []) as JiraRoleActor[],
    error,
    isLoading,
  };
}
