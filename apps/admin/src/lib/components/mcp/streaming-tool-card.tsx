/**
 * Streaming tool invoker card (Stage 3.4).
 *
 * Replaces the Stage 3.2 request/response `ToolCard` with an SSE-driven
 * invoker that surfaces:
 *
 *   - Progress bar, fed by `notifications/progress` from the server.
 *   - Cancel button, which aborts the fetch → the SDK transport emits
 *     `notifications/cancelled` on the wire.
 *   - Inline elicitation form, rendered from the server's
 *     `requestedSchema`. Response goes back via
 *     `/api/mcp/remote-servers/<server>/elicitation-respond`.
 *   - Live per-call log panel (protocol-level `notifications/message`).
 *   - Final `CallToolResult` on success; structured error on failure.
 *
 * Tool calls that don't emit progress or elicitation still work — those
 * event types simply never arrive and the UI shows only the final result.
 */

'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface LogEntry {
  level: string;
  data: unknown;
  logger?: string;
  at: number;
}

interface ElicitationRequest {
  id: string;
  message: string;
  requestedSchema: {
    type?: string;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
}

type SseEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'log'; level: string; data: unknown; logger?: string }
  | { type: 'progress'; progress: number; total?: number; message?: string }
  | { type: 'elicitation'; id: string; message: string; requestedSchema: unknown }
  | { type: 'result'; result: CallToolResult }
  | { type: 'error'; error: string; detail?: string };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StreamingToolCardProps {
  tool: Tool;
  tenant: string;
  server: string;
}

