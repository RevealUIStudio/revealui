'use client';

import Link from 'next/link';
import { useEffect, useReducer } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

interface AuditEntry {
  id: string;
  timestamp: string;
  severity: string;
  eventType: string;
  agentId: string;
  payload: Record<string, unknown> | null;
  policyViolations: string[];
}

interface PaginatedResponse {
  success: boolean;
  data: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

interface State {
  rows: AuditEntry[];
  total: number;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; rows: AuditEntry[]; total: number }
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

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-error/15 text-error',
  warn: 'bg-warning/15 text-warning-foreground',
  info: 'bg-muted text-muted-foreground',
};

const SEVERITIES = ['info', 'warn', 'critical'] as const;

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

export default function AuditPage() {
  return (
    <LicenseGate feature="dashboard">
      <AuditDashboard />
    </LicenseGate>
  );
}

function AuditDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { rows, total, loading, error } = state;

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  const searchParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const filterSeverity = SEVERITIES.includes(
    searchParams.get('severity') as (typeof SEVERITIES)[number],
  )
    ? searchParams.get('severity')
    : undefined;
  const filterAgent = searchParams.get('agent') || undefined;
  // Must stay within PaginationQuery max (100) on /api/admin/audit — higher
  // values produce a validation error and a blank trail UI.
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 100);

  useEffect(() => {
    let cancelled = false;

    function formatApiError(body: unknown, status: number): string {
      if (body && typeof body === 'object') {
        const err = (body as { error?: unknown }).error;
        if (typeof err === 'string' && err.trim()) return err;
        if (err && typeof err === 'object') {
          try {
            return JSON.stringify(err);
          } catch {
            // fall through
          }
        }
        const code = (body as { code?: unknown }).code;
        if (typeof code === 'string' && code.trim()) {
          return `Request failed (${status}, ${code})`;
        }
      }
      return `Failed to load audit log (${status})`;
    }

    async function fetchAudit() {
      dispatch({ type: 'FETCH_START' });
      try {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        params.set('offset', '0');
        if (filterSeverity) params.set('severity', filterSeverity);
        if (filterAgent) params.set('agentId', filterAgent);

        const res = await fetch(`${apiUrl}/api/admin/audit?${params.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body: unknown = await res.json().catch(() => null);
          throw new Error(formatApiError(body, res.status));
        }
        const data = (await res.json()) as PaginatedResponse;
        if (!cancelled) {
          dispatch({ type: 'FETCH_SUCCESS', rows: data.data, total: data.total });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          dispatch({
            type: 'FETCH_ERROR',
            error: e instanceof Error ? e.message : 'Unable to load audit log.',
          });
        }
      }
    }

    void fetchAudit();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, filterSeverity, filterAgent, limit]);

  function filterUrl(overrides: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    const next = { severity: filterSeverity, agent: filterAgent, ...overrides };
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return `/audit${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 border-b border-border bg-card p-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Audit Trail</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            AI agent activity and security audit events
          </p>
        </div>

        {/* Severity filter */}
        <div className="ml-auto flex items-center gap-1 text-sm">
          <Link
            href={filterUrl({ severity: undefined })}
            className={`rounded px-2 py-1 ${!filterSeverity ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            All
          </Link>
          {SEVERITIES.map((s) => (
            <Link
              key={s}
              href={filterUrl({ severity: s })}
              className={`rounded px-2 py-1 text-xs font-semibold uppercase ${filterSeverity === s ? (SEVERITY_STYLES[s] ?? '') : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {loading && (
        <div className="m-4 p-8 text-center text-muted-foreground">Loading audit log...</div>
      )}

      {error && (
        <div
          role="alert"
          className="m-4 rounded border border-error/30 bg-error/10 p-3 text-sm text-error"
        >
          Failed to load audit log: {error}
        </div>
      )}

      {!(loading || error) && rows.length === 0 && (
        <div className="m-4 p-8 text-center text-muted-foreground">
          No audit entries recorded yet.
          {filterSeverity || filterAgent ? (
            <span>
              {' '}
              <Link href="/audit" className="text-primary hover:underline">
                Clear filters
              </Link>
            </span>
          ) : (
            ' Audit entries will appear here as agents perform actions.'
          )}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
            Showing {rows.length} of {total} entries
            {filterSeverity ? ` · severity: ${filterSeverity}` : ''}
            {filterAgent ? ` · agent: ${filterAgent}` : ''}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-card text-left text-muted-foreground">
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Severity</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Agent</th>
                  <th className="w-1/3 px-4 py-2 font-medium">Payload</th>
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
                        className={`inline-block rounded px-2 py-0.5 font-mono text-xs font-semibold uppercase ${SEVERITY_STYLES[row.severity] ?? 'bg-muted text-muted-foreground'}`}
                      >
                        {row.severity}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                      {row.eventType}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                      <Link href={filterUrl({ agent: row.agentId })} className="hover:text-primary">
                        {row.agentId}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {row.payload &&
                      typeof row.payload === 'object' &&
                      Object.keys(row.payload).length > 0 ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            Payload
                          </summary>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-card p-2 text-xs text-muted-foreground">
                            {JSON.stringify(row.payload, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                      {row.policyViolations.length > 0 && (
                        <div className="mt-1 text-xs text-error">
                          Violations: {row.policyViolations.join(', ')}
                        </div>
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
