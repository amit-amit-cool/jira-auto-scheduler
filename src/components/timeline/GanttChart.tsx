'use client';
import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useSchedule } from '@/hooks/useSchedule';
import { usePublish } from '@/hooks/usePublish';
import { ScheduledEpic, ScheduleResult } from '@/lib/scheduler/types';

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
  const { publish, isPublishing, result: publishResult, error: publishError } = usePublish();
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());

  function toggleTeam(projectKey: string) {
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(projectKey)) next.delete(projectKey);
      else next.add(projectKey);
      return next;
    });
  }

  function buildTasks(teams: ScheduleResult['teams'], collapsed: Set<string>): GanttTask[] {
    return teams
      .filter((t) => !collapsed.has(t.projectKey))
      .flatMap((t) => t.epics)
      .map((epic: ScheduledEpic) => ({
        id: epic.id,
        name: `[${epic.projectKey}] ${epic.summary}`,
        start: format(epic.startDate, 'yyyy-MM-dd'),
        end: format(epic.endDate, 'yyyy-MM-dd'),
        progress: epic.storyPoints > 0
          ? Math.round((epic.timeSpentDays / epic.storyPoints) * 100)
          : 0,
        custom_class: `team-${epic.projectKey.toLowerCase()}`,
      }));
  }

  // Initialize Gantt once when result first loads
  useEffect(() => {
    if (!result || !containerRef.current) return;

    const tasks = buildTasks(result.teams, collapsedTeams);

    // Build CSS for team colors
    const styleId = 'gantt-team-colors';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = result.teams
      .map((t) => `.gantt .bar.team-${t.projectKey.toLowerCase()} .bar-progress { fill: ${t.color}; } .gantt .bar.team-${t.projectKey.toLowerCase()} .bar-inner { fill: ${t.color}88; }`)
      .join('\n');

    import('frappe-gantt').then(({ default: Gantt }) => {
      if (!containerRef.current) return;
      if (tasks.length === 0) {
        containerRef.current.innerHTML = '';
        ganttRef.current = null;
        return;
      }
      containerRef.current.innerHTML = '';
      ganttRef.current = new Gantt(containerRef.current, tasks, {
        view_mode: 'Week',
        date_format: 'YYYY-MM-DD',
        popup_trigger: 'click',
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // When collapse state changes, refresh existing Gantt instead of recreating
  useEffect(() => {
    if (!result || !ganttRef.current) return;
    const tasks = buildTasks(result.teams, collapsedTeams);
    if (tasks.length === 0) {
      if (containerRef.current) containerRef.current.innerHTML = '';
      ganttRef.current = null;
      return;
    }
    (ganttRef.current as { refresh: (t: GanttTask[]) => void }).refresh(tasks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsedTeams]);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading schedule…</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error.message}</div>;
  if (!result) return <div className="p-8 text-center text-gray-400">Configure settings to see the timeline.</div>;

  return (
    <div className="space-y-4">
      {/* Team capacity cards — click to collapse/expand that team in the Gantt */}
      <div className="flex flex-wrap gap-3">
        {result.teams.map((t) => {
          const collapsed = collapsedTeams.has(t.projectKey);
          return (
            <button
              key={t.projectKey}
              onClick={() => toggleTeam(t.projectKey)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-opacity text-left"
              style={{
                borderColor: t.color,
                backgroundColor: `${t.color}10`,
                opacity: collapsed ? 0.45 : 1,
              }}
            >
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: t.color }} />
              <div>
                <div className="font-medium leading-tight flex items-center gap-1">
                  {t.projectName}
                  <span className="text-gray-400 text-xs">{collapsed ? '▶' : '▼'}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {t.weeklyCapacityDays.toFixed(1)} days/wk
                  {' · '}
                  {t.epics.filter(e => e.statusCategory !== 'done').length} epics
                  {t.completionDate && (
                    <> · done {format(t.completionDate, 'MMM d')}</>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* View mode buttons + Publish */}
      <div className="flex items-center justify-between gap-2">
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
        <div className="flex items-center gap-3">
          {publishResult && (
            <span className="text-sm text-green-600">
              ✓ Published {publishResult.succeeded}/{publishResult.total} epics to Jira
            </span>
          )}
          {publishError && (
            <span className="text-sm text-red-500">{publishError}</span>
          )}
          <button
            onClick={publish}
            disabled={isPublishing}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPublishing ? 'Publishing…' : 'Publish to Jira'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div ref={containerRef} className="gantt-container" />
      </div>
    </div>
  );
}
