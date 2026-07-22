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

import { Button } from '@revealui/presentation';
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
        <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
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
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <a href="/mcp" className="text-sm text-muted-foreground hover:text-foreground">
            ← Catalog
          </a>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-semibold text-foreground">
            <span className="font-mono text-muted-foreground">{tenant}</span>{' '}
            <span className="text-muted-foreground">/</span>{' '}
            <span className="font-mono">{server}</span>
          </h1>
        </div>
        {serverUrl && (
          <p className="mt-1 text-xs text-muted-foreground">
            {serverUrl} · {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <nav className="mx-auto flex max-w-5xl gap-1 px-6" aria-label="Inspector surfaces">
          {(['tools', 'resources', 'prompts', 'logs'] as InspectorTab[]).map((t) => (
            <Button
              key={t}
              type="button"
              appearance="ghost"
              variant={activeTab === t ? 'brand' : 'neutral'}
              size="sm"
              onClick={() => setActiveTab(t)}
              className={`-mb-px h-auto rounded-none border-b-2 px-3 py-2 text-sm capitalize ${
                activeTab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              aria-current={activeTab === t ? 'page' : undefined}
            >
              {t}
            </Button>
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
                    ? 'border-error/30 bg-error/10 text-error'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                {message}
              </div>
            )}

            {state === 'loading' && (
              <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Loading tools…
              </div>
            )}

            {state === 'ready' && tools.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                This server doesn&rsquo;t advertise any tools, or the{' '}
                <span className="font-mono text-muted-foreground">tools</span> capability
                isn&rsquo;t declared.
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
