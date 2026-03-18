'use client';
import { JiraConnectionForm } from '@/components/settings/JiraConnectionForm';
import { ProjectSelector } from '@/components/settings/ProjectSelector';
import { TeamMemberTable } from '@/components/settings/TeamMemberTable';
import { ScheduleStartDate } from '@/components/settings/ScheduleStartDate';
import { SchedulingMode } from '@/components/settings/SchedulingMode';
import { EstimationBuffer } from '@/components/settings/EstimationBuffer';
import { AdvancedFields } from '@/components/settings/AdvancedFields';
import { useSettings } from '@/hooks/useSettings';

export default function SettingsPage() {
  const { settings } = useSettings();

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your Jira connection and team capacity.</p>
      </div>

      <section>
        <JiraConnectionForm />
      </section>

      <hr />

      <section>
        <ProjectSelector />
      </section>

      <hr />

      <section>
        <TeamMemberTable />
      </section>

      <hr />

      <section>
        <ScheduleStartDate />
      </section>

      <hr />

      <section>
        <SchedulingMode />
      </section>

      <hr />

      <section>
        <EstimationBuffer />
      </section>

      <hr />

      <section>
        <AdvancedFields />
      </section>

      <div className="pb-8 text-xs text-gray-400">
        Settings are saved automatically to localStorage.
      </div>
    </div>
  );
}
