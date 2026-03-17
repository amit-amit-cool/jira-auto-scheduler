export interface ScheduledEpic {
  id: string;
  key: string;
  summary: string;
  projectKey: string;
  storyPoints: number;
  timeSpentDays: number;
  remainingDays: number;
  startDate: Date;
  endDate: Date;
  color: string;
}

export interface TeamSchedule {
  projectKey: string;
  projectName: string;
  color: string;
  weeklyCapacityDays: number;
  completionDate: Date | null;
  epics: ScheduledEpic[];
}

export interface ScheduleResult {
  teams: TeamSchedule[];
  overallCompletionDate: Date | null;
  totalEpics: number;
  totalRemainingDays: number;
}
