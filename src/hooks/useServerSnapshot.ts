'use client';
import useSWR from 'swr';
import { SerializedScheduleResult, deserializeResult } from '@/lib/storage/savedSchedule';
import { ScheduleResult } from '@/lib/scheduler/types';

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<SerializedScheduleResult | null>;

export function useServerSnapshot(): { snapshot: ScheduleResult | null; savedAt: Date | null } {
  const { data } = useSWR<SerializedScheduleResult | null>('/api/schedule/snapshot', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  if (!data) return { snapshot: null, savedAt: null };
  return {
    snapshot: deserializeResult(data),
    savedAt: new Date(data.savedAt),
  };
}
