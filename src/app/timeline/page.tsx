'use client';
import { GanttTimeline } from '@/components/timeline/GanttTimeline';

export default function TimelinePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timeline</h1>
        <p className="text-gray-500 mt-1">Gantt chart view of all team schedules.</p>
      </div>
      <GanttTimeline />
    </div>
  );
}
