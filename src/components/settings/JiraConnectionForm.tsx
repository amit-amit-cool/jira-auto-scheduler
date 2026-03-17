'use client';
import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';

export function JiraConnectionForm() {
  const { settings, updateSettings } = useSettings();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [serverConfig, setServerConfig] = useState<{ configured: boolean; baseUrl: string | null; email: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/jira/server-config')
      .then((r) => r.json())
      .then(setServerConfig)
      .catch(() => setServerConfig({ configured: false, baseUrl: null, email: null }));
  }, []);

  const usingServer = serverConfig?.configured && !settings.jiraBaseUrl && !settings.jiraToken;

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/jira/fields', {
        headers: {
          'X-Jira-Url': settings.jiraBaseUrl ?? '',
          'X-Jira-Email': settings.jiraEmail ?? '',
          'X-Jira-Token': settings.jiraToken ?? '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(`Connected! Found ${data.fields?.length ?? 0} fields.${data.storyPointsFieldId ? ' Story points: ' + data.storyPointsFieldId : ' ⚠ Story points field not found.'}${data.timeSpentFieldId ? ' Time spent: ' + data.timeSpentFieldId : ' ⚠ Time spent field not found.'}`);
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

      {usingServer ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded space-y-1">
          <p className="text-sm font-medium text-green-800">Using server-configured credentials</p>
          <p className="text-xs text-green-700">{serverConfig!.baseUrl} &mdash; {serverConfig!.email}</p>
          <p className="text-xs text-gray-500 mt-2">
            To override, enter credentials below. Leave blank to use server defaults.
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Credentials are stored in your browser and sent to our proxy API routes. They are never exposed client-side.
        </p>
      )}

      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Jira Base URL</label>
          <input
            type="url"
            value={settings.jiraBaseUrl}
            onChange={(e) => updateSettings({ jiraBaseUrl: e.target.value })}
            placeholder={usingServer ? serverConfig!.baseUrl! : 'https://yourcompany.atlassian.net'}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={settings.jiraEmail}
            onChange={(e) => updateSettings({ jiraEmail: e.target.value })}
            placeholder={usingServer ? serverConfig!.email! : 'you@company.com'}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">API Token</label>
          <input
            type="password"
            value={settings.jiraToken}
            onChange={(e) => updateSettings({ jiraToken: e.target.value })}
            placeholder={usingServer ? '(using server token)' : 'Your Jira API token'}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {!usingServer && (
            <p className="text-xs text-gray-400 mt-1">
              Generate at id.atlassian.com → Security → API tokens
            </p>
          )}
        </div>
      </div>

      <button
        onClick={testConnection}
        disabled={testing || (!usingServer && (!settings.jiraBaseUrl || !settings.jiraEmail || !settings.jiraToken))}
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
