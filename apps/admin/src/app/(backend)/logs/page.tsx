'use client';

import Link from 'next/link';
import { useEffect, useReducer } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

interface AppLogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  app: string;
  environment: string;
  requestId: string | null;
  userId: string | null;
  data: unknown;
}

interface PaginatedResponse {
  success: boolean;
  data: AppLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

interface State {
  rows: AppLogEntry[];
  total: number;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; rows: AppLogEntry[]; total: number }
  | { type: 'FETCH_ERROR'; error: string };

const initialState: State = {
  rows: [],
  total: 0,
  loading: true,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, rows: action.rows, total: action.total };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
  }
}

// =============================================================================
// Constants
// =============================================================================

const LEVEL_STYLES: Record<string, string> = {
  fatal: 'bg-error/15 text-error',
  error: 'bg-error/15 text-error',
  warn: 'bg-warning/15 text-warning-foreground',
};

const APPS = ['admin', 'api', 'marketing'] as const;
const LEVELS = ['warn', 'error', 'fatal'] as const;

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(date);
}

// =============================================================================
// Page
// =============================================================================

export default function LogsPage() {
  return (
    <LicenseGate feature="dashboard">
      <LogsDashboard />
    </LicenseGate>
  );
}

function LogsDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { rows, total, loading, error } = state;

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  // Read filter state from the URL search params
  const searchParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const filterApp = APPS.includes(searchParams.get('app') as (typeof APPS)[number])
    ? searchParams.get('app')
    : undefined;
  const filterLevel = LEVELS.includes(searchParams.get('level') as (typeof LEVELS)[number])
    ? searchParams.get('level')
    : undefined;
  const limit = Math.min(Number(searchParams.get('limit')) || 200, 1000);

  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      dispatch({ type: 'FETCH_START' });
      try {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        params.set('offset', '0');
        if (filterApp) params.set('app', filterApp);
        if (filterLevel) params.set('level', filterLevel);

        const res = await fetch(`${apiUrl}/api/admin/logs?${params.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Failed to load logs (${res.status})`);
        }
        const data = (await res.json()) as PaginatedResponse;
        if (!cancelled) {
          dispatch({ type: 'FETCH_SUCCESS', rows: data.data, total: data.total });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          dispatch({
            type: 'FETCH_ERROR',
            error: e instanceof Error ? e.message : 'Unable to load logs.',
          });
        }
      }
    }

    void fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, filterApp, filterLevel, limit]);

  function filterUrl(overrides: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    const next = { app: filterApp, level: filterLevel, ...overrides };
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return `/logs${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 border-b border-border bg-card p-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Application Logs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Structured warn/error/fatal logs from all apps
          </p>
        </div>

        {/* App filter */}
        <div className="ml-auto flex items-center gap-1 text-sm">
          <Link
            href={filterUrl({ app: undefined })}
            className={`rounded px-2 py-1 ${!filterApp ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            All apps
          </Link>
          {APPS.map((a) => (
            <Link
              key={a}
              href={filterUrl({ app: a })}
              className={`rounded px-2 py-1 font-mono ${filterApp === a ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {a}
            </Link>
          ))}
        </div>

        {/* Level filter */}
        <div className="flex items-center gap-1 text-sm">
          <Link
            href={filterUrl({ level: undefined })}
            className={`rounded px-2 py-1 ${!filterLevel ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            All levels
          </Link>
          {LEVELS.map((l) => (
            <Link
              key={l}
              href={filterUrl({ level: l })}
              className={`rounded px-2 py-1 text-xs font-semibold uppercase ${filterLevel === l ? (LEVEL_STYLES[l] ?? '') : 'text-muted-foreground hover:text-foreground'}`}
            >
              {l}
            </Link>
          ))}
        </div>
      </div>

      {loading && <div className="m-4 p-8 text-center text-muted-foreground">Loading logs...</div>}

      {error && (
        <div
          role="alert"
          className="m-4 rounded border border-error/30 bg-error/10 p-3 text-sm text-error"
        >
          Failed to load logs: {error}
        </div>
      )}

      {!(loading || error) && rows.length === 0 && (
        <div className="m-4 p-8 text-center text-muted-foreground">
          No log entries recorded yet.
          {filterApp || filterLevel ? (
            <span>
              {' '}
              <Link href="/logs" className="text-primary hover:underline">
                Clear filters
              </Link>
            </span>
          ) : (
            ' Warn+ logs will appear here once the apps ship entries in production.'
          )}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
            Showing {rows.length} of {total} entries
            {filterApp ? ` · app: ${filterApp}` : ''}
            {filterLevel ? ` · level: ${filterLevel}` : ''}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-card text-left text-muted-foreground">
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Level</th>
                  <th className="px-4 py-2 font-medium">App</th>
                  <th className="px-4 py-2 font-medium">Req ID</th>
                  <th className="w-1/2 px-4 py-2 font-medium">Message / Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-muted">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                      {formatTime(new Date(row.timestamp))}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded px-2 py-0.5 font-mono text-xs font-semibold uppercase ${LEVEL_STYLES[row.level] ?? 'bg-muted text-muted-foreground'}`}
                      >
                        {row.level}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                      {row.app}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {row.requestId ? row.requestId.slice(0, 8) : ' - '}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      <div className="truncate" title={row.message}>
                        {row.message}
                      </div>
                      {!!row.data && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            Context / data
                          </summary>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-card p-2 text-xs text-muted-foreground">
                            {JSON.stringify(row.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
