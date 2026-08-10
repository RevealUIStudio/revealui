'use client';

import { type ReactNode, useEffect, useReducer } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types (mirrors GET /api/admin/margin/summary)
// =============================================================================

interface MarginSnapshot {
  id: string;
  periodDate: string;
  freeCostCents: number;
  paidCostCents: number;
  totalCostCents: number;
  revenueCents: number;
  netCents: number;
  projected7dCents: number | null;
  freeCostRatio: string | null;
  mode: 'open' | 'lean' | 'waitlist';
  accountCountFree: number | null;
  accountCountPaid: number | null;
  computedAt: string;
  trend: Record<string, unknown>;
}

interface AccountMarginRow {
  accountId: string;
  periodDate: string;
  costCents: number;
  agentTasks: number;
  revenueCents: number;
  netCents: number;
  tier: string | null;
}

interface MarginSummary {
  latest: MarginSnapshot | null;
  history: MarginSnapshot[];
  topAccountsByCost: AccountMarginRow[];
}

interface State {
  summary: MarginSummary | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; summary: MarginSummary }
  | { type: 'FETCH_ERROR'; error: string };

const initialState: State = {
  summary: null,
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
        summary: action.summary,
        lastUpdated: new Date().toLocaleTimeString(),
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
  }
}

const REFRESH_INTERVAL_MS = 60_000;

const MODE_STYLES: Record<string, string> = {
  open: 'bg-emerald-500/15 text-emerald-700',
  lean: 'bg-amber-500/15 text-amber-800',
  waitlist: 'bg-error/15 text-error',
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

// =============================================================================
// Page
// =============================================================================

export default function MarginPage() {
  return (
    <LicenseGate feature="dashboard">
      <MarginDashboard />
    </LicenseGate>
  );
}

function MarginDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { summary, loading, error, lastUpdated } = state;
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    let cancelled = false;

    async function fetchSummary() {
      dispatch({ type: 'FETCH_START' });
      try {
        const res = await fetch(`${apiUrl}/api/admin/margin/summary`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Failed to load margin summary (${res.status})`);
        }
        const body = (await res.json()) as { success: boolean; data: MarginSummary };
        if (!cancelled) dispatch({ type: 'FETCH_SUCCESS', summary: body.data });
      } catch (e: unknown) {
        if (!cancelled) {
          dispatch({
            type: 'FETCH_ERROR',
            error:
              e instanceof Error
                ? e.message
                : 'Unable to load margin data. Verify admin permissions and that the margin-snapshot cron has run.',
          });
        }
      }
    }

    void fetchSummary();
    const interval = setInterval(() => {
      if (!cancelled) void fetchSummary();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [apiUrl]);

  const latest = summary?.latest ?? null;

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Margin admission</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Aggregate cost vs revenue, governor mode, and per-account cost rollups (GAP-256)
            </p>
          </div>
          {lastUpdated ? (
            <span className="text-xs text-muted-foreground">Updated {lastUpdated}</span>
          ) : null}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {loading && !summary ? (
          <p className="text-sm text-muted-foreground">Loading margin snapshot…</p>
        ) : null}

        {error && !summary ? (
          <div
            role="alert"
            className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error"
          >
            {error}
          </div>
        ) : null}

        {summary && !latest ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            No margin snapshots yet. The margin-snapshot cron writes daily rows when enabled
            (`MARGIN_SNAPSHOT_CRON_ENABLED`). Free intake stays open until a snapshot says
            otherwise.
          </div>
        ) : null}

        {latest ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Governor mode" value={latest.mode}>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${MODE_STYLES[latest.mode] ?? ''}`}
                >
                  {latest.mode}
                </span>
              </MetricCard>
              <MetricCard label="Net (period)" value={formatCents(latest.netCents)} />
              <MetricCard label="Revenue (period)" value={formatCents(latest.revenueCents)} />
              <MetricCard label="Total cost (period)" value={formatCents(latest.totalCostCents)} />
              <MetricCard label="Free cost" value={formatCents(latest.freeCostCents)} />
              <MetricCard label="Paid cost" value={formatCents(latest.paidCostCents)} />
              <MetricCard
                label="Projected net 7d"
                value={
                  latest.projected7dCents == null ? 'n/a' : formatCents(latest.projected7dCents)
                }
              />
              <MetricCard
                label="Accounts free / paid"
                value={`${latest.accountCountFree ?? '—'} / ${latest.accountCountPaid ?? '—'}`}
              />
            </section>

            <p className="text-xs text-muted-foreground">
              Period {latest.periodDate} · computed {new Date(latest.computedAt).toLocaleString()}
              {latest.freeCostRatio ? ` · free cost ratio ${latest.freeCostRatio}` : ''}
            </p>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Recent history</h2>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Mode</th>
                      <th className="px-3 py-2">Revenue</th>
                      <th className="px-3 py-2">Cost</th>
                      <th className="px-3 py-2">Net</th>
                      <th className="px-3 py-2">Proj. 7d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary?.history.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs">{row.periodDate}</td>
                        <td className="px-3 py-2 capitalize">{row.mode}</td>
                        <td className="px-3 py-2">{formatCents(row.revenueCents)}</td>
                        <td className="px-3 py-2">{formatCents(row.totalCostCents)}</td>
                        <td className="px-3 py-2">{formatCents(row.netCents)}</td>
                        <td className="px-3 py-2">
                          {row.projected7dCents == null ? '—' : formatCents(row.projected7dCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Top accounts by cost (latest period)
              </h2>
              {summary && summary.topAccountsByCost.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No per-account rows for this period.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Account</th>
                        <th className="px-3 py-2">Tier</th>
                        <th className="px-3 py-2">Cost</th>
                        <th className="px-3 py-2">Revenue</th>
                        <th className="px-3 py-2">Net</th>
                        <th className="px-3 py-2">Agent tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.topAccountsByCost.map((row) => (
                        <tr key={row.accountId} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs">{row.accountId}</td>
                          <td className="px-3 py-2">{row.tier ?? '—'}</td>
                          <td className="px-3 py-2">{formatCents(row.costCents)}</td>
                          <td className="px-3 py-2">{formatCents(row.revenueCents)}</td>
                          <td className="px-3 py-2">{formatCents(row.netCents)}</td>
                          <td className="px-3 py-2">{row.agentTasks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 text-lg font-semibold text-foreground">{children ?? value}</div>
    </div>
  );
}
