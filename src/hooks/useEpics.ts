'use client';
import useSWR from 'swr';
import { useSettings } from './useSettings';
import { useFields } from './useFields';
import { useServerConfig } from './useServerConfig';
import { buildClientHeaders } from '@/lib/jira/clientHeaders';
import { JiraEpic } from '@/types/jira';

interface EpicsResponse {
  epics: JiraEpic[];
  storyPointsFieldId: string | null;
  timeSpentFieldId: string | null;
  nwldFieldId: string | null;
  total: number;
  teams?: import('@/types/app').TeamConfig[];
}

const fetcher = (url: string, headers: Record<string, string>): Promise<EpicsResponse> =>
  fetch(url, { headers }).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch epics');
    return r.json();
  });

const snapshotFetcher = (url: string): Promise<EpicsResponse | null> =>
  fetch(url).then((r) => r.json());

export function useEpics() {
  const { settings, isLoaded } = useSettings();
  const { storyPointsFieldId, timeSpentFieldId, nwldFieldId } = useFields();
  const serverConfig = useServerConfig();
  const headers = buildClientHeaders(settings);

  const projects = settings.selectedProjectKeys;
  const hasCredentials =
    serverConfig.configured ||
    !!(settings.jiraBaseUrl && settings.jiraEmail && settings.jiraToken);
  const hasProjects = projects.length > 0;

  const params = new URLSearchParams({ projects: projects.join(',') });
  if (storyPointsFieldId) params.set('storyPointsFieldId', storyPointsFieldId);
  if (timeSpentFieldId) params.set('timeSpentFieldId', timeSpentFieldId);
  if (nwldFieldId) params.set('nwldFieldId', nwldFieldId);

  const { data: liveData, error, isLoading, mutate } = useSWR(
    isLoaded && hasCredentials && hasProjects && (storyPointsFieldId || timeSpentFieldId)
      ? [`/api/jira/epics?${params}`, headers, nwldFieldId]
      : null,
    ([url, hdrs]) => fetcher(url, hdrs),
    { revalidateOnFocus: false }
  );

  // Fall back to server-side epics snapshot when no credentials
  const { data: snapshotData } = useSWR(
    !hasCredentials ? '/api/epics/snapshot' : null,
    snapshotFetcher,
    { revalidateOnFocus: false }
  );

  const data = liveData ?? snapshotData ?? null;

  return {
    epics: data?.epics ?? [],
    storyPointsFieldId: data?.storyPointsFieldId ?? storyPointsFieldId,
    timeSpentFieldId: data?.timeSpentFieldId ?? timeSpentFieldId,
    nwldFieldId: data?.nwldFieldId ?? nwldFieldId,
    total: data?.total ?? 0,
    snapshotTeams: snapshotData?.teams ?? null,
    hasCredentials,
    error,
    isLoading,
    mutate,
  };
}
