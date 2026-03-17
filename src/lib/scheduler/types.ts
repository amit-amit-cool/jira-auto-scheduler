export type StatusCategory = 'done' | 'inprogress' | 'todo';

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
  status: string;
  statusCategory: StatusCategory;
  nwld: string | null;
  assignedTo: string | null; // display name of the member scheduled to do this work
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
