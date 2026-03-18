'use client';
import { useState, useCallback } from 'react';
import { parseISO } from 'date-fns';
import { useEpics } from './useEpics';
import { useSettings } from './useSettings';
import { useServerSnapshot } from './useServerSnapshot';
import { useAppStore } from '@/store/appStore';
import { scheduleAllPhases, getPhases } from '@/lib/scheduler/phases';
import { EpicWithEstimate } from '@/lib/scheduler/algorithm';
import { ScheduleResult, StatusCategory, ScheduledEpic } from '@/lib/scheduler/types';
import { TEAM_COLORS, TeamConfig } from '@/types/app';
import { JiraEpic } from '@/types/jira';
import { mutate as swrMutate } from 'swr';

function toStatusCategory(jiraKey: string): StatusCategory {
  if (jiraKey === 'done') return 'done';
  if (jiraKey === 'indeterminate') return 'inprogress';
  return 'todo';
}

/** Reconstruct minimal EpicWithEstimate[] from a saved ScheduleResult (no Jira needed). */
function snapshotToEstimates(result: ScheduleResult): EpicWithEstimate[] {
  return result.teams.flatMap((team) =>
    team.epics.map((e: ScheduledEpic) => ({
      epic: {
        id: e.id,
        key: e.key,
        fields: {
          summary: e.summary,
          status: {
            name: e.status,
            statusCategory: {
              key: e.statusCategory === 'done'
                ? 'done'
                : e.statusCategory === 'inprogress'
                  ? 'indeterminate'
                  : 'new',
            },
          },
        },
      } as JiraEpic,
      projectKey: e.projectKey,
      storyPoints: e.storyPoints,
      timeSpentDays: e.timeSpentDays,
      remainingDays: e.remainingDays,
      status: e.status,
      statusCategory: e.statusCategory,
      nwld: e.nwld,
    }))
  );
}

async function pushSnapshotToServer(result: ScheduleResult) {
  const serialized = {
    ...result,
    overallCompletionDate: result.overallCompletionDate?.toISOString() ?? null,
    savedAt: new Date().toISOString(),
    teams: result.teams.map((t) => ({
      ...t,
      completionDate: t.completionDate?.toISOString() ?? null,
      epics: t.epics.map((e) => ({
        ...e,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
      })),
    })),
  };

  await fetch('/api/schedule/snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serialized),
  });

  swrMutate('/api/schedule/snapshot');
}

/** Extract TeamConfig[] from a saved ScheduleResult (used when user has no local team settings). */
function teamsFromSnapshot(result: ScheduleResult): TeamConfig[] {
  return result.teams.map((t, i) => ({
    projectKey: t.projectKey,
    projectName: t.projectName,
    color: t.color || TEAM_COLORS[i % TEAM_COLORS.length],
    // Reconstruct a single synthetic member representing total capacity
    members: [{
      accountId: `synthetic-${t.projectKey}`,
      displayName: t.projectName,
      hoursPerWeek: t.weeklyCapacityDays * 8,
    }],
  }));
}

function applyBuffer(estimates: EpicWithEstimate[], bufferPct: number): EpicWithEstimate[] {
  if (!bufferPct) return estimates;
  const mult = 1 + bufferPct / 100;
  return estimates.map((e) => ({
    ...e,
    remainingDays: e.statusCategory === 'done' ? 0 : e.remainingDays * mult,
  }));
}

function runSchedule(
  epicEstimates: EpicWithEstimate[],
  teams: TeamConfig[],
  settings: ReturnType<typeof useSettings>['settings']
): ScheduleResult {
  const colorMap = new Map<string, string>();
  teams.forEach((t, i) => {
    colorMap.set(t.projectKey, t.color || TEAM_COLORS[i % TEAM_COLORS.length]);
  });

  const startDate = settings.scheduleStartDate
    ? parseISO(settings.scheduleStartDate)
    : new Date();

  const phasedEpics = applyBuffer(
    epicEstimates.filter(e => e.nwld && /^v[1-4]/i.test(e.nwld)),
    settings.estimationBuffer ?? 0
  );

  return scheduleAllPhases(
    phasedEpics,
    teams,
    startDate,
    colorMap,
    settings.schedulingMode ?? 'collaborate'
  );
}

