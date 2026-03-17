'use client';
import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { useEpics } from './useEpics';
import { useSettings } from './useSettings';
import { scheduleEpics, EpicWithEstimate } from '@/lib/scheduler/algorithm';
import { ScheduleResult, StatusCategory } from '@/lib/scheduler/types';
import { TEAM_COLORS } from '@/types/app';

function toStatusCategory(jiraKey: string): StatusCategory {
  if (jiraKey === 'done') return 'done';
  if (jiraKey === 'indeterminate') return 'inprogress';
  return 'todo';
}

export function useSchedule(): {
  result: ScheduleResult | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { epics, storyPointsFieldId, timeSpentFieldId, nwldFieldId, isLoading, error } = useEpics();
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
      const statusCatKey = epic.fields.status?.statusCategory?.key ?? 'new';
      const statusCategory = toStatusCategory(statusCatKey);
      // Done epics have 0 remaining regardless of fields
      const remaining = statusCategory === 'done' ? 0 : Math.max(0, sp - ts);

      const nwldRaw = nwldFieldId ? (epic.fields[nwldFieldId] as { value?: string } | string | null) : null;
      const nwld = nwldRaw ? (typeof nwldRaw === 'string' ? nwldRaw : (nwldRaw as { value?: string }).value ?? null) : null;

      if (!epicsByProject.has(projectKey)) {
        epicsByProject.set(projectKey, []);
      }
      epicsByProject.get(projectKey)!.push({
        epic,
        projectKey,
        storyPoints: sp,
        timeSpentDays: ts,
        remainingDays: remaining,
        status: epic.fields.status?.name ?? 'Unknown',
        statusCategory,
        nwld,
      });
    }

    const startDate = settings.scheduleStartDate
      ? parseISO(settings.scheduleStartDate)
      : new Date();

    return scheduleEpics(epicsByProject, settings.teams, startDate, colorMap, settings.schedulingMode ?? 'collaborate');
  }, [epics, storyPointsFieldId, timeSpentFieldId, nwldFieldId, settings.teams, settings.scheduleStartDate, settings.schedulingMode]);

  return {
    result,
    isLoading,
    error: error ?? null,
  };
}
