'use client';

import { useEffect, useReducer } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';
import { getApiUrl } from '@/lib/config/api';

// =============================================================================
// Types
// =============================================================================

interface TierBreakdown {
  pro: number;
  max: number;
  enterprise: number;
}

interface RecentEvent {
  type: string;
  tier: string;
  createdAt: string;
}

interface RevenueMetrics {
  activeSubscriptions: number;
  totalCustomers: number;
  mrr: number;
  tierBreakdown: TierBreakdown;
  recentEvents: RecentEvent[];
}

interface State {
  metrics: RevenueMetrics | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; metrics: RevenueMetrics }
  | { type: 'FETCH_ERROR'; error: string };

const initialState: State = {
  metrics: null,
  loading: true,
  error: null,
  lastUpdated: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: false,
        metrics: action.metrics,
        lastUpdated: new Date().toLocaleTimeString(),
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
  }
}

/** Auto-refresh interval in milliseconds */
const REFRESH_INTERVAL_MS = 60_000;

// =============================================================================
// Page
// =============================================================================

export default function RevenuePage() {
  return (
    <LicenseGate feature="dashboard">
      <RevenueDashboard />
    </LicenseGate>
  );
}

function RevenueDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { metrics, loading, error, lastUpdated } = state;

  const apiUrl = getApiUrl();

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics() {
      dispatch({ type: 'FETCH_START' });
      try {
        const res = await fetch(`${apiUrl}/api/billing/metrics`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Failed to load metrics (${res.status})`);
        }
        const data = (await res.json()) as RevenueMetrics;
        if (!cancelled) dispatch({ type: 'FETCH_SUCCESS', metrics: data });
      } catch (e: unknown) {
        if (!cancelled) {
          dispatch({
            type: 'FETCH_ERROR',
            error:
              e instanceof Error
                ? e.message
                : 'Unable to load revenue metrics. Verify your admin permissions.',
          });
        }
      }
    }

    void fetchMetrics();

    const interval = setInterval(() => {
      if (!cancelled) void fetchMetrics();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [apiUrl]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Revenue</h1>
            <p className="mt-0.5 text-sm text-zinc-400">
              Billing health, subscriber metrics, and recent payment activity
            </p>
          </div>
          {lastUpdated ? (
            <span className="text-xs text-zinc-600">Updated {lastUpdated}</span>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading && !metrics ? (
          <LoadingSkeleton />
        ) : error && !metrics ? (
          <div
            role="alert"
            className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400"
          >
            {error}
          </div>
        ) : metrics ? (
          <div className="flex flex-col gap-6">
            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                label="Active Subscriptions"
                value={String(metrics.activeSubscriptions)}
                accent="emerald"
              />
              <KpiCard
                label="Total Customers"
                value={String(metrics.totalCustomers)}
                accent="blue"
              />
              <KpiCard
                label="MRR Estimate"
                value={formatCents(metrics.mrr)}
                accent="emerald"
                sublabel="monthly recurring"
              />
            </div>

            {/* Tier Breakdown */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-5">
              <h2 className="mb-4 text-sm font-medium text-zinc-400">Subscriber Breakdown</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <TierBar tier="Pro" count={metrics.tierBreakdown.pro} color="bg-emerald-500" />
                <TierBar tier="Max" count={metrics.tierBreakdown.max} color="bg-blue-500" />
                <TierBar
                  tier="Enterprise"
                  count={metrics.tierBreakdown.enterprise}
                  color="bg-violet-500"
                />
              </div>
            </div>

            {/* Recent Events */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-800/40">
              <div className="border-b border-zinc-800 px-5 py-3">
                <h2 className="text-sm font-medium text-zinc-400">Recent Billing Events</h2>
              </div>
              {metrics.recentEvents.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <p className="text-sm text-zinc-600">No billing events recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                        <th className="px-5 py-2.5 font-medium">Event</th>
                        <th className="px-5 py-2.5 font-medium">Tier</th>
                        <th className="px-5 py-2.5 font-medium text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.recentEvents.map((event) => (
                        <tr
                          key={`${event.createdAt}-${event.type}`}
                          className="border-b border-zinc-800/50 last:border-b-0"
                        >
                          <td className="px-5 py-3">
                            <EventBadge type={event.type} />
                          </td>
                          <td className="px-5 py-3 capitalize text-zinc-400">{event.tier}</td>
                          <td className="px-5 py-3 text-right font-mono text-xs text-zinc-600">
                            {new Date(event.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Refresh indicator */}
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <div
                  className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-zinc-300"
                  aria-hidden="true"
                />
                Refreshing...
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// =============================================================================
// Components
// =============================================================================

function KpiCard({
  label,
  value,
  accent,
  sublabel,
}: {
  label: string;
  value: string;
  accent: 'emerald' | 'blue';
  sublabel?: string;
}) {
  const accentColors = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-5">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${accentColors[accent]}`}>{value}</p>
      {sublabel ? <p className="mt-0.5 text-xs text-zinc-600">{sublabel}</p> : null}
    </div>
  );
}

function TierBar({ tier, count, color }: { tier: string; count: number; color: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-300">{tier}</span>
        <span className="font-mono text-sm font-semibold text-white">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: count > 0 ? `${Math.max(8, Math.min(100, count * 10))}%` : '0%' }}
        />
      </div>
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string }> = {
    subscription_created: {
      label: 'Subscription Created',
      className: 'bg-emerald-500/10 text-emerald-400',
    },
    subscription_cancelled: {
      label: 'Subscription Cancelled',
      className: 'bg-red-500/10 text-red-400',
    },
    subscription_updated: {
      label: 'Subscription Updated',
      className: 'bg-blue-500/10 text-blue-400',
    },
    payment_succeeded: {
      label: 'Payment Succeeded',
      className: 'bg-emerald-500/10 text-emerald-400',
    },
    payment_failed: {
      label: 'Payment Failed',
      className: 'bg-red-500/10 text-red-400',
    },
  };

  const entry = config[type] ?? { label: type, className: 'bg-zinc-600/20 text-zinc-400' };

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${entry.className}`}
    >
      {entry.label}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-live="polite" aria-atomic="true">
      <span className="sr-only">Loading revenue metrics</span>
      {/* KPI skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-5">
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-700" />
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-zinc-700" />
          </div>
        ))}
      </div>
      {/* Tier breakdown skeleton */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-5">
        <div className="mb-4 h-3 w-32 animate-pulse rounded bg-zinc-700" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n}>
              <div className="mb-2 h-3 w-16 animate-pulse rounded bg-zinc-700" />
              <div className="h-2 w-full animate-pulse rounded-full bg-zinc-700" />
            </div>
          ))}
        </div>
      </div>
      {/* Events skeleton */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-800/40">
        <div className="border-b border-zinc-800 px-5 py-3">
          <div className="h-3 w-36 animate-pulse rounded bg-zinc-700" />
        </div>
        <div className="flex flex-col gap-3 p-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-center gap-4">
              <div className="h-5 w-32 animate-pulse rounded-full bg-zinc-700" />
              <div className="h-3 w-16 animate-pulse rounded bg-zinc-700" />
              <div className="ml-auto h-3 w-28 animate-pulse rounded bg-zinc-700" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
