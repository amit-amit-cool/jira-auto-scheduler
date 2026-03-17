import { ScheduleResult, TeamSchedule, ScheduledEpic } from '../scheduler/types';

const STORAGE_KEY = 'jira-auto-scheduler-saved-schedule';

// Serialized versions replace Date with string
type SerializedEpic = Omit<ScheduledEpic, 'startDate' | 'endDate'> & {
  startDate: string;
  endDate: string;
};
type SerializedTeam = Omit<TeamSchedule, 'completionDate' | 'epics'> & {
  completionDate: string | null;
  epics: SerializedEpic[];
};
export type SerializedScheduleResult = Omit<ScheduleResult, 'teams' | 'overallCompletionDate'> & {
  teams: SerializedTeam[];
  overallCompletionDate: string | null;
  savedAt: string;
};

function serializeResult(result: ScheduleResult): SerializedScheduleResult {
  return {
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
}

export function deserializeResult(s: SerializedScheduleResult): ScheduleResult {
  return {
    ...s,
    overallCompletionDate: s.overallCompletionDate ? new Date(s.overallCompletionDate) : null,
    teams: s.teams.map((t) => ({
      ...t,
      completionDate: t.completionDate ? new Date(t.completionDate) : null,
      epics: t.epics.map((e) => ({
        ...e,
        startDate: new Date(e.startDate),
        endDate: new Date(e.endDate),
      })),
    })),
  };
}

export function loadSavedSchedule(): { result: ScheduleResult; savedAt: Date } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: SerializedScheduleResult = JSON.parse(raw);
    return { result: deserializeResult(parsed), savedAt: new Date(parsed.savedAt) };
  } catch {
    return null;
  }
}

export function persistSchedule(result: ScheduleResult): Date {
  const serialized = serializeResult(result);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  }
  return new Date(serialized.savedAt);
}

export function clearSavedSchedule(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
