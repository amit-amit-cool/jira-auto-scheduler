'use client';
import useSWR from 'swr';

interface ServerConfig {
  configured: boolean;
  baseUrl: string | null;
  email: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useServerConfig() {
  const { data } = useSWR<ServerConfig>('/api/jira/server-config', fetcher, {
    revalidateOnFocus: false,
  });
  return data ?? { configured: false, baseUrl: null, email: null };
}
