'use client';
import { OverallSummary } from '@/components/summary/OverallSummary';

export default function SummaryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Summary</h1>
        <p className="text-gray-500 mt-1">Team completion dates and overall finish date.</p>
      </div>
      <OverallSummary />
    </div>
  );
}
