'use client';
import { useState, useCallback } from 'react';
import { parseISO } from 'date-fns';
import { useEpics } from './useEpics';
import { useSettings } from './useSettings';
import { useAppStore } from '@/store/appStore';
import { scheduleAllPhases, getPhases } from '@/lib/scheduler/phases';
import { EpicWithEstimate } from '@/lib/scheduler/algorithm';
import { StatusCategory } from '@/lib/scheduler/types';
import { TEAM_COLORS } from '@/types/app';

function toStatusCategory(jiraKey: string): StatusCategory {
  if (jiraKey === 'done') return 'done';
  if (jiraKey === 'indeterminate') return 'inprogress';
  return 'todo';
}

export function usePhaseSchedule() {
  const { epics, storyPointsFieldId, timeSpentFieldId, nwldFieldId } = useEpics();
  const { settings } = useSettings();
  const { savedSchedule, savedAt, saveSchedule, clearSchedule } = useAppStore();
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const phases = savedSchedule ? getPhases(savedSchedule) : [];

  const scheduleAndSave = useCallback(() => {
    if (!epics.length || !settings.teams.length) return;
    setIsScheduling(true);
    setScheduleError(null);

    try {
      const colorMap = new Map<string, string>();
      settings.teams.forEach((t, i) => {
        colorMap.set(t.projectKey, t.color || TEAM_COLORS[i % TEAM_COLORS.length]);
      });

      // Build flat list of EpicWithEstimate (same logic as useSchedule)
      const allEpics: EpicWithEstimate[] = [];
      for (const epic of epics) {
        const projectKey = (epic.fields as Record<string, unknown>)?.['project']
          ? ((epic.fields as Record<string, unknown>)['project'] as { key: string })?.key
          : epic.key.split('-')[0];

        const sp = storyPointsFieldId
          ? (epic.fields[storyPointsFieldId] as number | null) ?? 0 : 0;
        const ts = timeSpentFieldId
          ? (epic.fields[timeSpentFieldId] as number | null) ?? 0 : 0;
        const statusCatKey = epic.fields.status?.statusCategory?.key ?? 'new';
        const statusCategory = toStatusCategory(statusCatKey);
        const remaining = statusCategory === 'done' ? 0 : Math.max(0, sp - ts);

        const nwldRaw = nwldFieldId
          ? (epic.fields[nwldFieldId] as { value?: string } | string | null) : null;
        const nwld = nwldRaw
          ? (typeof nwldRaw === 'string' ? nwldRaw : (nwldRaw as { value?: string }).value ?? null)
          : null;

        allEpics.push({
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

      // Only schedule epics whose NWLD starts with V1–V4 (e.g. "V1 Foundation", "V2 Launch")
      const phasedEpics = allEpics.filter(e => e.nwld && /^v[1-4]/i.test(e.nwld));

      const result = scheduleAllPhases(
        phasedEpics,
        settings.teams,
        startDate,
        colorMap,
        settings.schedulingMode ?? 'collaborate'
      );

      saveSchedule(result);
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsScheduling(false);
    }
  }, [epics, storyPointsFieldId, timeSpentFieldId, nwldFieldId, settings, saveSchedule]);

  return {
    savedSchedule,
    savedAt,
    phases,
    isScheduling,
    scheduleError,
    scheduleAndSave,
    clearSchedule,
    canSchedule: epics.length > 0 && settings.teams.length > 0,
  };
}
