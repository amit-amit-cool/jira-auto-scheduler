import { AppSettingsOutput } from '@/lib/storage/schema';

export function buildClientHeaders(settings: AppSettingsOutput): Record<string, string> {
  return {
    'X-Jira-Url': settings.jiraBaseUrl ?? '',
    'X-Jira-Email': settings.jiraEmail ?? '',
    'X-Jira-Token': settings.jiraToken ?? '',
  };
}
