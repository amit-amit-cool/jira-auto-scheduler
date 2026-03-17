import { addBusinessDays, differenceInBusinessDays, isWeekend, addDays } from 'date-fns';
import { ScheduledEpic, ScheduleResult, TeamSchedule, StatusCategory } from './types';
import { JiraEpic } from '@/types/jira';
import { TeamConfig } from '@/types/app';

export interface EpicWithEstimate {
  epic: JiraEpic;
  projectKey: string;
  storyPoints: number;
  timeSpentDays: number;
  remainingDays: number;
  status: string;
  statusCategory: StatusCategory;
  nwld: string | null;
}

function normalizeToBusinessDay(date: Date): Date {
  let d = new Date(date);
  while (isWeekend(d)) {
    d = addDays(d, 1);
  }
  return d;
}

function getNextBusinessDay(date: Date): Date {
  let next = addDays(date, 1);
  while (isWeekend(next)) {
    next = addDays(next, 1);
  }
  return next;
}

/**
 * Schedules epics in parallel across team members.
 * Each member works on one epic at a time. The next epic is assigned
 * to whichever member becomes free soonest (greedy earliest-available).
 *
 * Epic duration for a member = remainingDays / (hoursPerWeek / 40)
 * e.g. a 10-day epic takes 10 days for a full-time (40h) member,
 *      but 20 days for a half-time (20h) member.
 */
