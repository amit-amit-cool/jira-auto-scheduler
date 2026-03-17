'use client';
import useSWR from 'swr';
import { useSettings } from '@/hooks/useSettings';
import { useServerConfig } from '@/hooks/useServerConfig';
import { buildClientHeaders } from '@/lib/jira/clientHeaders';
import { JiraProject } from '@/types/jira';
import { TEAM_COLORS } from '@/types/app';

const fetcher = (url: string, headers: Record<string, string>) =>
  fetch(url, { headers }).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch projects');
    return r.json();
  });

export function ProjectSelector() {
  const { settings, updateSettings } = useSettings();
  const serverConfig = useServerConfig();
  const headers = buildClientHeaders(settings);
  const hasCredentials =
    serverConfig.configured ||
    !!(settings.jiraBaseUrl && settings.jiraEmail && settings.jiraToken);

  const { data, error, isLoading } = useSWR(
    hasCredentials ? ['/api/jira/projects', headers] : null,
    ([url, hdrs]) => fetcher(url, hdrs),
    { revalidateOnFocus: false }
  );

  const projects: JiraProject[] = (data?.projects ?? []).filter((p: JiraProject) => p.name.startsWith('Plus'));

  function toggleProject(project: JiraProject) {
    const isSelected = settings.selectedProjectKeys.includes(project.key);
    let newKeys: string[];
    let newTeams = [...settings.teams];

    if (isSelected) {
      newKeys = settings.selectedProjectKeys.filter((k) => k !== project.key);
      newTeams = newTeams.filter((t) => t.projectKey !== project.key);
    } else {
      newKeys = [...settings.selectedProjectKeys, project.key];
      const colorIndex = newKeys.length - 1;
      if (!newTeams.find((t) => t.projectKey === project.key)) {
        newTeams.push({
          projectKey: project.key,
          projectName: project.name,
          members: [],
          color: TEAM_COLORS[colorIndex % TEAM_COLORS.length],
        });
      }
    }

    updateSettings({ selectedProjectKeys: newKeys, teams: newTeams });
  }

  if (!hasCredentials) {
    return <p className="text-sm text-gray-400">Enter Jira credentials above to load projects (or set them in .env.local).</p>;
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading projects…</p>;
  if (error) return <p className="text-sm text-red-500">Error loading projects: {error.message}</p>;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Select Projects (Teams)</h2>
      <p className="text-sm text-gray-500">Each project maps to one team.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {projects.map((project) => {
          const isSelected = settings.selectedProjectKeys.includes(project.key);
          const teamConfig = settings.teams.find((t) => t.projectKey === project.key);
          return (
            <label
              key={project.key}
              className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleProject(project)}
                className="rounded"
              />
              {teamConfig && (
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: teamConfig.color }}
                />
              )}
              <div>
                <div className="text-sm font-medium">{project.name}</div>
                <div className="text-xs text-gray-400">{project.key}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
