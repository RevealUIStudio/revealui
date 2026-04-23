/**
 * MCP — Server Inspector (/admin/mcp/inspect?tenant=X&server=Y)
 *
 * Stage 3.2 + 3.3. Tabbed inspector for an OAuth-authorized remote MCP
 * server:
 *   - Tools (3.2)     — `inputSchema` → form → invoke → result.
 *   - Resources (3.3) — list + read-only preview pane.
 *   - Prompts (3.3)   — list + completion-aware argument form → resolve.
 *
 * Reads `?tenant=` and `?server=` from the URL; the top-level "tools" fetch
 * is always the anchor (it also returns `serverUrl` for the header).
 *
 * Elicitation / progress / log streaming lands in Stage 3.4.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PromptsPanel } from '@/lib/components/mcp/prompts-panel';
import { ResourcesPanel } from '@/lib/components/mcp/resources-panel';

type InspectorTab = 'tools' | 'resources' | 'prompts';

interface Tool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
}

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
}

interface CallToolResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
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
          <a href="/admin/mcp" className="underline">
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
          <a href="/admin/mcp" className="text-sm text-zinc-400 hover:text-zinc-200">
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
          {(['tools', 'resources', 'prompts'] as InspectorTab[]).map((t) => (
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
                <ToolCard key={tool.name} tool={tool} tenant={tenant} server={server} />
              ))}
            </div>
          </>
        )}

        {activeTab === 'resources' && <ResourcesPanel tenant={tenant} server={server} />}
        {activeTab === 'prompts' && <PromptsPanel tenant={tenant} server={server} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool card — form + invoker
// ---------------------------------------------------------------------------

interface ToolCardProps {
  tool: Tool;
  tenant: string;
  server: string;
}

function ToolCard({ tool, tenant, server }: ToolCardProps) {
  const properties = useMemo(() => tool.inputSchema?.properties ?? {}, [tool.inputSchema]);
  const required = useMemo(() => new Set(tool.inputSchema?.required ?? []), [tool.inputSchema]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CallToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseValue = (prop: JsonSchemaProperty, raw: string): unknown => {
    if (raw === '') return undefined;
    switch (prop.type) {
      case 'number':
      case 'integer': {
        const n = Number(raw);
        return Number.isFinite(n) ? n : raw;
      }
      case 'boolean':
        return raw === 'true';
      case 'object':
      case 'array':
        return JSON.parse(raw);
      default:
        return raw;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setError(null);
    try {
      const args: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(properties)) {
        const raw = values[key] ?? '';
        const parsed = parseValue(prop, raw);
        if (parsed !== undefined) args[key] = parsed;
      }
      const res = await fetch(`/api/mcp/remote-servers/${encodeURIComponent(server)}/call-tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenant, name: tool.name, arguments: args }),
      });
      // empty-catch-ok: non-JSON error body — res.status is surfaced below
      const body = (await res.json().catch(() => ({}))) as {
        result?: CallToolResult;
        error?: string;
        detail?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResult(body.result ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <details className="group rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <summary className="flex cursor-pointer items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold text-white">{tool.name}</div>
          {tool.description && (
            <div className="mt-0.5 line-clamp-1 text-xs text-zinc-400">{tool.description}</div>
          )}
        </div>
        <span className="shrink-0 text-xs text-zinc-500 group-open:hidden">Expand</span>
      </summary>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
        {Object.keys(properties).length === 0 && (
          <p className="text-xs text-zinc-500">
            This tool takes no input. Click <span className="font-medium">Invoke</span> to call it.
          </p>
        )}
        {Object.entries(properties).map(([key, prop]) => (
          <ArgumentField
            key={key}
            name={key}
            prop={prop}
            required={required.has(key)}
            value={values[key] ?? ''}
            onChange={(value) => setValues((v) => ({ ...v, [key]: value }))}
          />
        ))}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Invoking…' : 'Invoke'}
          </button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </form>

      {result && <ToolResult result={result} />}
    </details>
  );
}

// ---------------------------------------------------------------------------
// Argument field
// ---------------------------------------------------------------------------

interface ArgumentFieldProps {
  name: string;
  prop: JsonSchemaProperty;
  required: boolean;
  value: string;
  onChange: (value: string) => void;
}

function ArgumentField({ name, prop, required, value, onChange }: ArgumentFieldProps) {
  const inputId = `arg-${name}`;
  const placeholder =
    prop.default !== undefined
      ? `default: ${JSON.stringify(prop.default)}`
      : prop.type === 'object' || prop.type === 'array'
        ? 'JSON value'
        : (prop.type ?? 'string');

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-zinc-300">
        {name}
        {required && <span className="ml-1 text-red-400">*</span>}
        <span className="ml-2 font-mono text-[10px] text-zinc-500">{prop.type ?? 'string'}</span>
      </label>
      {prop.enum && prop.enum.length > 0 ? (
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">—</option>
          {prop.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      )}
      {prop.description && <p className="mt-1 text-[11px] text-zinc-500">{prop.description}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool result display
// ---------------------------------------------------------------------------

function ToolResult({ result }: { result: CallToolResult }) {
  return (
    <div
      className={`mt-4 rounded-md border p-3 text-xs ${
        result.isError
          ? 'border-red-800 bg-red-900/20 text-red-300'
          : 'border-emerald-900 bg-emerald-900/10 text-emerald-200'
      }`}
    >
      <div className="mb-2 font-medium">{result.isError ? 'Tool returned an error' : 'Result'}</div>
      <div className="space-y-2">
        {result.content.map((block, idx) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks have no id
          <pre key={idx} className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px]">
            {block.type === 'text'
              ? (block.text ?? '')
              : `[${block.type}${block.mimeType ? ` ${block.mimeType}` : ''}]`}
          </pre>
        ))}
      </div>
    </div>
  );
}
