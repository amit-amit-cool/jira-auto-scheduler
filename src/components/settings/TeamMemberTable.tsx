'use client';
import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useSettings } from '@/hooks/useSettings';
import { buildClientHeaders } from '@/lib/jira/clientHeaders';
import { JiraUser } from '@/lib/jira/members';
import { TeamConfig, TEAM_COLORS } from '@/types/app';

const fetcher = (url: string, headers: Record<string, string>) =>
  fetch(url, { headers }).then((r) => {
    if (!r.ok) throw new Error('Failed');
    return r.json();
  });

function TeamSection({
  team,
  atlassianTeams,
  onUpdate,
}: {
  team: TeamConfig;
  atlassianTeams: Array<{ teamId: string; displayName: string }>;
  onUpdate: (t: TeamConfig) => void;
}) {
  const { settings } = useSettings();
  const headers = buildClientHeaders(settings);

  const membersUrl = team.atlassianTeamId
    ? `/api/jira/members?project=${team.projectKey}&atlassianTeamId=${encodeURIComponent(team.atlassianTeamId)}`
    : `/api/jira/members?project=${team.projectKey}&projectName=${encodeURIComponent(team.projectName)}`;

  const { data, isLoading } = useSWR(
    [membersUrl, headers],
    ([url, hdrs]) => fetcher(url, hdrs),
    { revalidateOnFocus: false }
  );

  const actors: JiraUser[] = data?.members ?? [];

  // Always keep a fresh ref to onUpdate so the effect never captures a stale closure
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; });

  useEffect(() => {
    if (actors.length === 0) return;
    const syncedMembers = actors.map((a) => {
      const existing = team.members.find((m) => m.accountId === a.accountId);
      return existing ?? { accountId: a.accountId, displayName: a.displayName, hoursPerWeek: 40 };
    });
    const currentIds = team.members.map((m) => m.accountId).sort().join(',');
    const newIds = syncedMembers.map((m) => m.accountId).sort().join(',');
    if (currentIds !== newIds) {
      onUpdateRef.current({ ...team, members: syncedMembers });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actors.length, team.projectKey, team.atlassianTeamId]);

  function updateMemberHours(accountId: string, hoursPerWeek: number) {
    const members = team.members.map((m) =>
      m.accountId === accountId ? { ...m, hoursPerWeek } : m
    );
    onUpdate({ ...team, members });
  }

  function updateAtlassianTeam(teamId: string) {
    onUpdate({ ...team, atlassianTeamId: teamId || undefined, members: [] });
  }

  function updateColor(color: string) {
    onUpdate({ ...team, color });
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3">
        <select
          value={team.color}
          onChange={(e) => updateColor(e.target.value)}
          className="text-xs border rounded px-2 py-1"
          style={{ backgroundColor: team.color, color: 'white' }}
        >
          {TEAM_COLORS.map((c) => (
            <option key={c} value={c} style={{ backgroundColor: c }}>
              {c}
            </option>
          ))}
        </select>
        <div>
          <h3 className="font-medium text-sm">{team.projectName}</h3>
          <span className="text-xs text-gray-400">{team.projectKey}</span>
        </div>
        {isLoading && <span className="text-xs text-gray-400 ml-auto">Loading…</span>}
      </div>

      {atlassianTeams.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Atlassian Team</label>
          <select
            value={team.atlassianTeamId ?? ''}
            onChange={(e) => updateAtlassianTeam(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="">— auto-match by name —</option>
            {atlassianTeams.map((t) => (
              <option key={t.teamId} value={t.teamId}>{t.displayName}</option>
            ))}
          </select>
        </div>
      )}

      {team.members.length === 0 && !isLoading && (
        <p className="text-xs text-gray-400">No members found. Select the correct Atlassian team above.</p>
      )}

      <div className="space-y-2">
        {team.members.map((member) => (
          <div key={member.accountId} className="flex items-center gap-3">
            <span className="text-sm flex-1 truncate">{member.displayName}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={80}
                value={member.hoursPerWeek}
                onChange={(e) => updateMemberHours(member.accountId, Number(e.target.value))}
                className="w-20 border rounded px-2 py-1 text-sm text-right"
              />
              <span className="text-xs text-gray-400">hrs/wk</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500 pt-1 border-t">
        Weekly capacity:{' '}
        <strong>
          {team.members.reduce((s, m) => s + m.hoursPerWeek / 8, 0).toFixed(1)} days
        </strong>
      </div>
    </div>
  );
}

export function TeamMemberTable() {
  const { settings, updateSettings } = useSettings();
  const headers = buildClientHeaders(settings);

  const { data: teamsData } = useSWR(
    ['/api/jira/atlassian-teams', headers],
    ([url, hdrs]) => fetcher(url, hdrs),
    { revalidateOnFocus: false }
  );
  const atlassianTeams: Array<{ teamId: string; displayName: string }> = teamsData?.teams ?? [];

  if (settings.selectedProjectKeys.length === 0) {
    return <p className="text-sm text-gray-400">Select projects above to configure teams.</p>;
  }

  function updateTeam(updated: TeamConfig) {
    const teams = settings.teams.map((t) =>
      t.projectKey === updated.projectKey ? updated : t
    );
    updateSettings({ teams });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Team Members & Capacity</h2>
      <p className="text-sm text-gray-500">
        Set weekly hours per member. Capacity = Σ(hours / 8) days/week.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settings.teams.filter((t) => t.projectName.startsWith('Plus')).map((team) => (
          <TeamSection key={team.projectKey} team={team} atlassianTeams={atlassianTeams} onUpdate={updateTeam} />
        ))}
      </div>
    </div>
  );
}