export function scheduleEpics(
  epicsByProject: Map<string, EpicWithEstimate[]>,
  teams: TeamConfig[],
  startDate: Date,
  colorMap: Map<string, string>,
  schedulingMode: 'one-per-epic' | 'collaborate' = 'collaborate'
): ScheduleResult {
  const teamSchedules: TeamSchedule[] = [];
  const normalizedStart = normalizeToBusinessDay(startDate);

  for (const team of teams) {
    const epicsForTeam = epicsByProject.get(team.projectKey) || [];
    const color = colorMap.get(team.projectKey) || '#3B82F6';

    const weeklyCapacityDays = team.members.reduce(
      (sum, m) => sum + m.hoursPerWeek / 8,
      0
    );

    // Separate done/zero-work epics from ones needing scheduling
    const doneEpics = epicsForTeam.filter(
      (e) => e.statusCategory === 'done' || e.remainingDays === 0
    );
    const activeEpics = epicsForTeam.filter(
      (e) => e.statusCategory !== 'done' && e.remainingDays > 0
    );

    const scheduledEpics: ScheduledEpic[] = [];

    // Done epics get pinned to startDate with no duration
    for (const item of doneEpics) {
      scheduledEpics.push({
        id: item.epic.id,
        key: item.epic.key,
        summary: item.epic.fields.summary,
        projectKey: team.projectKey,
        storyPoints: item.storyPoints,
        timeSpentDays: item.timeSpentDays,
        remainingDays: 0,
        startDate: normalizedStart,
        endDate: normalizedStart,
        color,
        status: item.status,
        statusCategory: item.statusCategory,
        nwld: item.nwld,
        assignedTo: null,
      });
    }

    if (team.members.length === 0 || weeklyCapacityDays <= 0) {
      // No capacity — pin active epics to startDate too
      for (const item of activeEpics) {
        scheduledEpics.push({
          id: item.epic.id,
          key: item.epic.key,
          summary: item.epic.fields.summary,
          projectKey: team.projectKey,
          storyPoints: item.storyPoints,
          timeSpentDays: item.timeSpentDays,
          remainingDays: item.remainingDays,
          startDate: normalizedStart,
          endDate: normalizedStart,
          color,
          status: item.status,
          statusCategory: item.statusCategory,
          nwld: item.nwld,
          assignedTo: null,
        });
      }

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

    // Each member gets an "availableFrom" date — starts at normalizedStart
    const memberAvailability: Date[] = team.members.map(() => new Date(normalizedStart));

    if (schedulingMode === 'one-per-epic') {
      // Greedy: assign each epic to whichever member is free soonest
      for (const item of activeEpics) {
        let fastestIdx = 0;
        for (let i = 1; i < memberAvailability.length; i++) {
          if (memberAvailability[i] < memberAvailability[fastestIdx]) fastestIdx = i;
        }

        const member = team.members[fastestIdx];
        const epicStart = normalizeToBusinessDay(memberAvailability[fastestIdx]);
        const fullTimeRatio = member.hoursPerWeek / 40;
        const durationBusinessDays = fullTimeRatio > 0
          ? Math.ceil(item.remainingDays / fullTimeRatio)
          : 0;
        const epicEnd = durationBusinessDays > 0
          ? addBusinessDays(epicStart, durationBusinessDays - 1)
          : epicStart;

        scheduledEpics.push({
          id: item.epic.id, key: item.epic.key, summary: item.epic.fields.summary,
          projectKey: team.projectKey, storyPoints: item.storyPoints,
          timeSpentDays: item.timeSpentDays, remainingDays: item.remainingDays,
          startDate: epicStart, endDate: epicEnd, color,
          status: item.status, statusCategory: item.statusCategory, nwld: item.nwld,
          assignedTo: member.displayName,
        });

        memberAvailability[fastestIdx] = getNextBusinessDay(epicEnd);
      }
    } else {
      // Collaborate-when-idle mode:
      // Each member works solo on one epic at a time (greedy earliest-available).
      // When the unstarted queue is empty and a member becomes free, they join
      // the latest-finishing in-progress epic to help it complete faster.
      //
      // Active epic state tracks phases: each time a new member joins, we record
      // how much work has been done and restart the clock with the new combined ratio.

      interface ActiveEpicState {
        item: EpicWithEstimate;
        epicStart: Date;       // original start (for output)
        phaseStart: Date;      // start of current capacity phase
        workDone: number;      // days of work completed before current phase
        currentRatio: number;  // combined ratio of all current workers
        memberIndices: number[];
        epicEnd: Date;         // estimated end under current capacity
      }

      const unstarted = [...activeEpics];
      const inProgress: ActiveEpicState[] = [];

      while (unstarted.length > 0 || inProgress.length > 0) {
        // Find which member becomes free soonest
        let fastestIdx = 0;
        for (let i = 1; i < memberAvailability.length; i++) {
          if (memberAvailability[i] < memberAvailability[fastestIdx]) fastestIdx = i;
        }
        const freeAt = normalizeToBusinessDay(memberAvailability[fastestIdx]);

        // Finalize any in-progress epics whose end has passed freeAt
        for (let i = inProgress.length - 1; i >= 0; i--) {
          const e = inProgress[i];
          if (e.epicEnd < freeAt) {
            inProgress.splice(i, 1);
            const names = e.memberIndices.map(idx => team.members[idx].displayName).join(', ');
            scheduledEpics.push({
              id: e.item.epic.id, key: e.item.epic.key, summary: e.item.epic.fields.summary,
              projectKey: team.projectKey, storyPoints: e.item.storyPoints,
              timeSpentDays: e.item.timeSpentDays, remainingDays: e.item.remainingDays,
              startDate: e.epicStart, endDate: e.epicEnd, color,
              status: e.item.status, statusCategory: e.item.statusCategory, nwld: e.item.nwld,
              assignedTo: names || null,
            });
          }
        }

        if (unstarted.length > 0) {
          // Assign next unstarted epic to this member (solo)
          const item = unstarted.shift()!;
          const ratio = team.members[fastestIdx].hoursPerWeek / 40;
          const duration = ratio > 0 ? Math.ceil(item.remainingDays / ratio) : 0;
          const epicEnd = duration > 0 ? addBusinessDays(freeAt, duration - 1) : freeAt;
          inProgress.push({
            item, epicStart: freeAt, phaseStart: freeAt, workDone: 0,
            currentRatio: ratio, memberIndices: [fastestIdx], epicEnd,
          });
          memberAvailability[fastestIdx] = getNextBusinessDay(epicEnd);

        } else if (inProgress.length > 0) {
          // Queue empty — join the latest-finishing in-progress epic
          const target = inProgress.reduce((latest, e) =>
            e.epicEnd > latest.epicEnd ? e : latest
          );

          // How much work has been done in the current phase up to now?
          const elapsed = Math.max(0, differenceInBusinessDays(freeAt, target.phaseStart));
          const newWorkDone = target.workDone + elapsed * target.currentRatio;
          const remaining = Math.max(0, target.item.remainingDays - newWorkDone);

          if (remaining <= 0) {
            // Epic is already done — finalise it
            const idx = inProgress.indexOf(target);
            inProgress.splice(idx, 1);
            const names = target.memberIndices.map(i => team.members[i].displayName).join(', ');
            scheduledEpics.push({
              id: target.item.epic.id, key: target.item.epic.key, summary: target.item.epic.fields.summary,
              projectKey: team.projectKey, storyPoints: target.item.storyPoints,
              timeSpentDays: target.item.timeSpentDays, remainingDays: target.item.remainingDays,
              startDate: target.epicStart, endDate: target.epicEnd, color,
              status: target.item.status, statusCategory: target.item.statusCategory, nwld: target.item.nwld,
              assignedTo: names || null,
            });
            memberAvailability[fastestIdx] = freeAt; // retry next iteration
          } else {
            const newRatio = target.currentRatio + team.members[fastestIdx].hoursPerWeek / 40;
            const newDuration = Math.ceil(remaining / newRatio);
            const newEnd = addBusinessDays(freeAt, newDuration - 1);
            const newNextFree = getNextBusinessDay(newEnd);

            // Update target epic — new phase starts now with higher capacity
            target.phaseStart = freeAt;
            target.workDone = newWorkDone;
            target.currentRatio = newRatio;
            target.memberIndices.push(fastestIdx);
            target.epicEnd = newEnd;

            // All members on this epic (including the new one) are now free after newEnd
            for (const idx of target.memberIndices) {
              memberAvailability[idx] = newNextFree;
            }
          }
        } else {
          // Nothing left to do (shouldn't normally reach here)
          break;
        }
      }

      // Any epics still in inProgress at loop exit — finalize them
      for (const e of inProgress) {
        const names = e.memberIndices.map(idx => team.members[idx].displayName).join(', ');
        scheduledEpics.push({
          id: e.item.epic.id, key: e.item.epic.key, summary: e.item.epic.fields.summary,
          projectKey: team.projectKey, storyPoints: e.item.storyPoints,
          timeSpentDays: e.item.timeSpentDays, remainingDays: e.item.remainingDays,
          startDate: e.epicStart, endDate: e.epicEnd, color,
          status: e.item.status, statusCategory: e.item.statusCategory, nwld: e.item.nwld,
          assignedTo: names || null,
        });
      }
    }

    const nonDoneEpics = scheduledEpics.filter((e) => e.statusCategory !== 'done');
    const completionDate =
      nonDoneEpics.length > 0
        ? nonDoneEpics.reduce(
            (max, e) => (e.endDate > max ? e.endDate : max),
            nonDoneEpics[0].endDate
          )
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
