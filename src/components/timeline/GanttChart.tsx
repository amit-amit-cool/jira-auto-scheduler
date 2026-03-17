'use client';
import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useSchedule } from '@/hooks/useSchedule';
import { ScheduledEpic } from '@/lib/scheduler/types';

// frappe-gantt task type
interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  custom_class?: string;
}

export function GanttChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<unknown>(null);
  const { result, isLoading, error } = useSchedule();

  useEffect(() => {
    if (!result || !containerRef.current) return;

    const allEpics = result.teams.flatMap((t) => t.epics);
    if (allEpics.length === 0) return;

    // Build tasks list
    const tasks: GanttTask[] = allEpics.map((epic: ScheduledEpic) => ({
      id: epic.id,
      name: `[${epic.projectKey}] ${epic.summary}`,
      start: format(epic.startDate, 'yyyy-MM-dd'),
      end: format(epic.endDate, 'yyyy-MM-dd'),
      progress: epic.storyPoints > 0
        ? Math.round((epic.timeSpentDays / epic.storyPoints) * 100)
        : 0,
      custom_class: `team-${epic.projectKey.toLowerCase()}`,
    }));

    // Build CSS for team colors
    const styleId = 'gantt-team-colors';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = result.teams
      .map(
        (t) => `.gantt .bar.team-${t.projectKey.toLowerCase()} .bar-progress { fill: ${t.color}; } .gantt .bar.team-${t.projectKey.toLowerCase()} .bar-inner { fill: ${t.color}88; }`
      )
      .join('\n');

    // Dynamically import frappe-gantt to avoid SSR issues
    import('frappe-gantt').then(({ default: Gantt }) => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';
      ganttRef.current = new Gantt(containerRef.current, tasks, {
        view_mode: 'Week',
        date_format: 'YYYY-MM-DD',
        popup_trigger: 'click',
      });
    });
  }, [result]);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading schedule…</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error.message}</div>;
  if (!result) return <div className="p-8 text-center text-gray-400">Configure settings to see the timeline.</div>;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {result.teams.map((t) => (
          <div key={t.projectKey} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: t.color }} />
            <span>{t.projectName}</span>
          </div>
        ))}
      </div>

      {/* View mode buttons */}
      <div className="flex gap-2">
        {(['Day', 'Week', 'Month', 'Quarter Year'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => {
              if (ganttRef.current) {
                (ganttRef.current as { change_view_mode: (m: string) => void }).change_view_mode(mode);
              }
            }}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div ref={containerRef} className="gantt-container" />
      </div>
    </div>
  );
}
