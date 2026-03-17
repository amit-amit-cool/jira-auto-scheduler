'use client';
import { useSettings } from '@/hooks/useSettings';

export function ScheduleStartDate() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Schedule Start Date</h2>
      <p className="text-sm text-gray-500">
        Scheduling begins from this date. Weekends are skipped automatically.
      </p>
      <input
        type="date"
        value={settings.scheduleStartDate}
        onChange={(e) => updateSettings({ scheduleStartDate: e.target.value })}
        className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
