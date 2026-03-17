import { AppSettingsSchema, AppSettingsOutput } from './schema';

const STORAGE_KEY = 'jira-auto-scheduler-settings';

export const defaultSettings: AppSettingsOutput = {
  jiraBaseUrl: '',
  jiraEmail: '',
  jiraToken: '',
  selectedProjectKeys: [],
  teams: [],
  scheduleStartDate: new Date().toISOString().split('T')[0],
  schedulingMode: 'collaborate',
  fieldOverrides: {},
};

export function loadSettings(): AppSettingsOutput {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    const result = AppSettingsSchema.safeParse(parsed);
    return result.success ? result.data : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: Partial<AppSettingsOutput>): AppSettingsOutput {
  const current = loadSettings();
  const merged = { ...current, ...settings };
  const result = AppSettingsSchema.safeParse(merged);
  const validated = result.success ? result.data : merged;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  }
  return validated as AppSettingsOutput;
}

export function clearSettings(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
