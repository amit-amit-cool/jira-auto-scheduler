'use client';
import { useMemo, useState } from 'react';
import { format, differenceInWeeks } from 'date-fns';
import { useSchedule } from '@/hooks/useSchedule';
import { useAppStore } from '@/store/appStore';
import { getPhases } from '@/lib/scheduler/phases';
import { TeamCompletionCard } from './TeamCompletionCard';

function nwldOrder(nwld: string | null): number {
  if (!nwld) return 9999;
  const m = nwld.match(/v(\d+)/i);
  return m ? parseInt(m[1], 10) : 9998;
}

export function OverallSummary() {
  const { result: liveResult, isLoading, error } = useSchedule();
  const { savedSchedule, savedAt } = useAppStore();
  const [nwldFilter, setNwldFilter] = useState<string>('all');
  const today = new Date();

  const result = savedSchedule ?? liveResult;
  const phases = savedSchedule ? getPhases(savedSchedule) : [];

  const nwldValues = useMemo(() => {
    if (!result) return [];
    const vals = new Set<string>();
    result.teams.forEach(t => t.epics.forEach(e => { if (e.nwld) vals.add(e.nwld); }));
    return Array.from(vals).sort((a, b) => nwldOrder(a) - nwldOrder(b));
  }, [result]);

  const filteredTeams = useMemo(() => {
    if (!result) return [];
    if (nwldFilter === 'all') return result.teams;
    return result.teams
      .map(t => {
        const epics = t.epics.filter(e => e.nwld === nwldFilter);
        if (epics.length === 0) return null;
        const nonDone = epics.filter(e => e.statusCategory !== 'done');
        const completionDate = nonDone.length > 0
          ? new Date(Math.max(...nonDone.map(e => e.endDate.getTime())))
          : null;
        return { ...t, epics, completionDate };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }, [result, nwldFilter]);

  const filteredCompletionDate = useMemo(() => {
    if (!result) return null;
    if (nwldFilter !== 'all') {
      const dates = filteredTeams.flatMap(t => t.epics).map(e => e.endDate);
      return dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    }
    return result.overallCompletionDate;
  }, [filteredTeams, nwldFilter, result]);

  const phaseCompletions = useMemo(() => {
    if (!savedSchedule || phases.length === 0) return [];
    return phases.map(phase => {
      const epics = savedSchedule.teams.flatMap(t => t.epics.filter(e => e.nwld === phase));
      const completionDate = epics.length
        ? new Date(Math.max(...epics.map(e => e.endDate.getTime())))
        : null;
      return { phase, completionDate, epicCount: epics.length };
    });
  }, [savedSchedule, phases]);

  if (isLoading && !savedSchedule) return <div className="p-8 text-center text-gray-500">Calculating schedule…</div>;
  if (error && !savedSchedule) return <div className="p-8 text-center text-red-500">Error: {error.message}</div>;
  if (!result) return <div className="p-8 text-center text-gray-400">Configure settings to see the summary.</div>;

  const filteredTotalEpics = filteredTeams.reduce((s, t) => s + t.epics.length, 0);
  const filteredRemainingDays = filteredTeams.reduce((s, t) => s + t.epics.reduce((ss, e) => ss + e.remainingDays, 0), 0);

  const overallWeeks = filteredCompletionDate
    ? Math.ceil(differenceInWeeks(filteredCompletionDate, today))
    : null;

  return (
    <div className="space-y-6">
      {savedAt && (
        <div className="text-xs text-gray-400">
          Phase schedule saved {format(savedAt, 'MMM d, yyyy HH:mm')} — go to Timeline to recompute.
        </div>
      )}

      {/* NWLD filter */}
      {nwldValues.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">NWLD</span>
          <select
            value={nwldFilter}
            onChange={(e) => setNwldFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            {nwldValues.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}

      {/* Overall card */}
      <div className="bg-gray-900 text-white rounded-xl p-6 space-y-2">
        <div className="text-sm text-gray-400 uppercase tracking-wide">
          {nwldFilter === 'all' ? 'All teams complete by' : `${nwldFilter} complete by`}
        </div>
        {filteredCompletionDate ? (
          <>
            <div className="text-4xl font-bold">
              {format(filteredCompletionDate, 'MMMM d, yyyy')}
            </div>
            {overallWeeks !== null && (
              <div className="text-gray-300">
                ~{overallWeeks} week{overallWeeks !== 1 ? 's' : ''} from today
              </div>
            )}
          </>
        ) : (
          <div className="text-4xl font-bold text-gray-400">N/A</div>
        )}
        <div className="flex gap-6 mt-3 text-sm text-gray-300">
          <div><span className="font-semibold text-white">{filteredTotalEpics}</span> epics</div>
          <div><span className="font-semibold text-white">{filteredRemainingDays.toFixed(0)}</span> remaining days</div>
          <div><span className="font-semibold text-white">{filteredTeams.length}</span> teams</div>
        </div>
      </div>

      {/* Per-phase completion cards (only when saved schedule exists and showing all) */}
      {phaseCompletions.length > 0 && nwldFilter === 'all' && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">By Phase</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {phaseCompletions.map(({ phase, completionDate, epicCount }) => {
              const weeks = completionDate ? Math.ceil(differenceInWeeks(completionDate, today)) : null;
              return (
                <div key={phase} className="border rounded-lg p-4 space-y-1">
                  <div className="text-sm font-semibold text-purple-600">{phase}</div>
                  {completionDate ? (
                    <>
                      <div className="text-lg font-bold text-gray-900">{format(completionDate, 'MMM d, yyyy')}</div>
                      {weeks !== null && <div className="text-xs text-gray-500">~{weeks}w from today</div>}
                    </>
                  ) : (
                    <div className="text-lg font-bold text-gray-400">N/A</div>
                  )}
                  <div className="text-xs text-gray-400">{epicCount} epics</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-team cards */}
      <div>
        {phaseCompletions.length > 0 && (
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">By Team</h2>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <TeamCompletionCard key={team.projectKey} team={team} today={today} />
          ))}
        </div>
      </div>
    </div>
  );
}
