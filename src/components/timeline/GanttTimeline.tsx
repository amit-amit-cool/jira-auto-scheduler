'use client';

import {
  useState, useRef, useMemo, memo, useCallback, useEffect,
} from 'react';
import {
  addDays, differenceInDays, format,
  startOfMonth, endOfMonth, addMonths, subMonths, parseISO,
  startOfWeek, addWeeks, differenceInWeeks,
} from 'date-fns';
import { useSchedule } from '@/hooks/useSchedule';
import { usePhaseSchedule } from '@/hooks/usePhaseSchedule';
import { useSettings } from '@/hooks/useSettings';
import { ScheduledEpic, StatusCategory } from '@/lib/scheduler/types';

// ─── Layout constants ─────────────────────────────────────────────────────────
const ROW_H      = 36;
const TEAM_H     = 44;
const HEADER_H   = 56;
const COL_NAME   = 200;
const COL_STATUS = 90;
const COL_NWLD   = 80;
const COL_TOTAL  = 68;
const COL_REMAIN = 76;
const COL_START  = 86;
const COL_END    = 86;
const LEFT_W     = COL_NAME + COL_STATUS + COL_NWLD + COL_TOTAL + COL_REMAIN + COL_START + COL_END;
const DAY_PX_MIN = 3;
const DAY_PX_MAX = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const dayX    = (d: Date, start: Date, px: number) => differenceInDays(d, start) * px;
const lighten = (hex: string) => hex + '18';
const clamp   = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Sort key: V1=1, V2=2 … other labelled=9998, null=9999 */
function nwldOrder(nwld: string | null): number {
  if (!nwld) return 9999;
  const m = nwld.match(/v(\d+)/i);
  return m ? parseInt(m[1]) : 9998;
}

// ─── Status ───────────────────────────────────────────────────────────────────
const STATUS_CLS: Record<StatusCategory, string> = {
  done:       'bg-green-100 text-green-700',
  inprogress: 'bg-blue-100 text-blue-700',
  todo:       'bg-gray-100 text-gray-500',
};
const StatusBadge = memo(({ label, cat }: { label: string; cat: StatusCategory }) => (
  <span className={`inline-block px-1.5 py-0.5 rounded text-xs leading-none truncate max-w-full ${STATUS_CLS[cat]}`}>
    {label}
  </span>
));
StatusBadge.displayName = 'StatusBadge';

// ─── Tooltip type ─────────────────────────────────────────────────────────────
interface TooltipData { epic: ScheduledEpic; x: number; y: number }

// ─── Column header ────────────────────────────────────────────────────────────
function ColH({ label, w, align = 'right' }: { label: string; w: number; align?: 'left' | 'right' }) {
  return (
    <div
      className={`flex-shrink-0 flex items-end pb-1.5 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-200 ${align === 'right' ? 'justify-end' : ''}`}
      style={{ width: w, height: HEADER_H }}
    >{label}</div>
  );
}

// ─── Data cell ────────────────────────────────────────────────────────────────
function Cell({ children, w, h, align = 'right', cls = '' }: {
  children: React.ReactNode; w: number; h: number; align?: 'left' | 'right'; cls?: string;
}) {
  return (
    <div
      className={`flex-shrink-0 flex items-center border-r border-gray-100 px-2 text-xs ${align === 'right' ? 'justify-end tabular-nums' : ''} ${cls}`}
      style={{ width: w, height: h }}
    >{children}</div>
  );
}

// ─── Grid background (CSS, zero DOM nodes) ────────────────────────────────────
function gridBg(offsetX: number, dayPx: number): React.CSSProperties {
  const w = 7 * dayPx;
  return {
    backgroundImage: `repeating-linear-gradient(to right,transparent 0,transparent ${w - 1}px,#f3f4f6 ${w - 1}px,#f3f4f6 ${w}px)`,
    backgroundSize: `${w}px 100%`,
    backgroundPosition: `${offsetX}px 0`,
  };
}

