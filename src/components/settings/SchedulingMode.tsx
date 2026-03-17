'use client';
import { useSettings } from '@/hooks/useSettings';

const MODES = [
  {
    value: 'collaborate',
    label: 'Collaborate when idle',
    description:
      'If free members outnumber active epics, they pile onto the current epic to finish it faster. When epics are available, each member works independently.',
  },
  {
    value: 'one-per-epic',
    label: 'One member per epic',
    description:
      'Each member always works on their own epic. Idle members wait for the next epic in the queue. Maximum parallelism, no collaboration.',
  },
] as const;

export function SchedulingMode() {
  const { settings, updateSettings } = useSettings();
  const current = settings.schedulingMode ?? 'collaborate';

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Scheduling Mode</h2>
      <p className="text-sm text-gray-500">
        Controls how team members are assigned to epics.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODES.map((mode) => {
          const selected = current === mode.value;
          return (
            <button
              key={mode.value}
              onClick={() => updateSettings({ schedulingMode: mode.value })}
              className={`text-left p-4 rounded-lg border-2 transition-colors ${
                selected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                    selected ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
                  }`}
                />
                <span className="font-medium text-sm">{mode.label}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed pl-5">
                {mode.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
