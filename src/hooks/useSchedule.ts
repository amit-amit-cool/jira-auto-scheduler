'use client';
import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { useEpics } from './useEpics';
import { useSettings } from './useSettings';
import { scheduleEpics, EpicWithEstimate } from '@/lib/scheduler/algorithm';
import { ScheduleResult } from '@/lib/scheduler/types';
import { TEAM_COLORS } from '@/types/app';

export function useSchedule(): {
  result: ScheduleResult | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { epics, storyPointsFieldId, timeSpentFieldId, isLoading, error } = useEpics();
  const { settings } = useSettings();

  const result = useMemo(() => {
    if (!epics.length || !settings.teams.length) return null;

    const colorMap = new Map<string, string>();
    settings.teams.forEach((t, i) => {
      colorMap.set(t.projectKey, t.color || TEAM_COLORS[i % TEAM_COLORS.length]);
    });

    // Group epics by project
    const epicsByProject = new Map<string, EpicWithEstimate[]>();
    for (const epic of epics) {
      const projectKey = (epic.fields as Record<string, unknown>)?.['project']
        ? ((epic.fields as Record<string, unknown>)['project'] as { key: string })?.key
        : epic.key.split('-')[0];

      const sp = storyPointsFieldId
        ? (epic.fields[storyPointsFieldId] as number | null) ?? 0
        : 0;
      const ts = timeSpentFieldId
        ? (epic.fields[timeSpentFieldId] as number | null) ?? 0
        : 0;
      const remaining = Math.max(0, sp - ts);

      if (!epicsByProject.has(projectKey)) {
        epicsByProject.set(projectKey, []);
      }
      epicsByProject.get(projectKey)!.push({
        epic,
        projectKey,
        storyPoints: sp,
        timeSpentDays: ts,
        remainingDays: remaining,
      });
    }

    const startDate = settings.scheduleStartDate
      ? parseISO(settings.scheduleStartDate)
      : new Date();

    return scheduleEpics(epicsByProject, settings.teams, startDate, colorMap);
  }, [epics, storyPointsFieldId, timeSpentFieldId, settings.teams, settings.scheduleStartDate]);

  return {
    result,
    isLoading,
    error: error ?? null,
  };
}
