'use client';
import { useState } from 'react';
import { format } from 'date-fns';
import { useSchedule } from './useSchedule';
import { useSettings } from './useSettings';
import { buildClientHeaders } from '@/lib/jira/clientHeaders';

interface PublishResult {
  succeeded: number;
  failed: number;
  total: number;
}

export function usePublish() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { result: schedule } = useSchedule();
  const { settings } = useSettings();

  const publish = async () => {
    if (!schedule) return;
    setIsPublishing(true);
    setError(null);
    setResult(null);

    try {
      const epics = schedule.teams
        .flatMap((t) => t.epics)
        .map((epic) => ({
          key: epic.key,
          startDate: format(epic.startDate, 'yyyy-MM-dd'),
          endDate: format(epic.endDate, 'yyyy-MM-dd'),
        }));

      const res = await fetch('/api/jira/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildClientHeaders(settings),
        },
        body: JSON.stringify({ epics }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publish failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPublishing(false);
    }
  };

  return { publish, isPublishing, result, error };
}
