'use client';
import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';

const JIRA_BASE_URL = process.env.NEXT_PUBLIC_JIRA_BASE_URL ?? '';
const JIRA_EMAIL = process.env.NEXT_PUBLIC_JIRA_EMAIL ?? '';

export function JiraConnectionForm() {
  const { settings, updateSettings } = useSettings();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/jira/fields', {
        headers: {
          'X-Jira-Url': JIRA_BASE_URL,
          'X-Jira-Email': JIRA_EMAIL,
          'X-Jira-Token': settings.jiraToken ?? '',
        },
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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Jira Connection</h2>

      <div className="p-3 bg-gray-50 border rounded text-sm text-gray-600 space-y-0.5">
        <div><span className="font-medium">URL:</span> {JIRA_BASE_URL}</div>
        <div><span className="font-medium">Email:</span> {JIRA_EMAIL}</div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">API Token</label>
        <input
          type="password"
          value={settings.jiraToken}
          onChange={(e) => updateSettings({ jiraToken: e.target.value })}
          placeholder="Your Jira API token"
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Generate at id.atlassian.com → Security → API tokens
        </p>
      </div>

      <button
        onClick={testConnection}
        disabled={testing || !settings.jiraToken}
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {testing ? 'Testing…' : 'Test Connection'}
      </button>

      {testResult && (
        <p className={`text-sm p-3 rounded ${testResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {testResult}
        </p>
      )}
    </div>
  );
}
