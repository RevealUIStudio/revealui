'use client';

import Link from 'next/link';
import { useEffect, useReducer } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';
import { getApiUrl } from '@/lib/config/api';

// =============================================================================
// Types
// =============================================================================

interface WebhookEvent {
  id: string;
  eventType: string;
  processedAt: string;
}

interface PaginatedResponse {
  success: boolean;
  data: WebhookEvent[];
  total: number;
  limit: number;
  offset: number;
}

interface State {
  rows: WebhookEvent[];
  total: number;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; rows: WebhookEvent[]; total: number }
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
// Helpers
// =============================================================================

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

export default function WebhooksPage() {
  return (
    <LicenseGate feature="dashboard">
      <WebhooksDashboard />
    </LicenseGate>
  );
}

function WebhooksDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { rows, total, loading, error } = state;

  const apiUrl = getApiUrl();

  const searchParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const filterType = searchParams.get('type') || undefined;
  const limit = Math.min(Number(searchParams.get('limit')) || 200, 1000);

  useEffect(() => {
    let cancelled = false;

    async function fetchWebhooks() {
      dispatch({ type: 'FETCH_START' });
      try {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        params.set('offset', '0');
        if (filterType) params.set('eventType', filterType);

        const res = await fetch(`${apiUrl}/api/admin/webhooks?${params.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Failed to load webhook events (${res.status})`);
        }
        const data = (await res.json()) as PaginatedResponse;
        if (!cancelled) {
          dispatch({ type: 'FETCH_SUCCESS', rows: data.data, total: data.total });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          dispatch({
            type: 'FETCH_ERROR',
            error: e instanceof Error ? e.message : 'Unable to load webhook events.',
          });
        }
      }
    }

    void fetchWebhooks();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, filterType, limit]);

  // Extract unique event types from loaded data for filter buttons
  const eventTypes = [...new Set(rows.map((r) => r.eventType))].sort();

  function filterUrl(overrides: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    const next = { type: filterType, ...overrides };
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return `/admin/webhooks${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 border-b border-gray-700 bg-gray-900 p-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Webhook Events</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            Processed Stripe webhook events — deduplication log
          </p>
        </div>

        {/* Type filter */}
        {eventTypes.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-1 text-sm">
            <Link
              href={filterUrl({ type: undefined })}
              className={`rounded px-2 py-1 ${!filterType ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              All types
            </Link>
            {eventTypes.slice(0, 8).map((t) => (
              <Link
                key={t}
                href={filterUrl({ type: t })}
                className={`rounded px-2 py-1 font-mono text-xs ${filterType === t ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {t}
              </Link>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="m-4 p-8 text-center text-gray-500">Loading webhook events...</div>
      )}

      {error && (
        <div
          role="alert"
          className="m-4 rounded border border-red-700 bg-red-900 p-3 text-sm text-red-200"
        >
          Failed to load webhook events: {error}
        </div>
      )}

      {!(loading || error) && rows.length === 0 && (
        <div className="m-4 p-8 text-center text-gray-500">
          No webhook events processed yet.
          {filterType ? (
            <span>
              {' '}
              <Link href="/admin/webhooks" className="text-blue-400 hover:underline">
                Clear filter
              </Link>
            </span>
          ) : (
            ' Events will appear here as Stripe webhooks are received and processed.'
          )}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="border-b border-gray-800 px-4 py-2 text-xs text-gray-500">
            Showing {rows.length} of {total} events
            {filterType ? ` · type: ${filterType}` : ''}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-left text-gray-400">
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Processed At</th>
                  <th className="px-4 py-2 font-medium">Event Type</th>
                  <th className="px-4 py-2 font-medium">Event ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-gray-900">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-400">
                      {formatTime(new Date(row.processedAt))}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={filterUrl({ type: row.eventType })}
                        className="font-mono text-xs text-gray-300 hover:text-blue-400"
                      >
                        {row.eventType}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{row.id}</td>
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
