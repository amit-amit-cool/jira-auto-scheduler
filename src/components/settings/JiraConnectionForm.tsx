'use client';
import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useServerConfig } from '@/hooks/useServerConfig';
import { buildClientHeaders } from '@/lib/jira/clientHeaders';
import { mutate as swrMutate } from 'swr';

export function JiraConnectionForm() {
  const { settings, updateSettings } = useSettings();
  const serverConfig = useServerConfig();
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  const hasToken = !!settings.jiraToken;

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/jira/fields', {
        headers: buildClientHeaders(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(`Connected! Found ${data.fields?.length ?? 0} fields.`);
      } else {
        const err = await res.json();
        setTestResult(`Error: ${err.error}`);
      }
    } catch (e) {
      setTestResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  }

  async function importIssues() {
    setImporting(true);
    setImportResult(null);
    try {
      const projects = settings.selectedProjectKeys;
      if (!projects.length) {
        setImportResult('Error: No projects selected. Select projects first.');
        return;
      }

      const params = new URLSearchParams({ projects: projects.join(',') });
      const res = await fetch(`/api/jira/epics?${params}`, {
        headers: buildClientHeaders(settings),
      });

      if (!res.ok) {
        const err = await res.json();
        setImportResult(`Error: ${err.error}`);
        return;
      }

      const data = await res.json();

      // Save to server snapshot so all users can access it
      await fetch('/api/epics/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      // Revalidate SWR caches
      swrMutate('/api/epics/snapshot');

      setImportResult(`Imported ${data.total} issues across ${projects.length} project${projects.length !== 1 ? 's' : ''}. All users can now schedule.`);
    } catch (e) {
      setImportResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Jira Connection</h2>

      {(serverConfig.baseUrl || serverConfig.email) && (
        <div className="p-3 bg-gray-50 border rounded text-sm text-gray-600 space-y-0.5">
          {serverConfig.baseUrl && <div><span className="font-medium">URL:</span> {serverConfig.baseUrl}</div>}
          {serverConfig.email && <div><span className="font-medium">Email:</span> {serverConfig.email}</div>}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">API Token</label>
        <input
          type="password"
          value={settings.jiraToken ?? ''}
          onChange={(e) => updateSettings({ jiraToken: e.target.value })}
          placeholder="Your Jira API token"
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Generate at id.atlassian.com → Security → API tokens
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={testConnection}
          disabled={testing || importing || !hasToken}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </button>

        {hasToken && (
          <button
            onClick={importIssues}
            disabled={importing || testing}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing…' : '⬇ Import Issues'}
          </button>
        )}
      </div>

      {testResult && (
        <p className={`text-sm p-3 rounded ${testResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {testResult}
        </p>
      )}

      {importResult && (
        <p className={`text-sm p-3 rounded ${importResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {importResult}
        </p>
      )}
    </div>
  );
}
