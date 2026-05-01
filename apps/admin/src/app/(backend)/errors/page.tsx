'use client';

import { useEffect, useReducer } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

interface ErrorEventEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  stack: string | null;
  app: string;
  context: string | null;
  environment: string;
  url: string | null;
  userId: string | null;
  requestId: string | null;
  metadata: unknown;
}

interface PaginatedResponse {
  success: boolean;
  data: ErrorEventEntry[];
  total: number;
  limit: number;
  offset: number;
}

interface State {
  rows: ErrorEventEntry[];
  total: number;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; rows: ErrorEventEntry[]; total: number }
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
  fatal: 'bg-red-900 text-red-200',
  error: 'bg-red-700 text-red-100',
  warn: 'bg-yellow-700 text-yellow-100',
};

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

export default function ErrorsPage() {
  return (
    <LicenseGate feature="dashboard">
      <ErrorsDashboard />
    </LicenseGate>
  );
}

function ErrorsDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { rows, total, loading, error } = state;

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    let cancelled = false;

    async function fetchErrors() {
      dispatch({ type: 'FETCH_START' });
      try {
        const params = new URLSearchParams();
        params.set('limit', '100');
        params.set('offset', '0');

        const res = await fetch(`${apiUrl}/api/admin/errors?${params.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Failed to load errors (${res.status})`);
        }
        const data = (await res.json()) as PaginatedResponse;
        if (!cancelled) {
          dispatch({ type: 'FETCH_SUCCESS', rows: data.data, total: data.total });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          dispatch({
            type: 'FETCH_ERROR',
            error: e instanceof Error ? e.message : 'Unable to load error events.',
          });
        }
      }
    }

    void fetchErrors();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-700 bg-gray-900 p-4">
        <h1 className="text-xl font-semibold text-white">Error Events</h1>
        <p className="mt-1 text-sm text-gray-400">Last 100 captured errors across all apps</p>
      </div>

      {loading && <div className="m-4 p-8 text-center text-gray-500">Loading error events...</div>}

      {error && (
        <div
          role="alert"
          className="m-4 rounded border border-red-700 bg-red-900 p-3 text-sm text-red-200"
        >
          Failed to load error events: {error}
        </div>
      )}

      {!(loading || error) && rows.length === 0 && (
        <div className="m-4 p-8 text-center text-gray-500">
          No errors recorded yet. This is a good sign.
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="border-b border-gray-800 px-4 py-2 text-xs text-gray-500">
            Showing {rows.length} of {total} events
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-left text-gray-400">
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Level</th>
                  <th className="px-4 py-2 font-medium">App</th>
                  <th className="px-4 py-2 font-medium">Context</th>
                  <th className="w-1/2 px-4 py-2 font-medium">Message</th>
                  <th className="px-4 py-2 font-medium">URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-gray-900">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-400">
                      {formatTime(new Date(row.timestamp))}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded px-2 py-0.5 font-mono text-xs font-semibold uppercase ${LEVEL_STYLES[row.level] ?? 'bg-gray-700 text-gray-200'}`}
                      >
                        {row.level}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-300">{row.app}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{row.context ?? ' - '}</td>
                    <td className="px-4 py-2 text-gray-200">
                      <div className="truncate" title={row.message}>
                        {row.message}
                      </div>
                      {row.stack && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-gray-500">
                            Stack trace
                          </summary>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-xs text-gray-400">
                            {row.stack}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {row.url ? (
                        <span className="block truncate" title={row.url}>
                          {row.url}
                        </span>
                      ) : (
                        ' - '
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
