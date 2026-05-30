/**
 * Logs panel for `/mcp/inspect` (Stage 3.4).
 *
 * Opens a long-lived SSE connection to the remote MCP server's log stream
 * (`/api/mcp/remote-servers/[server]/log-stream`) and renders every
 * `notifications/message` event as it arrives. Admin can pick a level
 * (which the server filters on) and clear the buffer.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface LogEntry {
  level: string;
  data: unknown;
  logger?: string;
  at: number;
}

type Level = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

const LEVELS: Level[] = [
  'debug',
  'info',
  'notice',
  'warning',
  'error',
  'critical',
  'alert',
  'emergency',
];

interface LogsPanelProps {
  tenant: string;
  server: string;
}

export function LogsPanel({ tenant, server }: LogsPanelProps) {
  const [level, setLevel] = useState<Level>('info');
  const [state, setState] = useState<'idle' | 'connecting' | 'streaming' | 'error'>('idle');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState('idle');
  }, []);

  const start = useCallback(async () => {
    stop();
    setEntries([]);
    setMessage(null);
    setState('connecting');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `/api/mcp/remote-servers/${encodeURIComponent(server)}/log-stream?tenant=${encodeURIComponent(tenant)}&level=${level}`,
        { credentials: 'include', signal: controller.signal },
      );
      if (!(res.ok && res.body)) {
        // empty-catch-ok: non-JSON error body — surface res.status below
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
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
              const parsed = JSON.parse(dataLine) as
                | { type: 'ready'; level: Level }
                | { type: 'log'; level: string; data: unknown; logger?: string }
                | { type: 'error'; error: string; detail?: string };
              if (parsed.type === 'ready') {
                setState('streaming');
              } else if (parsed.type === 'log') {
                setEntries((existing) => {
                  const next = [
                    ...existing,
                    {
                      level: parsed.level,
                      data: parsed.data,
                      logger: parsed.logger,
                      at: Date.now(),
                    },
                  ];
                  // Cap buffer to the most recent 500 entries.
                  return next.length > 500 ? next.slice(-500) : next;
                });
              } else if (parsed.type === 'error') {
                setMessage(parsed.detail ?? parsed.error);
                setState('error');
              }
            } catch {
              // empty-catch-ok: malformed line — ignore and continue streaming
            }
          }
          idx = buffer.indexOf('\n\n');
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessage((err as Error).message);
        setState('error');
      } else {
        setState('idle');
      }
    }
  }, [tenant, server, level, stop]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <label htmlFor="log-level" className="text-xs font-medium text-muted-foreground">
          Level
        </label>
        <select
          id="log-level"
          value={level}
          onChange={(e) => setLevel(e.target.value as Level)}
          disabled={state === 'streaming' || state === 'connecting'}
          className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        {state === 'streaming' || state === 'connecting' ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            className="rounded-md bg-success px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-success/90"
          >
            Start
          </button>
        )}
        <button
          type="button"
          onClick={() => setEntries([])}
          disabled={entries.length === 0}
          className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear
        </button>
        <div className="ml-auto text-xs text-muted-foreground">
          {state === 'streaming' && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> streaming
            </span>
          )}
          {state === 'connecting' && <span>connecting…</span>}
          {state === 'error' && <span className="text-error">error</span>}
          {state === 'idle' && <span>idle</span>}
          <span className="ml-3">{entries.length} entries</span>
        </div>
      </div>

      {message && (
        <div
          role="alert"
          className="rounded-lg border border-error/30 bg-error/10 p-3 text-xs text-error"
        >
          {message}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
          No log messages yet. Click <span className="font-medium text-foreground">Start</span> to
          subscribe.
        </div>
      ) : (
        <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto rounded-lg border border-border bg-muted p-3 font-mono text-[11px]">
          {entries.map((entry) => (
            <li key={entry.at} className="text-foreground">
              <span className="mr-2 text-muted-foreground">
                [{new Date(entry.at).toISOString().slice(11, 19)}]
              </span>
              <span className={levelColor(entry.level)}>{entry.level}</span>
              {entry.logger && <span className="ml-1 text-muted-foreground">({entry.logger})</span>}{' '}
              {typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function levelColor(level: string): string {
  switch (level) {
    case 'error':
    case 'critical':
    case 'alert':
    case 'emergency':
      return 'text-error';
    case 'warning':
      return 'text-warning-foreground';
    case 'notice':
    case 'info':
      return 'text-success';
    default:
      return 'text-muted-foreground';
  }
}