export function usePhaseSchedule() {
  const { epics, storyPointsFieldId, timeSpentFieldId, nwldFieldId, hasCredentials, snapshotTeams, mutate: epicsMutate } = useEpics();
  const { settings } = useSettings();
  const { savedSchedule, savedAt, saveSchedule, clearSchedule } = useAppStore();
  const { snapshot: serverSnapshot } = useServerSnapshot();
  const [isScheduling, setIsScheduling] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const phases = savedSchedule ? getPhases(savedSchedule) : [];

  // Use local teams if configured, otherwise fall back to imported snapshot teams, then schedule snapshot
  const effectiveTeams = settings.teams.length > 0
    ? settings.teams
    : snapshotTeams ?? (serverSnapshot ? teamsFromSnapshot(serverSnapshot) : []);

  /** Build EpicWithEstimate[] from Jira epics. */
  const buildFromJiraEpics = useCallback((): EpicWithEstimate[] => {
    return epics.map((epic) => {
      const projectKey = (epic.fields as Record<string, unknown>)?.['project']
        ? ((epic.fields as Record<string, unknown>)['project'] as { key: string })?.key
        : epic.key.split('-')[0];

      const sp = storyPointsFieldId ? (epic.fields[storyPointsFieldId] as number | null) ?? 0 : 0;
      const ts = timeSpentFieldId ? (epic.fields[timeSpentFieldId] as number | null) ?? 0 : 0;
      const statusCatKey = epic.fields.status?.statusCategory?.key ?? 'new';
      const statusCategory = toStatusCategory(statusCatKey);
      const remaining = statusCategory === 'done' ? 0 : Math.max(0, sp - ts);

      const nwldRaw = nwldFieldId
        ? (epic.fields[nwldFieldId] as { value?: string } | string | null)
        : null;
      const nwld = nwldRaw
        ? (typeof nwldRaw === 'string' ? nwldRaw : (nwldRaw as { value?: string }).value ?? null)
        : null;

      return { epic, projectKey, storyPoints: sp, timeSpentDays: ts, remainingDays: remaining,
        status: epic.fields.status?.name ?? 'Unknown', statusCategory, nwld };
    });
  }, [epics, storyPointsFieldId, timeSpentFieldId, nwldFieldId]);

  const scheduleAndSave = useCallback(() => {
    if (!effectiveTeams.length) return;
    setIsScheduling(true);
    setScheduleError(null);

    try {
      // Use Jira epics if loaded, otherwise fall back to snapshot data
      const estimates = epics.length > 0
        ? buildFromJiraEpics()
        : serverSnapshot
          ? snapshotToEstimates(serverSnapshot)
          : [];

      if (!estimates.length) {
        setScheduleError('No epic data available. Sync from Jira or wait for snapshot to load.');
        return;
      }

      const result = runSchedule(estimates, effectiveTeams, settings);
      saveSchedule(result);
      pushSnapshotToServer(result).catch(() => {/* non-fatal */});
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsScheduling(false);
    }
  }, [epics, buildFromJiraEpics, serverSnapshot, effectiveTeams, settings, saveSchedule]);

  /** Fetch fresh data from Jira, then re-run the scheduler. Only works when credentials are set. */
  const syncFromJira = useCallback(async () => {
    if (!hasCredentials || !settings.teams.length) return;
    setIsSyncing(true);
    setScheduleError(null);

    try {
      const freshData = await epicsMutate();
      const freshEpics = freshData?.epics ?? [];

      if (!freshEpics.length) {
        setScheduleError('No epics returned from Jira.');
        return;
      }

      // Rebuild estimates from fresh data
      const spField = freshData?.storyPointsFieldId ?? storyPointsFieldId;
      const tsField = freshData?.timeSpentFieldId ?? timeSpentFieldId;
      const nwldField = freshData?.nwldFieldId ?? nwldFieldId;

      const estimates: EpicWithEstimate[] = freshEpics.map((epic) => {
        const projectKey = (epic.fields as Record<string, unknown>)?.['project']
          ? ((epic.fields as Record<string, unknown>)['project'] as { key: string })?.key
          : epic.key.split('-')[0];

        const sp = spField ? (epic.fields[spField] as number | null) ?? 0 : 0;
        const ts = tsField ? (epic.fields[tsField] as number | null) ?? 0 : 0;
        const statusCatKey = epic.fields.status?.statusCategory?.key ?? 'new';
        const statusCategory = toStatusCategory(statusCatKey);
        const remaining = statusCategory === 'done' ? 0 : Math.max(0, sp - ts);

        const nwldRaw = nwldField
          ? (epic.fields[nwldField] as { value?: string } | string | null)
          : null;
        const nwld = nwldRaw
          ? (typeof nwldRaw === 'string' ? nwldRaw : (nwldRaw as { value?: string }).value ?? null)
          : null;

        return { epic, projectKey, storyPoints: sp, timeSpentDays: ts, remainingDays: remaining,
          status: epic.fields.status?.name ?? 'Unknown', statusCategory, nwld };
      });

      const result = runSchedule(estimates, effectiveTeams, settings);
      saveSchedule(result);
      await pushSnapshotToServer(result);
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsSyncing(false);
    }
  }, [hasCredentials, epicsMutate, storyPointsFieldId, timeSpentFieldId, nwldFieldId, settings, effectiveTeams, saveSchedule]);

  const canSchedule = (epics.length > 0 || !!serverSnapshot) && effectiveTeams.length > 0;

  return {
    savedSchedule,
    savedAt,
    phases,
    isScheduling,
    isSyncing,
    scheduleError,
    scheduleAndSave,
    syncFromJira,
    clearSchedule,
    hasCredentials,
    canSchedule,
    effectiveTeams,
  };
}
