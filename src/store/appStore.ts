import { create } from 'zustand';
import { AppSettingsOutput } from '@/lib/storage/schema';
import { loadSettings, saveSettings } from '@/lib/storage/settings';
import { ScheduleResult } from '@/lib/scheduler/types';
import {
  loadSavedSchedule,
  persistSchedule,
  clearSavedSchedule,
} from '@/lib/storage/savedSchedule';

interface AppState {
  settings: AppSettingsOutput;
  isLoaded: boolean;
  loadFromStorage: () => void;
  updateSettings: (updates: Partial<AppSettingsOutput>) => void;

  savedSchedule: ScheduleResult | null;
  savedAt: Date | null;
  saveSchedule: (result: ScheduleResult) => void;
  clearSchedule: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: {
    jiraBaseUrl: '',
    jiraEmail: '',
    jiraToken: '',
    selectedProjectKeys: [],
    teams: [],
    scheduleStartDate: new Date().toISOString().split('T')[0],
    schedulingMode: 'collaborate' as const,
    fieldOverrides: {},
  },
  isLoaded: false,

  loadFromStorage: () => {
    const settings = loadSettings();
    const saved = loadSavedSchedule();
    set({
      settings,
      isLoaded: true,
      savedSchedule: saved?.result ?? null,
      savedAt: saved?.savedAt ?? null,
    });
  },

  updateSettings: (updates) => {
    const current = get().settings;
    const next = saveSettings({ ...current, ...updates });
    set({ settings: next });
  },

  savedSchedule: null,
  savedAt: null,

  saveSchedule: (result) => {
    const savedAt = persistSchedule(result);
    set({ savedSchedule: result, savedAt });
  },

  clearSchedule: () => {
    clearSavedSchedule();
    set({ savedSchedule: null, savedAt: null });
  },
}));
