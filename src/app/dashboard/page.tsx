'use client';
import { EpicTable } from '@/components/dashboard/EpicTable';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-1">All epics with scheduling estimates.</p>
      </div>
      <EpicTable />
    </div>
  );
}
