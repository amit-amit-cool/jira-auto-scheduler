import { addDays, isWeekend } from 'date-fns';
import { ScheduleResult, TeamSchedule, ScheduledEpic } from './types';
import { scheduleEpics, EpicWithEstimate } from './algorithm';
import { TeamConfig } from '@/types/app';

function nextBusinessDay(date: Date): Date {
  let d = addDays(date, 1);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

function sortPhaseKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    // null/empty goes last
    if (!a) return 1;
    if (!b) return -1;
    // Extract the number immediately after the leading V: "V1 Q3 2025" → 1
    const numA = parseInt(a.match(/^[Vv](\d+)/)?.[1] ?? '', 10);
    const numB = parseInt(b.match(/^[Vv](\d+)/)?.[1] ?? '', 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });
}

/**
 * Schedules all epics grouped by NWLD phase (v1, v2, v3, v4…) sequentially,
 * independently per team. Each team starts its next phase the business day
 * after it finishes its current phase — it does not wait for other teams.
 */
export function scheduleAllPhases(
  allEpics: EpicWithEstimate[],
  teams: TeamConfig[],
  startDate: Date,
  colorMap: Map<string, string>,
  schedulingMode: 'one-per-epic' | 'collaborate'
): ScheduleResult {
  // Sorted unique phase keys across all epics
  const sortedPhases = sortPhaseKeys(
    Array.from(new Set(allEpics.map((e) => e.nwld ?? '').filter(Boolean)))
  );

  const teamSchedules: TeamSchedule[] = [];

  for (const team of teams) {
    const color = colorMap.get(team.projectKey) || '#3B82F6';
    const weeklyCapacityDays = team.members.reduce((sum, m) => sum + m.hoursPerWeek / 8, 0);

    // Group this team's epics by phase
    const byPhase = new Map<string, EpicWithEstimate[]>();
    for (const epic of allEpics.filter((e) => e.projectKey === team.projectKey)) {
      const key = epic.nwld ?? '';
      if (!byPhase.has(key)) byPhase.set(key, []);
      byPhase.get(key)!.push(epic);
    }

    let phaseStart = startDate;
    const scheduledEpics: ScheduledEpic[] = [];

    for (const phase of sortedPhases) {
      const phaseEpics = byPhase.get(phase);
      if (!phaseEpics || phaseEpics.length === 0) continue;

      const phaseResult = scheduleEpics(
        new Map([[team.projectKey, phaseEpics]]),
        [team],
        phaseStart,
        colorMap,
        schedulingMode
      );

      const teamResult = phaseResult.teams[0];
      if (teamResult) {
        scheduledEpics.push(...teamResult.epics);
        // This team's next phase starts right after this one finishes
        if (teamResult.completionDate) {
          phaseStart = nextBusinessDay(teamResult.completionDate);
        }
      }
    }

    if (scheduledEpics.length === 0) continue;

    const activeEpics = scheduledEpics.filter((e) => e.statusCategory !== 'done');
    const completionDate = activeEpics.length > 0
      ? activeEpics.reduce((max, e) => (e.endDate > max ? e.endDate : max), activeEpics[0].endDate)
      : null;

    teamSchedules.push({
      projectKey: team.projectKey,
      projectName: team.projectName,
      color,
      weeklyCapacityDays,
      completionDate,
      epics: scheduledEpics,
    });
  }

  const completionDates = teamSchedules.map((t) => t.completionDate).filter((d): d is Date => d !== null);
  const overallCompletionDate = completionDates.length > 0
    ? completionDates.reduce((a, b) => (a > b ? a : b))
    : null;

  return {
    teams: teamSchedules,
    overallCompletionDate,
    totalEpics: teamSchedules.reduce((s, t) => s + t.epics.length, 0),
    totalRemainingDays: teamSchedules.reduce(
      (s, t) => s + t.epics.reduce((es: number, e: { remainingDays: number }) => es + e.remainingDays, 0),
      0
    ),
  };
}

/** Returns sorted unique NWLD values from a schedule result */
export function getPhases(result: ScheduleResult): string[] {
  const keys = new Set<string>();
  for (const team of result.teams) {
    for (const epic of team.epics) {
      keys.add(epic.nwld ?? '');
    }
  }
  return sortPhaseKeys(Array.from(keys)).filter(Boolean);
}
