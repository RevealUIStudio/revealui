/**
 * MCP Usage Dashboard (used by the Usage tab on /admin/mcp).
 *
 * Renders per-`meterName` totals + outcome mix + p50/p95 durations
 * sourced from `GET /api/mcp/usage` (A.3a backend). Bars are
 * hand-rolled inline SVG; no chart-library dep.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

type Range = '24h' | '7d' | '30d';

interface MeterAggregate {
  meterName: string;
  total: number;
  successCount: number;
  errorCount: number;
  unknownCount: number;
  durationCount: number;
  p50Ms: number | null;
  p95Ms: number | null;
}

interface UsageResponse {
  range: Range;
  since: string;
  accountId: string | null;
  meters: MeterAggregate[];
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const RANGES: readonly Range[] = ['24h', '7d', '30d'] as const;
const RANGE_LABELS: Readonly<Record<Range, string>> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

interface StackedBarProps {
  successCount: number;
  errorCount: number;
  unknownCount: number;
}

function StackedBar({ successCount, errorCount, unknownCount }: StackedBarProps) {
  const total = successCount + errorCount + unknownCount;
  if (total === 0) {
    return <div aria-hidden="true" className="h-2 w-full rounded-full bg-zinc-800" />;
  }
  const successPct = (successCount / total) * 100;
  const errorPct = (errorCount / total) * 100;
  const unknownPct = 100 - successPct - errorPct;

  return (
    <svg
      role="img"
      aria-label={`${successCount} success, ${errorCount} error, ${unknownCount} unknown`}
      viewBox="0 0 100 4"
      preserveAspectRatio="none"
      className="h-2 w-full overflow-hidden rounded-full bg-zinc-800"
    >
      {successPct > 0 && (
        <rect x={0} y={0} width={successPct} height={4} className="fill-emerald-500" />
      )}
      {errorPct > 0 && (
        <rect x={successPct} y={0} width={errorPct} height={4} className="fill-red-500" />
      )}
      {unknownPct > 0 && (
        <rect
          x={successPct + errorPct}
          y={0}
          width={unknownPct}
          height={4}
          className="fill-zinc-500"
        />
      )}
    </svg>
  );
}

export interface UsageDashboardProps {
  defaultRange?: Range;
}

export function UsageDashboard({ defaultRange = '24h' }: UsageDashboardProps) {
  const [range, setRange] = useState<Range>(defaultRange);
  const [data, setData] = useState<UsageResponse | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (r: Range) => {
    setState('loading');
    setMessage(null);
    try {
      const res = await fetch(`/api/mcp/usage?range=${r}`, { credentials: 'include' });
      // empty-catch-ok: non-JSON error body — res.status is surfaced below.
      const body = (await res.json().catch(() => ({}))) as Partial<UsageResponse> & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData(body as UsageResponse);
      setState('ready');
    } catch (err) {
      setState('error');
      setMessage((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  return (
    <section aria-label="MCP usage">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-white">Usage</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Per-meter call counts and durations from the events your MCP servers emit.
          </p>
        </div>
        <div
          className="inline-flex rounded-md border border-zinc-800 bg-zinc-900/50 p-0.5"
          role="toolbar"
          aria-label="Time range"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                range === r ? 'bg-zinc-800 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </header>

      {message && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300"
        >
          {message}
        </div>
      )}

      {state === 'loading' && (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
          Loading usage…
        </div>
      )}

      {state === 'ready' && data && data.meters.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
          No MCP usage in the {RANGE_LABELS[range].toLowerCase()}. Run an agent that calls an MCP
          tool, or wait for events to accumulate.
        </div>
      )}

      {state === 'ready' && data && data.meters.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Meter</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Calls</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Outcome mix</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-400">p50</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-400">p95</th>
              </tr>
            </thead>
            <tbody>
              {data.meters.map((m) => (
                <tr key={m.meterName} className="border-t border-zinc-800/50 align-middle">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-300">{m.meterName}</td>
                  <td className="px-4 py-3 text-zinc-300">{m.total.toLocaleString()}</td>
                  <td className="min-w-48 px-4 py-3">
                    <StackedBar
                      successCount={m.successCount}
                      errorCount={m.errorCount}
                      unknownCount={m.unknownCount}
                    />
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                      <span>
                        <span
                          aria-hidden="true"
                          className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500 align-middle"
                        />
                        {m.successCount} ok
                      </span>
                      <span>
                        <span
                          aria-hidden="true"
                          className="mr-1 inline-block h-2 w-2 rounded-sm bg-red-500 align-middle"
                        />
                        {m.errorCount} err
                      </span>
                      {m.unknownCount > 0 && (
                        <span>
                          <span
                            aria-hidden="true"
                            className="mr-1 inline-block h-2 w-2 rounded-sm bg-zinc-500 align-middle"
                          />
                          {m.unknownCount} unknown
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-zinc-300">
                    {formatDuration(m.p50Ms)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-zinc-300">
                    {formatDuration(m.p95Ms)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state === 'ready' && data && (
        <p className="mt-3 text-xs text-zinc-500">
          {RANGE_LABELS[range]} · since {new Date(data.since).toLocaleString()} · account{' '}
          <span className="font-mono text-zinc-400">{data.accountId ?? '—'}</span>
        </p>
      )}
    </section>
  );
}
