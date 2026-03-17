'use client';

import { useState, useRef, useMemo } from 'react';
import {
  addDays,
  differenceInDays,
  format,
  startOfMonth,
  addMonths,
  parseISO,
  startOfWeek,
  addWeeks,
} from 'date-fns';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { ScheduledEpic } from '@/lib/scheduler/types';

// ─── Layout constants ─────────────────────────────────────────────────────────
const ROW_HEIGHT = 36;
const TEAM_ROW_HEIGHT = 44;
const HEADER_HEIGHT = 56;

// Left panel column widths
const COL_NAME    = 200;
const COL_TOTAL   = 70;
const COL_REMAIN  = 78;
const COL_START   = 90;
const COL_END     = 90;
const LEFT_WIDTH  = COL_NAME + COL_TOTAL + COL_REMAIN + COL_START + COL_END;

type ZoomLevel = 'week' | 'month' | 'quarter';
const ZOOM: Record<ZoomLevel, number> = { week: 28, month: 14, quarter: 7 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dayX(date: Date, start: Date, dayPx: number) {
  return differenceInDays(date, start) * dayPx;
}
function lighten(hex: string) { return hex + '22'; }

// ─── Tooltip type ─────────────────────────────────────────────────────────────
interface TooltipData { epic: ScheduledEpic; x: number; y: number; }

// ─── Column header cell ───────────────────────────────────────────────────────
function ColHeader({ label, width, align = 'right' }: { label: string; width: number; align?: 'left' | 'right' }) {
  return (
    <div
      className={`flex-shrink-0 flex items-end pb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 px-2 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
      style={{ width, height: HEADER_HEIGHT }}
    >
      {label}
    </div>
  );
}

// ─── Left panel data cell ─────────────────────────────────────────────────────
function Cell({
  children, width, height, align = 'right', className = '',
}: {
  children: React.ReactNode; width: number; height: number;
  align?: 'left' | 'right'; className?: string;
}) {
  return (
    <div
      className={`flex-shrink-0 flex items-center border-r border-gray-100 px-2 text-xs ${align === 'right' ? 'justify-end tabular-nums' : 'justify-start'} ${className}`}
      style={{ width, height }}
    >
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function GanttTimeline() {
  const { result, isLoading, error } = useSchedule();
  const { settings, updateSettings } = useSettings();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState<ZoomLevel>('month');
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayPx = ZOOM[zoom];

  const allKeys = useMemo(() => new Set(result?.teams.map((t) => t.projectKey) ?? []), [result]);
  // Default: all expanded
  const displayExpanded = expanded.size === 0 && allKeys.size > 0 ? allKeys : expanded;

  function toggleTeam(key: string) {
    setExpanded((prev) => {
      const base = prev.size === 0 ? allKeys : prev;
      const next = new Set(base);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function expandAll()   { setExpanded(new Set(allKeys)); }
  function collapseAll() { setExpanded(new Set()); }

  // Date range
  const startDate = useMemo(() => {
    if (!result) return new Date();
    return parseISO(settings.scheduleStartDate || new Date().toISOString().split('T')[0]);
  }, [result, settings.scheduleStartDate]);

  const endDate = useMemo(() => {
    if (!result?.overallCompletionDate) return addDays(startDate, 90);
    return addDays(result.overallCompletionDate, 14);
  }, [result, startDate]);

  const totalDays = differenceInDays(endDate, startDate) + 1;
  const timelineWidth = totalDays * dayPx;

  // Month segments
  const monthSegments = useMemo(() => {
    const segs: { label: string; x: number; width: number }[] = [];
    let cur = startOfMonth(startDate);
    while (cur <= endDate) {
      const segStart = cur < startDate ? startDate : cur;
      const nextMonth = addMonths(cur, 1);
      const segEnd = nextMonth > endDate ? endDate : addDays(nextMonth, -1);
      segs.push({
        label: format(cur, 'MMM yyyy'),
        x: dayX(segStart, startDate, dayPx),
        width: (differenceInDays(segEnd, segStart) + 1) * dayPx,
      });
      cur = nextMonth;
    }
    return segs;
  }, [startDate, endDate, dayPx]);

  // Week ticks
  const weekTicks = useMemo(() => {
    const ticks: { label: string; x: number }[] = [];
    let cur = startOfWeek(startDate, { weekStartsOn: 1 });
    while (cur <= endDate) {
      if (cur >= startDate) ticks.push({ label: format(cur, 'd'), x: dayX(cur, startDate, dayPx) });
      cur = addWeeks(cur, 1);
    }
    return ticks;
  }, [startDate, endDate, dayPx]);

  // Today
  const today = new Date();
  const todayX = dayX(today, startDate, dayPx);
  const showToday = todayX >= 0 && todayX <= timelineWidth;

  function autoSchedule() {
    updateSettings({ scheduleStartDate: new Date().toISOString().split('T')[0] });
  }
  function scrollToToday() {
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayX - 200);
  }

  if (isLoading) return <div className="border rounded-xl p-16 text-center text-gray-400 text-sm">Calculating schedule…</div>;
  if (error)     return <div className="border rounded-xl p-8 text-center text-red-500 text-sm">Error: {error.message}</div>;
  if (!result)   return <div className="border rounded-xl p-16 text-center text-gray-400 text-sm">Select projects in Settings to see the timeline.</div>;

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={autoSchedule}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
        >
          ⚡ Auto-Schedule from Today
        </button>

        <div className="flex items-center gap-1 border rounded-lg overflow-hidden text-sm">
          {(['week', 'month', 'quarter'] as ZoomLevel[]).map((z) => (
            <button key={z} onClick={() => setZoom(z)}
              className={`px-3 py-1.5 capitalize ${zoom === z ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-600'}`}>
              {z}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border rounded-lg overflow-hidden text-sm">
          <button onClick={expandAll}   className="px-3 py-1.5 hover:bg-gray-50 text-gray-600">Expand all</button>
          <div className="w-px h-5 bg-gray-200" />
          <button onClick={collapseAll} className="px-3 py-1.5 hover:bg-gray-50 text-gray-600">Collapse all</button>
        </div>

        {showToday && (
          <button onClick={scrollToToday} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 text-gray-600">
            Jump to today
          </button>
        )}

        <span className="ml-auto text-sm text-gray-400">
          {result.totalEpics} epics · {result.teams.length} teams
        </span>
      </div>

      {/* ── Chart ── */}
      <div className="border rounded-xl overflow-hidden bg-white shadow-sm select-none">
        <div className="flex overflow-x-auto">

          {/* ════ Left panel (sticky) ════ */}
          <div
            className="flex-shrink-0 border-r bg-white z-10"
            style={{ width: LEFT_WIDTH, position: 'sticky', left: 0 }}
          >
            {/* Column headers */}
            <div className="flex border-b bg-gray-50" style={{ height: HEADER_HEIGHT }}>
              <ColHeader label="Epic" width={COL_NAME} align="left" />
              <ColHeader label="Est. days" width={COL_TOTAL} />
              <ColHeader label="Remaining" width={COL_REMAIN} />
              <ColHeader label="Start" width={COL_START} />
              <ColHeader label="End" width={COL_END} />
            </div>

            {/* Rows */}
            {result.teams.map((team) => {
              const isOpen = displayExpanded.has(team.projectKey);
              const totalEst  = team.epics.reduce((s, e) => s + e.storyPoints, 0);
              const totalRem  = team.epics.reduce((s, e) => s + e.remainingDays, 0);
              const firstDate = team.epics[0]?.startDate;
              const lastDate  = team.completionDate;

              return (
                <div key={team.projectKey}>
                  {/* Team row */}
                  <div
                    className="flex items-center border-b cursor-pointer hover:brightness-95 font-medium text-sm"
                    style={{ height: TEAM_ROW_HEIGHT, backgroundColor: lighten(team.color) }}
                    onClick={() => toggleTeam(team.projectKey)}
                  >
                    {/* Name cell */}
                    <div className="flex items-center gap-1.5 px-2 border-r border-gray-200 overflow-hidden"
                      style={{ width: COL_NAME, height: TEAM_ROW_HEIGHT }}>
                      <span className="text-gray-400 text-xs w-3 flex-shrink-0">{isOpen ? '▼' : '▶'}</span>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                      <span className="truncate text-gray-800 text-xs">{team.projectName}</span>
                      <span className="ml-auto text-xs text-gray-400 flex-shrink-0 pr-1">{team.epics.length}</span>
                    </div>
                    <Cell width={COL_TOTAL}  height={TEAM_ROW_HEIGHT} className="font-semibold text-gray-700">{totalEst}</Cell>
                    <Cell width={COL_REMAIN} height={TEAM_ROW_HEIGHT} className="font-semibold text-orange-600">{totalRem.toFixed(0)}</Cell>
                    <Cell width={COL_START}  height={TEAM_ROW_HEIGHT} className="text-gray-500">
                      {firstDate ? format(firstDate, 'MMM d') : '—'}
                    </Cell>
                    <Cell width={COL_END}    height={TEAM_ROW_HEIGHT} className="font-semibold text-gray-800">
                      {lastDate ? format(lastDate, 'MMM d') : '—'}
                    </Cell>
                  </div>

                  {/* Epic rows */}
                  {isOpen && team.epics.map((epic) => (
                    <div key={epic.id} className="flex items-center border-b hover:bg-blue-50"
                      style={{ height: ROW_HEIGHT }}>
                      {/* Name cell */}
                      <div className="flex items-center gap-1.5 px-2 border-r border-gray-100 overflow-hidden"
                        style={{ width: COL_NAME, height: ROW_HEIGHT }}>
                        <span className="font-mono text-blue-500 flex-shrink-0 text-xs"
                          style={{ minWidth: 56 }}>{epic.key}</span>
                        <span className="truncate text-xs text-gray-600">{epic.summary}</span>
                      </div>
                      <Cell width={COL_TOTAL}  height={ROW_HEIGHT} className="text-gray-600">{epic.storyPoints}</Cell>
                      <Cell width={COL_REMAIN} height={ROW_HEIGHT} className={epic.remainingDays > 0 ? 'text-orange-500 font-medium' : 'text-green-600'}>
                        {epic.remainingDays}
                      </Cell>
                      <Cell width={COL_START} height={ROW_HEIGHT} className="text-gray-500">
                        {format(epic.startDate, 'MMM d')}
                      </Cell>
                      <Cell width={COL_END}   height={ROW_HEIGHT} className="text-gray-800 font-medium">
                        {format(epic.endDate, 'MMM d')}
                      </Cell>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* ════ Right scrollable timeline ════ */}
          <div ref={scrollRef} className="overflow-x-auto flex-1" style={{ position: 'relative' }}>
            <div style={{ width: timelineWidth, position: 'relative', minWidth: '100%' }}>

              {/* Date header */}
              <div className="sticky top-0 z-10 bg-gray-50 border-b" style={{ height: HEADER_HEIGHT }}>
                <div className="relative border-b" style={{ height: 28 }}>
                  {monthSegments.map((seg, i) => (
                    <div key={i} className="absolute top-0 h-full flex items-center px-2 text-xs font-semibold text-gray-600 border-r overflow-hidden"
                      style={{ left: seg.x, width: seg.width }}>
                      {seg.label}
                    </div>
                  ))}
                </div>
                <div className="relative" style={{ height: 28 }}>
                  {weekTicks.map((tick, i) => (
                    <div key={i} className="absolute top-0 h-full flex items-center justify-center text-xs text-gray-400 border-r"
                      style={{ left: tick.x, width: 7 * dayPx }}>
                      {zoom !== 'quarter' && tick.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Team + epic bars */}
              {result.teams.map((team) => {
                const isOpen = displayExpanded.has(team.projectKey);
                return (
                  <div key={team.projectKey}>
                    {/* Team span row */}
                    <div className="relative border-b" style={{ height: TEAM_ROW_HEIGHT, backgroundColor: lighten(team.color) }}>
                      <WeekGrid weekTicks={weekTicks} dayPx={dayPx} height={TEAM_ROW_HEIGHT} />
                      {team.epics.length > 0 && (() => {
                        const x = dayX(team.epics[0].startDate, startDate, dayPx);
                        const w = Math.max(dayPx, dayX(team.epics[team.epics.length - 1].endDate, startDate, dayPx) - x + dayPx);
                        return (
                          <div className="absolute top-3.5 rounded-full opacity-30"
                            style={{ left: x, width: w, height: TEAM_ROW_HEIGHT - 28, backgroundColor: team.color }} />
                        );
                      })()}
                      {team.completionDate && (
                        <div className="absolute top-1 text-xs font-semibold whitespace-nowrap"
                          style={{ left: dayX(team.completionDate, startDate, dayPx) + 4, color: team.color }}>
                          {format(team.completionDate, 'MMM d')}
                        </div>
                      )}
                    </div>

                    {/* Epic bars */}
                    {isOpen && team.epics.map((epic) => (
                      <EpicRow
                        key={epic.id}
                        epic={epic}
                        startDate={startDate}
                        dayPx={dayPx}
                        weekTicks={weekTicks}
                        onHover={setTooltip}
                      />
                    ))}
                  </div>
                );
              })}

              {/* Today line */}
              {showToday && (
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 opacity-70 pointer-events-none z-20"
                  style={{ left: todayX }}>
                  <div className="absolute -top-0 -left-3 text-red-400 text-xs font-bold">▼</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && <EpicTooltip data={tooltip} onClose={() => setTooltip(null)} />}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        {result.teams.map((t) => (
          <div key={t.projectKey} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: t.color }} />
            <span>{t.projectName}</span>
            {t.completionDate && <span className="text-gray-400">→ {format(t.completionDate, 'MMM d, yyyy')}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Epic bar row ─────────────────────────────────────────────────────────────
function EpicRow({
  epic, startDate, dayPx, weekTicks, onHover,
}: {
  epic: ScheduledEpic; startDate: Date; dayPx: number;
  weekTicks: { x: number }[]; onHover: (t: TooltipData | null) => void;
}) {
  const x = dayX(epic.startDate, startDate, dayPx);
  const w = Math.max(dayPx * 0.8, dayX(epic.endDate, startDate, dayPx) - x + dayPx);
  const pct = epic.storyPoints > 0 ? Math.round((epic.timeSpentDays / epic.storyPoints) * 100) : 0;

  return (
    <div className="relative border-b" style={{ height: ROW_HEIGHT }} onMouseLeave={() => onHover(null)}>
      <WeekGrid weekTicks={weekTicks} dayPx={dayPx} height={ROW_HEIGHT} />
      <div
        className="absolute rounded cursor-pointer hover:opacity-90 transition-opacity"
        style={{ left: x, width: w, top: 7, height: ROW_HEIGHT - 14,
          backgroundColor: epic.color + '33', border: `1.5px solid ${epic.color}88` }}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onHover({ epic, x: rect.left, y: rect.top });
        }}
      >
        <div className="h-full rounded-l" style={{ width: `${pct}%`, backgroundColor: epic.color + '88', maxWidth: '100%' }} />
        {w > 60 && (
          <span className="absolute inset-0 flex items-center px-1.5 text-xs font-medium truncate pointer-events-none"
            style={{ color: epic.color }}>
            {epic.key}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Week grid ────────────────────────────────────────────────────────────────
function WeekGrid({ weekTicks, dayPx, height }: { weekTicks: { x: number }[]; dayPx: number; height: number }) {
  return (
    <>
      {weekTicks.map((tick, i) => (
        <div key={i} className="absolute top-0 border-r border-gray-100 pointer-events-none"
          style={{ left: tick.x, width: 7 * dayPx, height }} />
      ))}
    </>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function EpicTooltip({ data }: { data: TooltipData; onClose: () => void }) {
  const { epic } = data;
  return (
    <div className="fixed z-50 bg-white border rounded-xl shadow-xl p-4 text-sm space-y-2 pointer-events-none"
      style={{ left: Math.min(data.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 280), top: data.y - 10, width: 260 }}>
      <div className="font-mono text-xs" style={{ color: epic.color }}>{epic.key}</div>
      <div className="font-medium text-gray-900 leading-snug">{epic.summary}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 pt-1 border-t">
        <span>Start</span>        <span className="text-gray-800">{format(epic.startDate, 'MMM d, yyyy')}</span>
        <span>End</span>          <span className="text-gray-800 font-semibold">{format(epic.endDate, 'MMM d, yyyy')}</span>
        <span>Est. days</span>    <span className="text-gray-800">{epic.storyPoints}</span>
        <span>Spent</span>        <span className="text-gray-800">{epic.timeSpentDays}d</span>
        <span>Remaining</span>    <span className="text-gray-800 font-semibold">{epic.remainingDays}d</span>
      </div>
      {epic.storyPoints > 0 && (
        <div className="pt-1">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progress</span>
            <span>{Math.min(100, Math.round((epic.timeSpentDays / epic.storyPoints) * 100))}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full"
              style={{ width: `${Math.min(100, Math.round((epic.timeSpentDays / epic.storyPoints) * 100))}%`, backgroundColor: epic.color }} />
          </div>
        </div>
      )}
    </div>
  );
}
