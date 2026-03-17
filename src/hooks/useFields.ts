'use client';
import useSWR from 'swr';
import { useSettings } from './useSettings';
import { useServerConfig } from './useServerConfig';
import { buildClientHeaders } from '@/lib/jira/clientHeaders';

const fetcher = (url: string, headers: Record<string, string>) =>
  fetch(url, { headers }).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch fields');
    return r.json();
  });

export function useFields() {
  const { settings, isLoaded } = useSettings();
  const serverConfig = useServerConfig();
  const headers = buildClientHeaders(settings);
  const hasCredentials =
    serverConfig.configured ||
    !!(settings.jiraBaseUrl && settings.jiraEmail && settings.jiraToken);

  const { data, error, isLoading } = useSWR(
    isLoaded && hasCredentials ? ['/api/jira/fields', headers] : null,
    ([url, hdrs]) => fetcher(url, hdrs),
    { revalidateOnFocus: false }
  );

  return {
    fields: data?.fields ?? [],
    storyPointsFieldId: settings.fieldOverrides.storyPointsFieldId ?? data?.storyPointsFieldId ?? null,
    timeSpentFieldId: settings.fieldOverrides.timeSpentFieldId ?? data?.timeSpentFieldId ?? null,
    error,
    isLoading,
  };
}