// ─── Epic bar ─────────────────────────────────────────────────────────────────
const EpicBar = memo(function EpicBar({
  epic, startDate, dayPx, bgStyle, onHover,
}: {
  epic: ScheduledEpic; startDate: Date; dayPx: number;
  bgStyle: React.CSSProperties; onHover: (t: TooltipData | null) => void;
}) {
  const isDone = epic.statusCategory === 'done';
  const x = isDone ? 0 : dayX(epic.startDate, startDate, dayPx);
  const w = isDone ? 0 : Math.max(dayPx * 0.8, dayX(epic.endDate, startDate, dayPx) - x + dayPx);
  const pct = epic.storyPoints > 0 ? clamp(Math.round((epic.timeSpentDays / epic.storyPoints) * 100), 0, 100) : 0;

  return (
    <div className="relative border-b" style={{ height: ROW_H, ...bgStyle }} onMouseLeave={() => onHover(null)}>
      {!isDone && (
        <div
          className="absolute rounded cursor-pointer hover:opacity-90 transition-opacity"
          style={{ left: x, width: w, top: 7, height: ROW_H - 14,
            backgroundColor: epic.color + '33', border: `1.5px solid ${epic.color}88` }}
          onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); onHover({ epic, x: r.left, y: r.top }); }}
        >
          <div className="h-full rounded-l" style={{ width: `${pct}%`, backgroundColor: epic.color + '99', maxWidth: '100%' }} />
          {w > 60 && (
            <span className="absolute inset-0 flex items-center px-1.5 text-xs font-medium truncate pointer-events-none" style={{ color: epic.color }}>
              {epic.key}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

// ─── Schedule toast ───────────────────────────────────────────────────────────
interface ToastInfo { completionDate: Date; active: number; done: number; totalDays: number }

function ScheduleToast({ info, onClose }: { info: ToastInfo; onClose: () => void }) {
  const weeks = Math.ceil(differenceInWeeks(info.completionDate, new Date()));
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-4 w-80">
      <div className="text-2xl mt-0.5">✅</div>
      <div className="flex-1 space-y-1">
        <div className="font-semibold text-sm">Schedule updated</div>
        <div className="text-xs text-gray-300">All work completes by</div>
        <div className="text-lg font-bold text-white">{format(info.completionDate, 'MMM d, yyyy')}</div>
        <div className="text-xs text-gray-400">
          ~{weeks} week{weeks !== 1 ? 's' : ''} · {info.active} active epics · {info.totalDays.toFixed(0)} days remaining
        </div>
      </div>
      <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none mt-0.5">×</button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function GanttTimeline() {
  const { result: liveResult, isLoading, error } = useSchedule();
  const {
    savedSchedule, savedAt, phases,
    isScheduling, scheduleError,
    scheduleAndSave, clearSchedule, canSchedule,
  } = usePhaseSchedule();
  const { settings, updateSettings } = useSettings();

  // Prefer saved schedule; fall back to live
  const result = savedSchedule ?? liveResult;

  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [dayPxState, setDayPxState] = useState(14);
  const [tooltip,    setTooltip]    = useState<TooltipData | null>(null);
  const [toast,      setToast]      = useState<ToastInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [nwldFilter, setNwldFilter] = useState<string>('all');

  const dayPxRef      = useRef(dayPxState);
  const scrollRef     = useRef<HTMLDivElement>(null);  // right panel (h-scroll only)
  const headerRef     = useRef<HTMLDivElement>(null);  // date header (synced h-scroll)
  const dragOriginRef = useRef({ x: 0, scrollLeft: 0 });

  useEffect(() => { dayPxRef.current = dayPxState; }, [dayPxState]);

  // ── Derived ──
  const allKeys = useMemo(() => new Set(result?.teams.map((t) => t.projectKey) ?? []), [result]);
  const displayExpanded = expanded.size === 0 && allKeys.size > 0 ? allKeys : expanded;

  const toggleTeam  = useCallback((key: string) => {
    setExpanded((prev) => {
      const base = prev.size === 0 ? allKeys : prev;
      const next = new Set(base);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, [allKeys]);
  const expandAll   = useCallback(() => setExpanded(new Set(allKeys)), [allKeys]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const startDate = useMemo(() =>
    parseISO(settings.scheduleStartDate || new Date().toISOString().split('T')[0]),
    [settings.scheduleStartDate]);

  const viewStart = useMemo(() => startOfMonth(subMonths(startDate, 1)), [startDate]);

  const endDate = useMemo(() =>
    result?.overallCompletionDate ? addDays(result.overallCompletionDate, 14) : addDays(startDate, 90),
    [result, startDate]);

  const timelineWidth = (differenceInDays(endDate, viewStart) + 1) * dayPxState;

  const monthSegments = useMemo(() => {
    const segs: { label: string; x: number; w: number; date: Date }[] = [];
    let cur = startOfMonth(viewStart);
    while (cur <= endDate) {
      const segStart = cur < viewStart ? viewStart : cur;
      const next     = addMonths(cur, 1);
      const segEnd   = next > endDate ? endDate : addDays(next, -1);
      segs.push({ label: format(cur, 'MMM yyyy'), date: cur,
        x: dayX(segStart, viewStart, dayPxState),
        w: (differenceInDays(segEnd, segStart) + 1) * dayPxState });
      cur = next;
    }
    return segs;
  }, [viewStart, endDate, dayPxState]);

  const weekTicks = useMemo(() => {
    const ticks: { label: string; x: number }[] = [];
    let cur = startOfWeek(viewStart, { weekStartsOn: 1 });
    while (cur <= endDate) {
      if (cur >= viewStart) ticks.push({ label: format(cur, 'd'), x: dayX(cur, viewStart, dayPxState) });
      cur = addWeeks(cur, 1);
    }
    return ticks;
  }, [viewStart, endDate, dayPxState]);

  const bgStyle = useMemo(() => gridBg(weekTicks[0]?.x ?? 0, dayPxState), [weekTicks, dayPxState]);

  const nwldValues = useMemo(() => {
    // Use pre-computed phases from saved schedule; fall back to live derivation
    if (phases.length > 0) return phases;
    if (!result) return [];
    const vals = new Set<string>();
    result.teams.forEach(t => t.epics.forEach(e => { if (e.nwld) vals.add(e.nwld); }));
    return Array.from(vals).sort((a, b) => nwldOrder(a) - nwldOrder(b));
  }, [phases, result]);

  const today     = new Date();
  const todayX    = dayX(today, viewStart, dayPxState);
  const scheduleX = dayX(startDate, viewStart, dayPxState);
  const showToday = todayX >= 0 && todayX <= timelineWidth;

  // Sync header horizontal scroll to match scrollRef
  const syncHeader = useCallback(() => {
    if (headerRef.current && scrollRef.current)
      headerRef.current.scrollLeft = scrollRef.current.scrollLeft;
  }, []);

  // ── Wheel zoom ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect     = el.getBoundingClientRect();
      const mouseX   = e.clientX - rect.left + el.scrollLeft;
      const dayAtCur = mouseX / dayPxRef.current;
      const factor   = e.deltaY < 0 ? 1.12 : 0.89;
      const newDayPx = clamp(dayPxRef.current * factor, DAY_PX_MIN, DAY_PX_MAX);
      setDayPxState(newDayPx);
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollLeft = Math.max(0, dayAtCur * newDayPx - (e.clientX - rect.left));
        if (headerRef.current) headerRef.current.scrollLeft = el.scrollLeft;
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // ── Drag to pan ──────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragOriginRef.current = { x: e.clientX, scrollLeft: scrollRef.current?.scrollLeft ?? 0 };
    setIsDragging(true);
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    scrollRef.current.scrollLeft = dragOriginRef.current.scrollLeft - (e.clientX - dragOriginRef.current.x);
    if (headerRef.current) headerRef.current.scrollLeft = scrollRef.current.scrollLeft;
  }, [isDragging]);
  const onMouseUp = useCallback(() => setIsDragging(false), []);

  // ── Auto-scroll to schedule start ────────────────────────────────────────────
  useEffect(() => {
    if (!scrollRef.current || !result) return;
    const target = Math.max(0, scheduleX - 80);
    scrollRef.current.scrollLeft = target;
    if (headerRef.current) headerRef.current.scrollLeft = target;
  }, [scheduleX, result]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toast on schedule change ──────────────────────────────────────────────────
  const prevStartRef = useRef<string | null>(null);
  useEffect(() => {
    if (!result?.overallCompletionDate) return;
    if (prevStartRef.current === settings.scheduleStartDate) return;
    prevStartRef.current = settings.scheduleStartDate;
    const active    = result.teams.reduce((s, t) => s + t.epics.filter(e => e.statusCategory !== 'done').length, 0);
    const done      = result.teams.reduce((s, t) => s + t.epics.filter(e => e.statusCategory === 'done').length, 0);
    setToast({ completionDate: result.overallCompletionDate, active, done, totalDays: result.totalRemainingDays });
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [result, settings.scheduleStartDate]);

  // ── Zoom to month ─────────────────────────────────────────────────────────────
  function zoomToMonth(monthDate: Date) {
    const first      = monthDate < viewStart ? viewStart : monthDate;
    const last       = endOfMonth(monthDate) > endDate ? endDate : endOfMonth(monthDate);
    const daysInView = differenceInDays(last, first) + 1;
    const containerW = scrollRef.current?.clientWidth ?? 800;
    const newDayPx   = clamp(containerW / daysInView, DAY_PX_MIN, DAY_PX_MAX);
    setDayPxState(newDayPx);
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollLeft = dayX(first, viewStart, newDayPx);
      if (headerRef.current) headerRef.current.scrollLeft = scrollRef.current.scrollLeft;
    });
  }

  const PRESETS: { label: string; px: number }[] = [
    { label: 'Day',     px: 40 },
    { label: 'Week',    px: 20 },
    { label: 'Month',   px: 10 },
    { label: 'Quarter', px: 5  },
  ];

  // ── Per-phase completion dates (for the summary strip) ──────────────────────
  const phaseSummary = useMemo(() => {
    if (!savedSchedule || phases.length === 0) return [];
    return phases.map((ph) => {
      const phEpics = savedSchedule.teams.flatMap(t =>
        t.epics.filter(e => e.nwld === ph && e.statusCategory !== 'done')
      );
      const start = phEpics.length > 0
        ? phEpics.reduce((min, e) => e.startDate < min ? e.startDate : min, phEpics[0].startDate)
        : null;
      const end = phEpics.length > 0
        ? phEpics.reduce((max, e) => e.endDate > max ? e.endDate : max, phEpics[0].endDate)
        : null;
      return { phase: ph, start, end, count: phEpics.length };
    });
  }, [savedSchedule, phases]);

  if (isLoading && !savedSchedule) return <Placeholder>Calculating schedule…</Placeholder>;
  if (error && !savedSchedule)     return <Placeholder error>Error: {error.message}</Placeholder>;
  if (!result)                     return <Placeholder>Select projects in Settings to see the timeline.</Placeholder>;

  const filteredAllEpics = result.teams.flatMap(t =>
    nwldFilter === 'all' ? t.epics : t.epics.filter(e => e.nwld === nwldFilter)
  );
  const activeCount = filteredAllEpics.filter(e => e.statusCategory !== 'done').length;
  const doneCount   = filteredAllEpics.filter(e => e.statusCategory === 'done').length;
  const totalCount  = filteredAllEpics.length;

  return (
    <div className="space-y-2">
      {/* ── Save/phase banner ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={scheduleAndSave}
          disabled={isScheduling || !canSchedule}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isScheduling ? '⏳ Scheduling…' : '🗓 Schedule All Phases & Save'}
        </button>
        {savedSchedule && (
          <>
            <span className="text-xs text-gray-400">
              Saved{savedAt ? ` ${format(savedAt, 'MMM d, HH:mm')}` : ''} · showing snapshot
            </span>
            <button
              onClick={clearSchedule}
              className="text-xs text-gray-400 underline hover:text-gray-600"
            >clear</button>
          </>
        )}
        {scheduleError && <span className="text-xs text-red-500">{scheduleError}</span>}
      </div>

      {/* ── Phase summary cards ── */}
      {phaseSummary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {phaseSummary.map(({ phase, start, end, count }) => (
            <button
              key={phase}
              onClick={() => setNwldFilter(prev => prev === phase ? 'all' : phase)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                nwldFilter === phase
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="font-semibold">{phase}</span>
              {start && end && (
                <span className="ml-1.5 opacity-75">
                  {format(start, 'MMM d')} → {format(end, 'MMM d')}
                </span>
              )}
              <span className="ml-1.5 opacity-60">({count})</span>
            </button>
          ))}
          {nwldFilter !== 'all' && (
            <button
              onClick={() => setNwldFilter('all')}
              className="px-3 py-1.5 rounded-lg border text-xs text-gray-400 hover:bg-gray-50"
            >Show all</button>
          )}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center border rounded-lg overflow-hidden shadow-sm text-sm">
          <span className="px-3 py-2 text-gray-500 bg-gray-50 border-r whitespace-nowrap">Start date</span>
          <input
            type="date"
            value={settings.scheduleStartDate}
            onChange={(e) => updateSettings({ scheduleStartDate: e.target.value })}
            className="px-2 py-2 border-r focus:outline-none"
          />
          <button
            onClick={() => updateSettings({ scheduleStartDate: new Date().toISOString().split('T')[0] })}
            className="flex items-center gap-1.5 px-3 py-2 font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            ⚡ Schedule from today
          </button>
        </div>

        <div className="flex items-center gap-0 border rounded-lg overflow-hidden text-sm">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => setDayPxState(p.px)}
              className={`px-3 py-1.5 ${Math.abs(dayPxState - p.px) < 3 ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-600'}`}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="text-xs">−</span>
          <input type="range" min={DAY_PX_MIN} max={DAY_PX_MAX} step={0.5}
            value={dayPxState} onChange={(e) => setDayPxState(Number(e.target.value))}
            className="w-24 accent-blue-600" />
          <span className="text-xs">+</span>
        </div>

        {nwldValues.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">NWLD</span>
            <select value={nwldFilter} onChange={(e) => setNwldFilter(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All waves</option>
              {nwldValues.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1 border rounded-lg overflow-hidden text-sm">
          <button onClick={expandAll}   className="px-3 py-1.5 hover:bg-gray-50 text-gray-600">Expand all</button>
          <div className="w-px h-5 bg-gray-200" />
          <button onClick={collapseAll} className="px-3 py-1.5 hover:bg-gray-50 text-gray-600">Collapse all</button>
        </div>

        {showToday && (
          <button
            onClick={() => {
              if (!scrollRef.current) return;
              scrollRef.current.scrollLeft = Math.max(0, dayX(today, viewStart, dayPxState) - 200);
              if (headerRef.current) headerRef.current.scrollLeft = scrollRef.current.scrollLeft;
            }}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 text-gray-600"
          >Today</button>
        )}

        <span className="ml-auto text-sm text-gray-400">
          {activeCount} active · {doneCount} done · {totalCount} total{nwldFilter !== 'all' && ' (filtered)'}
        </span>
      </div>

      <p className="text-xs text-gray-400">
        Scroll to pan · Scroll wheel to zoom · Click a month label to zoom to it · Drag to pan
      </p>

      {/* ── Chart ──
          overflow: clip = clips visually like overflow:hidden but does NOT create
          a scroll container, so position:sticky on the header still works.       */}
      <div className="border rounded-xl bg-white shadow-sm" style={{ overflow: 'clip' }}>

        {/* ── Sticky header (sticks to viewport top while page scrolls) ── */}
        <div className="flex border-b bg-gray-50 z-20" style={{ height: HEADER_H, position: 'sticky', top: 0 }}>
          {/* Left column labels */}
          <div className="flex flex-shrink-0 border-r" style={{ width: LEFT_W }}>
            <ColH label="Epic"      w={COL_NAME}   align="left" />
            <ColH label="Status"    w={COL_STATUS}  align="left" />
            <ColH label="NWLD"      w={COL_NWLD}   align="left" />
            <ColH label="Est. days" w={COL_TOTAL} />
            <ColH label="Remaining" w={COL_REMAIN} />
            <ColH label="Start"     w={COL_START} />
            <ColH label="End"       w={COL_END} />
          </div>

          {/* Date header — overflow:hidden, scrollLeft driven by scrollRef */}
          <div ref={headerRef} className="flex-1 overflow-hidden">
            <div style={{ width: timelineWidth, height: HEADER_H, position: 'relative' }}>
              <div className="relative border-b" style={{ height: 28 }}>
                {monthSegments.map((seg, i) => (
                  <div key={i}
                    className="absolute top-0 h-full flex items-center px-2 text-xs font-semibold text-gray-600 border-r overflow-hidden cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors select-none"
                    style={{ left: seg.x, width: seg.w }}
                    onClick={() => zoomToMonth(seg.date)}
                    title="Click to zoom to this month"
                  >{seg.label}</div>
                ))}
              </div>
              <div className="relative" style={{ height: 28, ...bgStyle }}>
                {weekTicks.map((tick, i) => (
                  <div key={i}
                    className="absolute top-0 h-full flex items-center justify-center text-xs text-gray-400 select-none"
                    style={{ left: tick.x, width: 7 * dayPxState }}>
                    {dayPxState >= 8 && tick.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Body: left panel + right scrollable timeline, side by side ── */}
        <div className="flex" style={{ userSelect: isDragging ? 'none' : 'auto' }}>

          {/* Left panel — stays in place while right panel scrolls horizontally */}
          <div className="flex-shrink-0 border-r bg-white" style={{ width: LEFT_W }}>
            {result.teams.map((team) => {
              const isOpen        = displayExpanded.has(team.projectKey);
              const filteredEpics = nwldFilter === 'all'
                ? team.epics
                : team.epics.filter(e => e.nwld === nwldFilter);
              const visibleEpics  = isOpen
                ? [...filteredEpics].sort((a, b) => nwldOrder(a.nwld) - nwldOrder(b.nwld))
                : [];
              const activeEpics   = filteredEpics.filter(e => e.statusCategory !== 'done');
              const totalEst      = filteredEpics.reduce((s, e) => s + e.storyPoints, 0);
              const totalRem      = activeEpics.reduce((s, e) => s + e.remainingDays, 0);
              const firstDate     = activeEpics[0]?.startDate;
              const filteredEnd   = activeEpics.length > 0
                ? activeEpics.reduce((max, e) => e.endDate > max ? e.endDate : max, activeEpics[0].endDate)
                : null;
              const teamCfg       = settings.teams.find(t => t.projectKey === team.projectKey);
              const memberCount   = teamCfg?.members.length ?? 0;

              return (
                <div key={team.projectKey}>
                  {/* Team row */}
                  <div className="flex items-center border-b cursor-pointer font-medium"
                    style={{ height: TEAM_H, backgroundColor: lighten(team.color) }}
                    onClick={() => toggleTeam(team.projectKey)}>
                    <div className="flex items-center gap-1.5 px-2 border-r border-gray-200 overflow-hidden"
                      style={{ width: COL_NAME, height: TEAM_H }}>
                      <span className="text-gray-400 text-xs w-3 flex-shrink-0">{isOpen ? '▼' : '▶'}</span>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                      <span className="truncate text-gray-800 text-xs">{team.projectName}</span>
                      <span className="ml-auto text-xs text-gray-400 flex-shrink-0 pr-1">{filteredEpics.length}</span>
                    </div>
                    <Cell w={COL_STATUS} h={TEAM_H} align="left">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-gray-500">{activeEpics.length} active</span>
                        <span className="text-xs text-gray-400">
                          {memberCount} member{memberCount !== 1 ? 's' : ''} · {team.weeklyCapacityDays.toFixed(1)}d/wk
                        </span>
                      </div>
                    </Cell>
                    <Cell w={COL_NWLD}   h={TEAM_H} align="left"><span className="text-xs text-gray-300">—</span></Cell>
                    <Cell w={COL_TOTAL}  h={TEAM_H} cls="font-semibold text-gray-700">{totalEst}</Cell>
                    <Cell w={COL_REMAIN} h={TEAM_H} cls="font-semibold text-orange-600">{totalRem.toFixed(0)}</Cell>
                    <Cell w={COL_START}  h={TEAM_H} cls="text-gray-500">{firstDate ? format(firstDate, 'MMM d') : '—'}</Cell>
                    <Cell w={COL_END}    h={TEAM_H} cls="font-semibold text-gray-800">
                      {filteredEnd ? format(filteredEnd, 'MMM d') : '—'}
                    </Cell>
                  </div>

                  {/* Epic rows */}
                  {visibleEpics.map((epic) => (
                    <div key={epic.id} className="flex items-center border-b hover:bg-blue-50" style={{ height: ROW_H }}>
                      <div className="flex items-center gap-1.5 px-2 border-r border-gray-100 overflow-hidden"
                        style={{ width: COL_NAME, height: ROW_H }}>
                        <span className="font-mono text-blue-500 flex-shrink-0 text-xs" style={{ minWidth: 52 }}>{epic.key}</span>
                        <span className="truncate text-xs text-gray-600">{epic.summary}</span>
                      </div>
                      <Cell w={COL_STATUS} h={ROW_H} align="left">
                        <StatusBadge label={epic.status} cat={epic.statusCategory} />
                      </Cell>
                      <Cell w={COL_NWLD} h={ROW_H} align="left">
                        {epic.nwld
                          ? <span className="text-xs font-medium text-purple-600 truncate">{epic.nwld}</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </Cell>
                      <Cell w={COL_TOTAL}  h={ROW_H} cls="text-gray-500">{epic.storyPoints || '—'}</Cell>
                      <Cell w={COL_REMAIN} h={ROW_H} cls={epic.remainingDays > 0 ? 'text-orange-500 font-medium' : 'text-green-600'}>
                        {epic.statusCategory === 'done' ? '✓' : epic.remainingDays}
                      </Cell>
                      <Cell w={COL_START} h={ROW_H} cls="text-gray-500">
                        {epic.statusCategory !== 'done' ? format(epic.startDate, 'MMM d') : '—'}
                      </Cell>
                      <Cell w={COL_END} h={ROW_H} cls="text-gray-800 font-medium">
                        {epic.statusCategory !== 'done' ? format(epic.endDate, 'MMM d') : '—'}
                      </Cell>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Right panel — horizontal scroll only, vertical handled by page */}
          <div
            ref={scrollRef}
            className={`overflow-x-auto flex-1 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onScroll={syncHeader}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <div style={{ width: timelineWidth, position: 'relative', minWidth: '100%' }}>
              {result.teams.map((team) => {
                const isOpen        = displayExpanded.has(team.projectKey);
                const filteredEpics = nwldFilter === 'all'
                  ? team.epics
                  : team.epics.filter(e => e.nwld === nwldFilter);
                const visibleEpics  = isOpen
                  ? [...filteredEpics].sort((a, b) => nwldOrder(a.nwld) - nwldOrder(b.nwld))
                  : [];
                const filteredActive = filteredEpics.filter(e => e.statusCategory !== 'done');
                const filteredEnd    = filteredActive.length > 0
                  ? filteredActive.reduce((max, e) => e.endDate > max ? e.endDate : max, filteredActive[0].endDate)
                  : null;

                return (
                  <div key={team.projectKey}>
                    <div className="relative border-b" style={{ height: TEAM_H, backgroundColor: lighten(team.color), ...bgStyle }}>
                      {filteredActive.length > 0 && (() => {
                        const x = dayX(filteredActive[0].startDate, viewStart, dayPxState);
                        const w = Math.max(dayPxState, dayX(filteredActive[filteredActive.length - 1].endDate, viewStart, dayPxState) - x + dayPxState);
                        return <div className="absolute top-4 rounded-full opacity-25"
                          style={{ left: x, width: w, height: TEAM_H - 32, backgroundColor: team.color }} />;
                      })()}
                      {filteredEnd && (
                        <div className="absolute top-1 text-xs font-semibold whitespace-nowrap select-none"
                          style={{ left: dayX(filteredEnd, viewStart, dayPxState) + 4, color: team.color }}>
                          {format(filteredEnd, 'MMM d')}
                        </div>
                      )}
                    </div>

                    {visibleEpics.map((epic) => (
                      <EpicBar key={epic.id} epic={epic} startDate={viewStart}
                        dayPx={dayPxState} bgStyle={bgStyle} onHover={setTooltip} />
                    ))}
                  </div>
                );
              })}

              {/* Schedule-start marker */}
              <div className="absolute top-0 bottom-0 pointer-events-none z-10"
                style={{ left: scheduleX, width: 1, borderLeft: '2px dashed #3b82f6', opacity: 0.5 }}>
                <div className="absolute top-0 left-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded whitespace-nowrap select-none">
                  Schedule start
                </div>
              </div>

              {/* Today line */}
              {showToday && (
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 opacity-60 pointer-events-none z-10"
                  style={{ left: todayX }}>
                  <div className="absolute top-0 -left-5 bg-red-400 text-white text-xs px-1 py-0.5 rounded whitespace-nowrap select-none">
                    Today
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        {result.teams.map((t) => (
          <div key={t.projectKey} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: t.color }} />
            <span>{t.projectName}</span>
            {t.completionDate && <span className="text-gray-400">→ {format(t.completionDate, 'MMM d, yyyy')}</span>}
          </div>
        ))}
      </div>

      {tooltip && <EpicTooltip data={tooltip} onClose={() => setTooltip(null)} />}
      {toast    && <ScheduleToast info={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function EpicTooltip({ data }: { data: TooltipData; onClose: () => void }) {
  const { epic } = data;
  const isDone = epic.statusCategory === 'done';
  const pct    = epic.storyPoints > 0 ? clamp(Math.round((epic.timeSpentDays / epic.storyPoints) * 100), 0, 100) : 0;
  return (
    <div className="fixed z-50 bg-white border rounded-xl shadow-xl p-4 text-sm space-y-2 pointer-events-none"
      style={{ left: clamp(data.x, 8, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 272), top: data.y - 8, width: 264 }}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs" style={{ color: epic.color }}>{epic.key}</span>
        <StatusBadge label={epic.status} cat={epic.statusCategory} />
      </div>
      <div className="font-medium text-gray-900 leading-snug">{epic.summary}</div>
      {epic.nwld && <div className="text-xs font-medium text-purple-600">{epic.nwld}</div>}
      {epic.assignedTo && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5">
          <span className="text-gray-400">👤</span>
          <span className="font-medium">{epic.assignedTo}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500 pt-1 border-t">
        {!isDone && <>
          <span>Start</span>   <span className="text-gray-800">{format(epic.startDate, 'MMM d, yyyy')}</span>
          <span>End</span>     <span className="text-gray-800 font-semibold">{format(epic.endDate, 'MMM d, yyyy')}</span>
        </>}
        <span>Est. days</span> <span className="text-gray-800">{epic.storyPoints || '—'}</span>
        <span>Spent</span>     <span className="text-gray-800">{epic.timeSpentDays}d</span>
        <span>Remaining</span> <span className={isDone ? 'text-green-600 font-semibold' : 'text-orange-600 font-semibold'}>
          {isDone ? '✓ Done' : `${epic.remainingDays}d`}
        </span>
      </div>
      {epic.storyPoints > 0 && (
        <div className="pt-1">
          <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Progress</span><span>{pct}%</span></div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: epic.color }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Placeholder ──────────────────────────────────────────────────────────────
function Placeholder({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div className={`border rounded-xl p-16 text-center text-sm ${error ? 'text-red-500' : 'text-gray-400'}`}>
      {children}
    </div>
  );
}
