import { create } from 'zustand';
import { AppSettingsOutput } from '@/lib/storage/schema';
import { loadSettings, saveSettings } from '@/lib/storage/settings';

interface AppState {
  settings: AppSettingsOutput;
  isLoaded: boolean;
  loadFromStorage: () => void;
  updateSettings: (updates: Partial<AppSettingsOutput>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: {
    jiraBaseUrl: '',
    jiraEmail: '',
    jiraToken: '',
    selectedProjectKeys: [],
    teams: [],
    scheduleStartDate: new Date().toISOString().split('T')[0],
    fieldOverrides: {},
  },
  isLoaded: false,

  loadFromStorage: () => {
    const settings = loadSettings();
    set({ settings, isLoaded: true });
  },

  updateSettings: (updates) => {
    const current = get().settings;
    const next = saveSettings({ ...current, ...updates });
    set({ settings: next });
  },
}));
