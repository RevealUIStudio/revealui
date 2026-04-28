/**
 * MCP — Server Inspector (/admin/mcp/inspect?tenant=X&server=Y)
 *
 * Stage 3.2 + 3.3 + 3.4. Tabbed inspector for an OAuth-authorized remote
 * MCP server:
 *   - Tools (3.2+3.4)     — `inputSchema` → form → invoke → streaming
 *                           result with progress bar + cancel button +
 *                           inline elicitation form + per-call log panel.
 *   - Resources (3.3)     — list + read-only preview pane.
 *   - Prompts (3.3)       — list + completion-aware argument form → resolve.
 *   - Logs (3.4)          — live-tail `notifications/message` stream.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { LogsPanel } from '@/lib/components/mcp/logs-panel';
import { PromptsPanel } from '@/lib/components/mcp/prompts-panel';
import { ResourcesPanel } from '@/lib/components/mcp/resources-panel';
import { StreamingToolCard } from '@/lib/components/mcp/streaming-tool-card';

type InspectorTab = 'tools' | 'resources' | 'prompts' | 'logs';

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
}

interface Tool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function useSearchParam(key: string): string | null {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setValue(params.get(key));
  }, [key]);
  return value;
}

export default function InspectMcpServerPage() {
  const tenant = useSearchParam('tenant');
  const server = useSearchParam('server');

  const [activeTab, setActiveTab] = useState<InspectorTab>('tools');
  const [tools, setTools] = useState<Tool[]>([]);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const loadTools = useCallback(async () => {
    if (!(tenant && server)) return;
    setState('loading');
    setMessage(null);
    try {
      const res = await fetch(
        `/api/mcp/remote-servers/${encodeURIComponent(server)}/tools?tenant=${encodeURIComponent(tenant)}`,
        { credentials: 'include' },
      );
      // empty-catch-ok: non-JSON error body — res.status is surfaced below
      const body = (await res.json().catch(() => ({}))) as {
        tools?: Tool[];
        serverUrl?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setTools(body.tools ?? []);
      setServerUrl(body.serverUrl ?? null);
      setState('ready');
    } catch (err) {
      setState('error');
      setMessage(`Failed to load tools: ${(err as Error).message}`);
    }
  }, [tenant, server]);

  useEffect(() => {
    if (tenant && server) void loadTools();
  }, [tenant, server, loadTools]);

  if (!(tenant && server)) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-300">
          Missing <span className="font-mono">tenant</span> or{' '}
          <span className="font-mono">server</span> query parameter. Navigate from{' '}
          <a href="/mcp" className="underline">
            /admin/mcp
          </a>
          .
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <div className="flex items-center gap-3">
          <a href="/mcp" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Catalog
          </a>
          <span className="text-zinc-600">/</span>
          <h1 className="text-xl font-semibold text-white">
            <span className="font-mono text-zinc-400">{tenant}</span>{' '}
            <span className="text-zinc-600">/</span> <span className="font-mono">{server}</span>
          </h1>
        </div>
        {serverUrl && (
          <p className="mt-1 text-xs text-zinc-500">
            {serverUrl} · {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 bg-zinc-900/70">
        <nav className="mx-auto flex max-w-5xl gap-1 px-6" aria-label="Inspector surfaces">
          {(['tools', 'resources', 'prompts', 'logs'] as InspectorTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm capitalize transition-colors ${
                activeTab === t
                  ? 'border-emerald-500 text-emerald-300'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
              aria-current={activeTab === t ? 'page' : undefined}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-5xl p-6">
        {activeTab === 'tools' && (
          <>
            {message && (
              <div
                role="alert"
                className={`mb-6 rounded-lg border p-3 text-sm ${
                  state === 'error'
                    ? 'border-red-800 bg-red-900/20 text-red-300'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-300'
                }`}
              >
                {message}
              </div>
            )}

            {state === 'loading' && (
              <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
                Loading tools…
              </div>
            )}

            {state === 'ready' && tools.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
                This server doesn&rsquo;t advertise any tools, or the{' '}
                <span className="font-mono text-zinc-400">tools</span> capability isn&rsquo;t
                declared.
              </div>
            )}

            <div className="space-y-4">
              {tools.map((tool) => (
                <StreamingToolCard key={tool.name} tool={tool} tenant={tenant} server={server} />
              ))}
            </div>
          </>
        )}

        {activeTab === 'resources' && <ResourcesPanel tenant={tenant} server={server} />}
        {activeTab === 'prompts' && <PromptsPanel tenant={tenant} server={server} />}
        {activeTab === 'logs' && <LogsPanel tenant={tenant} server={server} />}
      </div>
    </div>
  );
}
