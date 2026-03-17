'use client';
import { format, differenceInWeeks } from 'date-fns';
import { useSchedule } from '@/hooks/useSchedule';
import { TeamCompletionCard } from './TeamCompletionCard';

export function OverallSummary() {
  const { result, isLoading, error } = useSchedule();
  const today = new Date();

  if (isLoading) return <div className="p-8 text-center text-gray-500">Calculating schedule…</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error.message}</div>;
  if (!result) return <div className="p-8 text-center text-gray-400">Configure settings to see the summary.</div>;

  const overallWeeks = result.overallCompletionDate
    ? Math.ceil(differenceInWeeks(result.overallCompletionDate, today))
    : null;

  return (
    <div className="space-y-6">
      {/* Overall card */}
      <div className="bg-gray-900 text-white rounded-xl p-6 space-y-2">
        <div className="text-sm text-gray-400 uppercase tracking-wide">All teams complete by</div>
        {result.overallCompletionDate ? (
          <>
            <div className="text-4xl font-bold">
              {format(result.overallCompletionDate, 'MMMM d, yyyy')}
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
          <div><span className="font-semibold text-white">{result.totalEpics}</span> total epics</div>
          <div><span className="font-semibold text-white">{result.totalRemainingDays.toFixed(0)}</span> remaining days</div>
          <div><span className="font-semibold text-white">{result.teams.length}</span> teams</div>
        </div>
      </div>

      {/* Per-team cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {result.teams.map((team) => (
          <TeamCompletionCard key={team.projectKey} team={team} today={today} />
        ))}
      </div>
    </div>
  );
}
