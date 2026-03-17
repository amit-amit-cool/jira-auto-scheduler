'use client';
import { format, differenceInWeeks } from 'date-fns';
import { TeamSchedule } from '@/lib/scheduler/types';

interface Props {
  team: TeamSchedule;
  today: Date;
}

export function TeamCompletionCard({ team, today }: Props) {
  const weeksRemaining = team.completionDate
    ? Math.ceil(differenceInWeeks(team.completionDate, today))
    : null;

  const totalRemaining = team.epics.reduce((s, e) => s + e.remainingDays, 0);
  const totalSP = team.epics.reduce((s, e) => s + e.storyPoints, 0);
  const totalSpent = team.epics.reduce((s, e) => s + e.timeSpentDays, 0);
  const pct = totalSP > 0 ? Math.round((totalSpent / totalSP) * 100) : 0;

  return (
    <div className="border rounded-lg p-5 space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: team.color }}
        />
        <div>
          <h3 className="font-semibold">{team.projectName}</h3>
          <span className="text-xs text-gray-400">{team.projectKey}</span>
        </div>
      </div>

      {team.completionDate ? (
        <div className="text-2xl font-bold text-gray-900">
          {format(team.completionDate, 'MMM d, yyyy')}
        </div>
      ) : (
        <div className="text-2xl font-bold text-gray-400">No epics</div>
      )}

      {weeksRemaining !== null && (
        <div className="text-sm text-gray-500">
          ~{weeksRemaining} week{weeksRemaining !== 1 ? 's' : ''} from today
        </div>
      )}

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: team.color }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <div className="font-semibold text-gray-800">{team.epics.length}</div>
          <div className="text-gray-400">Epics</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-gray-800">{totalRemaining.toFixed(1)}</div>
          <div className="text-gray-400">Days left</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-gray-800">{team.weeklyCapacityDays.toFixed(1)}</div>
          <div className="text-gray-400">Days/wk</div>
        </div>
      </div>
    </div>
  );
}
