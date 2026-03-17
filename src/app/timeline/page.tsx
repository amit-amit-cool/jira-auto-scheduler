'use client';
import { GanttTimeline } from '@/components/timeline/GanttTimeline';

export default function TimelinePage() {
  return (
    // Break out of max-w-7xl padding to use full viewport width
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-3">
      <h1 className="text-xl font-bold mb-3">Timeline</h1>
      <GanttTimeline />
    </div>
  );
}
