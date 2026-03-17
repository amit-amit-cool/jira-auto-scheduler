export interface TeamMember {
  accountId: string;
  displayName: string;
  hoursPerWeek: number;
}

export interface TeamConfig {
  projectKey: string;
  projectName: string;
  members: TeamMember[];
  color: string;
  atlassianTeamId?: string;
}

export interface AppSettings {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraToken: string;
  selectedProjectKeys: string[];
  teams: TeamConfig[];
  scheduleStartDate: string; // ISO date string
  schedulingMode: 'one-per-epic' | 'collaborate';
  fieldOverrides: {
    storyPointsFieldId?: string;
    timeSpentFieldId?: string;
  };
}

export const TEAM_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];
