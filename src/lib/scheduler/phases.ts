import { addDays, isWeekend } from 'date-fns';
import { ScheduleResult, TeamSchedule } from './types';
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
    // Extract trailing number for natural sort: v1 < v2 < v10
    const numA = parseInt(a.replace(/\D/g, ''), 10);
    const numB = parseInt(b.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });
}

/**
 * Schedules all epics grouped by NWLD phase (v1, v2, v3, v4…) sequentially.
 * v1 is scheduled first; v2 starts the business day after v1 completes; etc.
 * Returns a merged ScheduleResult covering all phases, with each epic tagged
 * with its original nwld value so the UI can filter by phase.
 */
export function scheduleAllPhases(
  allEpics: EpicWithEstimate[],
  teams: TeamConfig[],
  startDate: Date,
  colorMap: Map<string, string>,
  schedulingMode: 'one-per-epic' | 'collaborate'
): ScheduleResult {
  // Group by nwld
  const phaseMap = new Map<string, EpicWithEstimate[]>();
  for (const epic of allEpics) {
    const key = epic.nwld ?? '';
    if (!phaseMap.has(key)) phaseMap.set(key, []);
    phaseMap.get(key)!.push(epic);
  }

  const sortedKeys = sortPhaseKeys(Array.from(phaseMap.keys()));

  // Merge structure: one TeamSchedule per team, accumulating epics across phases
  const teamMap = new Map<string, TeamSchedule>();

  let phaseStart = startDate;

  for (const phaseKey of sortedKeys) {
    const phaseEpics = phaseMap.get(phaseKey)!;

    // Build epicsByProject for this phase
    const epicsByProject = new Map<string, EpicWithEstimate[]>();
    for (const epic of phaseEpics) {
      if (!epicsByProject.has(epic.projectKey)) epicsByProject.set(epic.projectKey, []);
      epicsByProject.get(epic.projectKey)!.push(epic);
    }

    const phaseResult = scheduleEpics(epicsByProject, teams, phaseStart, colorMap, schedulingMode);

    // Merge into teamMap
    for (const team of phaseResult.teams) {
      if (!teamMap.has(team.projectKey)) {
        teamMap.set(team.projectKey, { ...team, epics: [] });
      }
      const existing = teamMap.get(team.projectKey)!;
      existing.epics.push(...team.epics);
      // Keep latest completion date
      if (team.completionDate) {
        if (!existing.completionDate || team.completionDate > existing.completionDate) {
          existing.completionDate = team.completionDate;
        }
      }
    }

    // Next phase starts the day after this phase's overall completion
    if (phaseResult.overallCompletionDate) {
      phaseStart = nextBusinessDay(phaseResult.overallCompletionDate);
    }
  }

  const teams_result = Array.from(teamMap.values());
  const completionDates = teams_result
    .map((t) => t.completionDate)
    .filter((d): d is Date => d !== null);
  const overallCompletionDate = completionDates.length > 0
    ? completionDates.reduce((a, b) => (a > b ? a : b))
    : null;

  return {
    teams: teams_result,
    overallCompletionDate,
    totalEpics: teams_result.reduce((s, t) => s + t.epics.length, 0),
    totalRemainingDays: teams_result.reduce(
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
