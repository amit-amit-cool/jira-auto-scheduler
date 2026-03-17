'use client';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useSchedule } from '@/hooks/useSchedule';
import { useEpics } from '@/hooks/useEpics';
import { ScheduledEpic } from '@/lib/scheduler/types';

export function EpicTable() {
  const { result, isLoading, error } = useSchedule();
  const { total } = useEpics();
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const allEpics = useMemo(() => {
    if (!result) return [];
    return result.teams.flatMap((t) => t.epics);
  }, [result]);

  const filtered = useMemo(() => {
    return allEpics.filter((e) => {
      if (teamFilter !== 'all' && e.projectKey !== teamFilter) return false;
      if (search && !e.summary.toLowerCase().includes(search.toLowerCase()) && !e.key.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allEpics, teamFilter, search]);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading epics…</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error.message}</div>;
  if (!result) return <div className="p-8 text-center text-gray-400">Configure settings and select projects to see epics.</div>;

  const teams = result.teams;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTeamFilter('all')}
            className={`px-3 py-1 rounded-full text-sm ${teamFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All ({allEpics.length})
          </button>
          {teams.map((t) => (
            <button
              key={t.projectKey}
              onClick={() => setTeamFilter(t.projectKey)}
              className={`px-3 py-1 rounded-full text-sm ${teamFilter === t.projectKey ? 'text-white' : 'text-gray-600 hover:opacity-80'}`}
              style={teamFilter === t.projectKey ? { backgroundColor: t.color } : { backgroundColor: t.color + '33' }}
            >
              {t.projectKey} ({t.epics.length})
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Search epics…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto border rounded px-3 py-1 text-sm"
        />
      </div>

      <div className="text-sm text-gray-500">{filtered.length} epics shown</div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Key</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Summary</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Team</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">SP</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Spent</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Remaining</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Start</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">End</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((epic: ScheduledEpic) => (
              <tr key={epic.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-blue-600">{epic.key}</td>
                <td className="px-4 py-2 max-w-xs truncate">{epic.summary}</td>
                <td className="px-4 py-2">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-white text-xs"
                    style={{ backgroundColor: epic.color }}
                  >
                    {epic.projectKey}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{epic.storyPoints}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-500">{epic.timeSpentDays}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">{epic.remainingDays}</td>
                <td className="px-4 py-2 text-gray-600">{format(epic.startDate, 'MMM d, yyyy')}</td>
                <td className="px-4 py-2 text-gray-600">{format(epic.endDate, 'MMM d, yyyy')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
