'use client';
import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useFields } from '@/hooks/useFields';

export function AdvancedFields() {
  const { settings, updateSettings } = useSettings();
  const { fields, storyPointsFieldId, timeSpentFieldId } = useFields();
  const [open, setOpen] = useState(false);

  const customFields = fields.filter((f: { custom: boolean }) => f.custom);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <button
        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{open ? '▼' : '▶'}</span> Advanced: Field ID Overrides
      </button>

      {open && (
        <div className="space-y-3 pt-2">
          <p className="text-xs text-gray-500">
            Auto-discovered field IDs are shown below. Override only if incorrect.
          </p>

          <div>
            <label className="block text-sm font-medium mb-1">
              Story Points Field ID{' '}
              <span className="text-gray-400 font-normal">(auto: {storyPointsFieldId ?? 'not found'})</span>
            </label>
            <input
              type="text"
              value={settings.fieldOverrides.storyPointsFieldId ?? ''}
              onChange={(e) =>
                updateSettings({
                  fieldOverrides: {
                    ...settings.fieldOverrides,
                    storyPointsFieldId: e.target.value || undefined,
                  },
                })
              }
              placeholder={storyPointsFieldId ?? 'customfield_XXXXX'}
              className="w-full border rounded px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Time Spent Field ID{' '}
              <span className="text-gray-400 font-normal">(auto: {timeSpentFieldId ?? 'not found'})</span>
            </label>
            <input
              type="text"
              value={settings.fieldOverrides.timeSpentFieldId ?? ''}
              onChange={(e) =>
                updateSettings({
                  fieldOverrides: {
                    ...settings.fieldOverrides,
                    timeSpentFieldId: e.target.value || undefined,
                  },
                })
              }
              placeholder={timeSpentFieldId ?? 'customfield_XXXXX'}
              className="w-full border rounded px-3 py-2 text-sm font-mono"
            />
          </div>

          {customFields.length > 0 && (
            <details>
              <summary className="text-xs text-gray-400 cursor-pointer">
                All custom fields ({customFields.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {customFields.map((f: { id: string; name: string }) => (
                  <div key={f.id} className="flex gap-2 text-xs font-mono">
                    <span className="text-gray-400 w-36 flex-shrink-0">{f.id}</span>
                    <span>{f.name}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
