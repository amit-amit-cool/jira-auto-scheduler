import { z } from 'zod';

export const TeamMemberSchema = z.object({
  accountId: z.string(),
  displayName: z.string(),
  hoursPerWeek: z.number().min(0).max(80).default(40),
});

export const TeamConfigSchema = z.object({
  projectKey: z.string(),
  projectName: z.string(),
  members: z.array(TeamMemberSchema).default([]),
  color: z.string().default('#3B82F6'),
});

export const AppSettingsSchema = z.object({
  jiraBaseUrl: z.string().url().optional().or(z.literal('')),
  jiraEmail: z.string().email().optional().or(z.literal('')),
  jiraToken: z.string().optional().or(z.literal('')),
  selectedProjectKeys: z.array(z.string()).default([]),
  teams: z.array(TeamConfigSchema).default([]),
  scheduleStartDate: z.string().default(new Date().toISOString().split('T')[0]),
  fieldOverrides: z.object({
    storyPointsFieldId: z.string().optional(),
    timeSpentFieldId: z.string().optional(),
  }).default({}),
});

export type AppSettingsInput = z.input<typeof AppSettingsSchema>;
export type AppSettingsOutput = z.output<typeof AppSettingsSchema>;
