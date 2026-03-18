'use client';
import { useSettings } from '@/hooks/useSettings';

const PRESETS = [0, 10, 20, 30, 50];

export function EstimationBuffer() {
  const { settings, updateSettings } = useSettings();
  const buffer = settings.estimationBuffer ?? 0;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Estimation Buffer</h2>
      <p className="text-sm text-gray-500">
        Adds a safety margin to all remaining estimates before scheduling.
        A 20% buffer turns a 10-day epic into 12 days.
      </p>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={buffer}
          onChange={(e) => updateSettings({ estimationBuffer: Number(e.target.value) })}
          className="flex-1 accent-blue-600"
        />
        <span className="w-12 text-right font-semibold text-blue-700 text-sm">{buffer}%</span>
      </div>
      <div className="flex gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => updateSettings({ estimationBuffer: p })}
            className={`px-3 py-1 rounded text-sm border transition-colors ${
              buffer === p
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {p === 0 ? 'None' : `+${p}%`}
          </button>
        ))}
      </div>
    </div>
  );
}
