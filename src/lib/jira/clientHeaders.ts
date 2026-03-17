import { AppSettingsOutput } from '@/lib/storage/schema';

const JIRA_BASE_URL = process.env.NEXT_PUBLIC_JIRA_BASE_URL ?? '';
const JIRA_EMAIL = process.env.NEXT_PUBLIC_JIRA_EMAIL ?? '';

export function buildClientHeaders(settings: AppSettingsOutput): Record<string, string> {
  return {
    'X-Jira-Url': JIRA_BASE_URL,
    'X-Jira-Email': JIRA_EMAIL,
    'X-Jira-Token': settings.jiraToken ?? '',
  };
}
