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

function nwldPriority(nwld: string | null): number {
  if (!nwld) return 9999;
  const m = nwld.match(/v(\d+)/i);
  return m ? parseInt(m[1]) : 9998;
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
    // Priority order:
    //   1. In-progress first (already started → finish soonest)
    //   2. Then by NWLD wave (V1 → V2 → V3 → V4 → other → unlabelled)
    //      so the team completes each wave before moving to the next
    //   3. Within the same wave, preserve original Jira rank
    const activeEpics = epicsForTeam
      .filter((e) => e.statusCategory !== 'done' && e.remainingDays > 0)
      .sort((a, b) => {
        const statusRank = (s: StatusCategory) => s === 'inprogress' ? 0 : 1;
        const sd = statusRank(a.statusCategory) - statusRank(b.statusCategory);
        if (sd !== 0) return sd;
        return nwldPriority(a.nwld) - nwldPriority(b.nwld);
      });

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
      // Wave-gated greedy: each member works solo on one epic.
      // A member who becomes free will not start a higher-wave epic while a
      // lower-wave epic is still running — they wait until the wave clears.
      const remaining = [...activeEpics];
      // Track assigned-but-not-yet-done epics so we know which wave is active
      const inFlight: { wave: number; epicEnd: Date }[] = [];

      while (remaining.length > 0 || inFlight.length > 0) {
        let fastestIdx = 0;
        for (let i = 1; i < memberAvailability.length; i++) {
          if (memberAvailability[i] < memberAvailability[fastestIdx]) fastestIdx = i;
        }
        const freeAt = normalizeToBusinessDay(memberAvailability[fastestIdx]);

        // Remove completed in-flight entries
        for (let i = inFlight.length - 1; i >= 0; i--) {
          if (inFlight[i].epicEnd < freeAt) inFlight.splice(i, 1);
        }

        // Lowest wave still active (unassigned or running)
        const allWaves = [
          ...remaining.map(e => nwldPriority(e.nwld)),
          ...inFlight.map(e => e.wave),
        ];
        const minWave = allWaves.length > 0 ? Math.min(...allWaves) : Infinity;

        // Find next epic: Jira in-progress first, then lowest-wave todo
        let nextIdx = remaining.findIndex(e => e.statusCategory === 'inprogress');
        if (nextIdx < 0) {
          nextIdx = remaining.findIndex(
            e => e.statusCategory !== 'inprogress' && nwldPriority(e.nwld) === minWave
          );
        }

        if (nextIdx >= 0) {
          const item = remaining.splice(nextIdx, 1)[0];
          const member = team.members[fastestIdx];
          const ratio = member.hoursPerWeek / 40;
          const duration = ratio > 0 ? Math.ceil(item.remainingDays / ratio) : 0;
          const epicEnd = duration > 0 ? addBusinessDays(freeAt, duration - 1) : freeAt;
          scheduledEpics.push({
            id: item.epic.id, key: item.epic.key, summary: item.epic.fields.summary,
            projectKey: team.projectKey, storyPoints: item.storyPoints,
            timeSpentDays: item.timeSpentDays, remainingDays: item.remainingDays,
            startDate: freeAt, endDate: epicEnd, color,
            status: item.status, statusCategory: item.statusCategory, nwld: item.nwld,
            assignedTo: member.displayName,
          });
          inFlight.push({ wave: nwldPriority(item.nwld), epicEnd });
          memberAvailability[fastestIdx] = getNextBusinessDay(epicEnd);
        } else {
          // Current wave is all assigned but still running — wait for it to finish
          const waveEnd = inFlight
            .filter(e => e.wave === minWave)
            .reduce((max, e) => e.epicEnd > max ? e.epicEnd : max, new Date(0));
          memberAvailability[fastestIdx] = getNextBusinessDay(waveEnd);
        }
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

      // Returns the next epic to assign, respecting wave-gating:
      //   - Jira in-progress epics are always assigned immediately (can't block work already started)
      //   - Todo epics: only pick from the lowest wave that still has active work
      //     (unstarted OR in-progress), so V1 is fully done before any member starts V2.
      const nextToAssign = (): { item: EpicWithEstimate; idx: number } | null => {
        // 1. Jira in-progress epics — no wave gate
        const ipIdx = unstarted.findIndex(e => e.statusCategory === 'inprogress');
        if (ipIdx >= 0) return { item: unstarted[ipIdx], idx: ipIdx };

        // 2. Lowest active wave across unstarted todos + in-progress scheduled epics
        const waves = [
          ...unstarted.map(e => nwldPriority(e.nwld)),
          ...inProgress.map(e => nwldPriority(e.item.nwld)),
        ];
        if (waves.length === 0) return null;
        const minWave = Math.min(...waves);

        const idx = unstarted.findIndex(
          e => e.statusCategory !== 'inprogress' && nwldPriority(e.nwld) === minWave
        );
        return idx >= 0 ? { item: unstarted[idx], idx } : null;
      }

      // Returns the in-progress epic a free member should join when the queue is
      // blocked (current wave has no unstarted epics left, only running ones).
      const targetToJoin = (): ActiveEpicState | null => {
        // Join within the lowest active wave only
        const waves = inProgress.map(e => nwldPriority(e.item.nwld));
        if (waves.length === 0) return null;
        const minWave = Math.min(...waves);
        const candidates = inProgress.filter(e => nwldPriority(e.item.nwld) === minWave);
        return candidates.reduce((latest, e) => e.epicEnd > latest.epicEnd ? e : latest);
      }

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

        const next = nextToAssign();
        if (next) {
          // Assign this epic to the free member (solo start)
          unstarted.splice(next.idx, 1);
          const item = next.item;
          const ratio = team.members[fastestIdx].hoursPerWeek / 40;
          const duration = ratio > 0 ? Math.ceil(item.remainingDays / ratio) : 0;
          const epicEnd = duration > 0 ? addBusinessDays(freeAt, duration - 1) : freeAt;
          inProgress.push({
            item, epicStart: freeAt, phaseStart: freeAt, workDone: 0,
            currentRatio: ratio, memberIndices: [fastestIdx], epicEnd,
          });
          memberAvailability[fastestIdx] = getNextBusinessDay(epicEnd);

        } else if (inProgress.length > 0) {
          // Current wave has no unstarted left — join the latest-finishing epic in this wave
          const target = targetToJoin()!;

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
