import { addBusinessDays, startOfWeek, nextMonday, isWeekend, addDays } from 'date-fns';
import { ScheduledEpic, ScheduleResult, TeamSchedule } from './types';
import { JiraEpic } from '@/types/jira';
import { TeamConfig } from '@/types/app';

export interface EpicWithEstimate {
  epic: JiraEpic;
  projectKey: string;
  storyPoints: number;
  timeSpentDays: number;
  remainingDays: number;
}

function getNextBusinessDay(date: Date): Date {
  let next = addDays(date, 1);
  while (isWeekend(next)) {
    next = addDays(next, 1);
  }
  return next;
}

function getNextMonday(date: Date): Date {
  // Move to next Monday
  return nextMonday(date);
}

function normalizeToBusinessDay(date: Date): Date {
  let d = new Date(date);
  while (isWeekend(d)) {
    d = addDays(d, 1);
  }
  return d;
}

export function scheduleEpics(
  epicsByProject: Map<string, EpicWithEstimate[]>,
  teams: TeamConfig[],
  startDate: Date,
  colorMap: Map<string, string>
): ScheduleResult {
  const teamSchedules: TeamSchedule[] = [];

  const normalizedStart = normalizeToBusinessDay(startDate);

  for (const team of teams) {
    const epicsForTeam = epicsByProject.get(team.projectKey) || [];
    const color = colorMap.get(team.projectKey) || '#3B82F6';

    // Calculate weekly capacity in days
    const weeklyCapacityDays = team.members.reduce(
      (sum, m) => sum + m.hoursPerWeek / 8,
      0
    );

    if (weeklyCapacityDays <= 0) {
      // No capacity — all epics start and end at start date with 0 duration
      const scheduledEpics: ScheduledEpic[] = epicsForTeam.map((e) => ({
        id: e.epic.id,
        key: e.epic.key,
        summary: e.epic.fields.summary,
        projectKey: team.projectKey,
        storyPoints: e.storyPoints,
        timeSpentDays: e.timeSpentDays,
        remainingDays: e.remainingDays,
        startDate: normalizedStart,
        endDate: normalizedStart,
        color,
      }));

      teamSchedules.push({
        projectKey: team.projectKey,
        projectName: team.projectName,
        color,
        weeklyCapacityDays: 0,
        completionDate: epicsForTeam.length > 0 ? normalizedStart : null,
        epics: scheduledEpics,
      });
      continue;
    }

    const scheduledEpics: ScheduledEpic[] = [];
    // Track position within the current week
    let currentWeekStart = startOfWeek(normalizedStart, { weekStartsOn: 1 }); // Monday
    // remainingCapacityThisWeek: how many days left in the current week
    // We need to figure out how many business days remain in the first week
    let remainingCapacityThisWeek = computeRemainingWeekCapacity(
      normalizedStart,
      weeklyCapacityDays
    );
    let currentDate = normalizedStart;

    for (const item of epicsForTeam) {
      if (item.remainingDays === 0) {
        // Zero-work epics: mark as starting and ending today
        scheduledEpics.push({
          id: item.epic.id,
          key: item.epic.key,
          summary: item.epic.fields.summary,
          projectKey: team.projectKey,
          storyPoints: item.storyPoints,
          timeSpentDays: item.timeSpentDays,
          remainingDays: 0,
          startDate: currentDate,
          endDate: currentDate,
          color,
        });
        continue;
      }

      const epicStart = currentDate;
      let daysLeft = item.remainingDays;

      while (daysLeft > 0) {
        const consumed = Math.min(daysLeft, remainingCapacityThisWeek);
        daysLeft -= consumed;
        remainingCapacityThisWeek -= consumed;

        if (remainingCapacityThisWeek <= 0 && daysLeft > 0) {
          // Advance to next Monday, reset capacity
          currentWeekStart = getNextMonday(currentWeekStart);
          remainingCapacityThisWeek = weeklyCapacityDays;
          currentDate = currentWeekStart;
        }
      }

      // epicEnd: current position in the week (after consuming days)
      // The epic ends on the last business day used
      const daysUsedInCurrentWeek = weeklyCapacityDays - remainingCapacityThisWeek;
      const epicEnd = addBusinessDays(currentWeekStart, daysUsedInCurrentWeek - 1);

      scheduledEpics.push({
        id: item.epic.id,
        key: item.epic.key,
        summary: item.epic.fields.summary,
        projectKey: team.projectKey,
        storyPoints: item.storyPoints,
        timeSpentDays: item.timeSpentDays,
        remainingDays: item.remainingDays,
        startDate: epicStart,
        endDate: epicEnd,
        color,
      });

      // Next epic starts the next business day after this epic ends
      currentDate = getNextBusinessDay(epicEnd);

      // If we've crossed into a new week, update week tracking
      const nextWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      if (nextWeekStart > currentWeekStart) {
        currentWeekStart = nextWeekStart;
        // Recalculate remaining capacity for the new partial week
        remainingCapacityThisWeek = computeRemainingWeekCapacity(
          currentDate,
          weeklyCapacityDays
        );
      }
    }

    const completionDate =
      scheduledEpics.length > 0
        ? scheduledEpics[scheduledEpics.length - 1].endDate
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

  // Overall completion = latest team completion
  const completionDates = teamSchedules
    .map((t) => t.completionDate)
    .filter((d): d is Date => d !== null);
  const overallCompletionDate =
    completionDates.length > 0
      ? completionDates.reduce((a, b) => (a > b ? a : b))
      : null;

  const totalEpics = teamSchedules.reduce((s, t) => s + t.epics.length, 0);
  const totalRemainingDays = teamSchedules.reduce(
    (s, t) => s + t.epics.reduce((es, e) => es + e.remainingDays, 0),
    0
  );

  return { teams: teamSchedules, overallCompletionDate, totalEpics, totalRemainingDays };
}

/**
 * Computes how many capacity-days remain in the current week starting from `date`.
 * Scales weeklyCapacityDays proportionally to remaining business days in the week.
 */
function computeRemainingWeekCapacity(date: Date, weeklyCapacityDays: number): number {
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  // Business days remaining including today: Mon=5, Tue=4, Wed=3, Thu=2, Fri=1
  const businessDayMap: Record<number, number> = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
  const remaining = businessDayMap[dayOfWeek] ?? 5;
  return (remaining / 5) * weeklyCapacityDays;
}