export function StreamingToolCard({ tool, tenant, server }: StreamingToolCardProps) {
  const properties = useMemo(() => tool.inputSchema?.properties ?? {}, [tool.inputSchema]);
  const required = useMemo(() => new Set(tool.inputSchema?.required ?? []), [tool.inputSchema]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [invoking, setInvoking] = useState(false);
  const [progress, setProgress] = useState<{
    progress: number;
    total?: number;
    message?: string;
  } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pendingElicitation, setPendingElicitation] = useState<ElicitationRequest | null>(null);
  const [result, setResult] = useState<CallToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const resetState = () => {
    setProgress(null);
    setLogs([]);
    setPendingElicitation(null);
    setResult(null);
    setError(null);
    sessionIdRef.current = null;
  };

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const consumeStream = async (body: ReadableStream<Uint8Array>): Promise<void> => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n\n');
      while (idx !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = rawEvent
          .split('\n')
          .find((l) => l.startsWith('data:'))
          ?.slice(5)
          .trim();
        if (dataLine) {
          try {
            const parsed = JSON.parse(dataLine) as SseEvent;
            applyEvent(parsed);
          } catch {
            // empty-catch-ok: malformed line — ignore and continue streaming
          }
        }
        idx = buffer.indexOf('\n\n');
      }
    }
  };

  const applyEvent = (event: SseEvent): void => {
    switch (event.type) {
      case 'session':
        sessionIdRef.current = event.sessionId;
        break;
      case 'log':
        setLogs((existing) => [
          ...existing,
          {
            level: event.level,
            data: event.data,
            logger: event.logger,
            at: Date.now(),
          },
        ]);
        break;
      case 'progress':
        setProgress({
          progress: event.progress,
          total: event.total,
          message: event.message,
        });
        break;
      case 'elicitation':
        setPendingElicitation({
          id: event.id,
          message: event.message,
          requestedSchema: (event.requestedSchema ?? {}) as ElicitationRequest['requestedSchema'],
        });
        break;
      case 'result':
        setResult(event.result);
        break;
      case 'error':
        setError(event.detail ? `${event.error}: ${event.detail}` : event.error);
        break;
    }
  };

  const submitElicitation = async (
    action: 'accept' | 'decline' | 'cancel',
    content?: Record<string, unknown>,
  ): Promise<void> => {
    const elicitation = pendingElicitation;
    const sessionId = sessionIdRef.current;
    if (!(elicitation && sessionId)) return;
    setPendingElicitation(null);
    await fetch(`/api/mcp/remote-servers/${encodeURIComponent(server)}/elicitation-respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        sessionId,
        elicitationId: elicitation.id,
        action,
        ...(action === 'accept' && content ? { content } : {}),
      }),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    setInvoking(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const args: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(properties)) {
        const raw = values[key] ?? '';
        const parsed = parseValue(prop, raw);
        if (parsed !== undefined) args[key] = parsed;
      }
      const res = await fetch(
        `/api/mcp/remote-servers/${encodeURIComponent(server)}/call-tool-stream`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({ tenant, name: tool.name, arguments: args }),
        },
      );
      if (!(res.ok && res.body)) {
        // empty-catch-ok: non-JSON error body — surface res.status below
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
      }
      await consumeStream(res.body);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setError('cancelled');
      } else {
        setError((err as Error).message);
      }
    } finally {
      setInvoking(false);
      abortRef.current = null;
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
            disabled={invoking}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {invoking ? 'Invoking…' : 'Invoke'}
          </button>
          {invoking && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {progress && <ProgressDisplay progress={progress} />}
      {pendingElicitation && (
        <ElicitationForm elicitation={pendingElicitation} onSubmit={submitElicitation} />
      )}
      {logs.length > 0 && <LogPanel logs={logs} />}
      {result && <ToolResult result={result} />}
      {error && (
        <div className="mt-4 rounded-md border border-red-800 bg-red-900/20 p-3 text-xs text-red-300">
          {error}
        </div>
      )}
    </details>
  );
}

// ---------------------------------------------------------------------------
// Argument field (mirrors the Stage 3.2 version)
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
// Progress bar
// ---------------------------------------------------------------------------

function ProgressDisplay({
  progress,
}: {
  progress: { progress: number; total?: number; message?: string };
}) {
  const pct =
    progress.total && progress.total > 0
      ? Math.min(100, Math.round((progress.progress / progress.total) * 100))
      : undefined;
  return (
    <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="mb-1.5 flex items-center justify-between text-[10px] text-zinc-400">
        <span>{progress.message ?? 'Progress'}</span>
        <span className="font-mono">
          {pct !== undefined
            ? `${pct}%`
            : `${progress.progress}${progress.total !== undefined ? ` / ${progress.total}` : ''}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-emerald-500 transition-all duration-200"
          style={
            pct !== undefined ? { width: `${pct}%` } : { width: '33%', opacity: 0.6 } // indeterminate fallback
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Elicitation form — renders the server's requestedSchema inline
// ---------------------------------------------------------------------------

interface ElicitationFormProps {
  elicitation: ElicitationRequest;
  onSubmit: (
    action: 'accept' | 'decline' | 'cancel',
    content?: Record<string, unknown>,
  ) => Promise<void>;
}

function ElicitationForm({ elicitation, onSubmit }: ElicitationFormProps) {
  const schema = elicitation.requestedSchema ?? {};
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const [values, setValues] = useState<Record<string, string>>({});

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
      default:
        return raw;
    }
  };

  const handleAccept = (e: React.FormEvent) => {
    e.preventDefault();
    const content: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(properties)) {
      const raw = values[key] ?? '';
      const parsed = parseValue(prop, raw);
      if (parsed !== undefined) content[key] = parsed;
    }
    void onSubmit('accept', content);
  };

  return (
    <form
      onSubmit={handleAccept}
      className="mt-4 rounded-md border border-blue-800 bg-blue-900/10 p-3"
    >
      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 font-medium text-blue-300">
          Server request
        </span>
        <span className="text-blue-200">{elicitation.message}</span>
      </div>
      <div className="space-y-3">
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
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => void onSubmit('decline')}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => void onSubmit('cancel')}
          className="rounded-md border border-red-800 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/40"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Log panel (per-call, collapsible)
// ---------------------------------------------------------------------------

function LogPanel({ logs }: { logs: LogEntry[] }) {
  return (
    <details className="mt-4 rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
      <summary className="cursor-pointer text-xs text-zinc-400">
        Logs <span className="text-zinc-500">({logs.length})</span>
      </summary>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto font-mono text-[11px]">
        {logs.map((entry) => (
          <li key={entry.at} className="text-zinc-200">
            <span className="mr-2 text-zinc-500">
              [{new Date(entry.at).toISOString().slice(11, 19)}]
            </span>
            <span className={levelColor(entry.level)}>{entry.level}</span>
            {entry.logger && <span className="ml-1 text-zinc-500">({entry.logger})</span>}{' '}
            {typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data)}
          </li>
        ))}
      </ul>
    </details>
  );
}

function levelColor(level: string): string {
  switch (level) {
    case 'error':
    case 'critical':
    case 'alert':
    case 'emergency':
      return 'text-red-400';
    case 'warning':
      return 'text-yellow-400';
    case 'notice':
    case 'info':
      return 'text-emerald-400';
    default:
      return 'text-zinc-400';
  }
}

// ---------------------------------------------------------------------------
// Result display (mirrors Stage 3.2)
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
