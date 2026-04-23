'use client';

import { useEffect, useReducer } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

type JobState = 'created' | 'active' | 'completed' | 'failed' | 'retry';
type StateFilter = 'all' | JobState;

interface JobEntry {
  id: string;
  name: string;
  state: string;
  priority: number;
  retryCount: number;
  retryLimit: number;
  lastError: string | null;
  lockedBy: string | null;
  lockedUntil: string | null;
  startAfter: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  output: unknown;
  data: unknown;
}

interface JobSummary {
  success: true;
  stateCounts: Record<JobState, number>;
  byHandler24h: Array<{ name: string; completed: number; failed: number; running: number }>;
  recentFailures: Array<{
    id: string;
    name: string;
    lastError: string | null;
    retryCount: number;
    completedAt: string | null;
  }>;
  timestamp: string;
}

interface PaginatedJobs {
  success: true;
  data: JobEntry[];
  total: number;
  limit: number;
  offset: number;
}

interface State {
  summary: JobSummary | null;
  jobs: JobEntry[];
  total: number;
  stateFilter: StateFilter;
  nameFilter: string;
  expandedId: string | null;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; summary: JobSummary; jobs: JobEntry[]; total: number }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SET_STATE_FILTER'; filter: StateFilter }
  | { type: 'SET_NAME_FILTER'; filter: string }
  | { type: 'TOGGLE_EXPAND'; id: string };

const initialState: State = {
  summary: null,
  jobs: [],
  total: 0,
  stateFilter: 'all',
  nameFilter: '',
  expandedId: null,
  loading: true,
  error: null,
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
        jobs: action.jobs,
        total: action.total,
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'SET_STATE_FILTER':
      return { ...state, stateFilter: action.filter, expandedId: null };
    case 'SET_NAME_FILTER':
      return { ...state, nameFilter: action.filter, expandedId: null };
    case 'TOGGLE_EXPAND':
      return {
        ...state,
        expandedId: state.expandedId === action.id ? null : action.id,
      };
  }
}

// =============================================================================
// Constants
// =============================================================================

const STATE_ORDER: StateFilter[] = ['all', 'created', 'active', 'completed', 'failed', 'retry'];

const STATE_COLORS: Record<string, string> = {
  created: 'bg-zinc-600/20 text-zinc-300',
  active: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
  failed: 'bg-red-500/10 text-red-400',
  retry: 'bg-amber-500/10 text-amber-400',
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

// =============================================================================
// Page
// =============================================================================

export default function JobsPage() {
  return (
    <LicenseGate feature="dashboard">
      <JobsDashboard />
    </LicenseGate>
  );
}

function JobsDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { summary, jobs, total, stateFilter, nameFilter, expandedId, loading, error } = state;

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      dispatch({ type: 'FETCH_START' });
      try {
        const listParams = new URLSearchParams();
        listParams.set('limit', '100');
        listParams.set('offset', '0');
        if (stateFilter !== 'all') listParams.set('state', stateFilter);
        if (nameFilter) listParams.set('name', nameFilter);

        const [summaryRes, listRes] = await Promise.all([
          fetch(`${apiUrl}/api/admin/jobs/summary`, { credentials: 'include' }),
          fetch(`${apiUrl}/api/admin/jobs?${listParams.toString()}`, {
            credentials: 'include',
          }),
        ]);

        if (!summaryRes.ok) {
          const body = (await summaryRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Failed to load summary (${summaryRes.status})`);
        }
        if (!listRes.ok) {
          const body = (await listRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Failed to load jobs (${listRes.status})`);
        }

        const summaryBody = (await summaryRes.json()) as JobSummary;
        const listBody = (await listRes.json()) as PaginatedJobs;

        if (!cancelled) {
          dispatch({
            type: 'FETCH_SUCCESS',
            summary: summaryBody,
            jobs: listBody.data,
            total: listBody.total,
          });
        }
      } catch (e) {
        if (!cancelled) {
          dispatch({
            type: 'FETCH_ERROR',
            error:
              e instanceof Error
                ? e.message
                : 'Unable to load jobs. Contact support@revealui.com if this persists.',
          });
        }
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, stateFilter, nameFilter]);

  const handlerNames = summary ? summary.byHandler24h.map((h) => h.name) : [];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <h1 className="text-xl font-semibold text-white">Durable Work Queue</h1>
        <p className="mt-0.5 text-sm text-zinc-400">
          Background jobs processed by the CR8-P2-01 queue (agent dispatch, saga outbox, future
          handlers).
        </p>
      </div>

      {/* State stat row */}
      <div className="overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-6 py-3">
        <div className="flex min-w-max gap-6">
          <StatePill label="Created" value={summary?.stateCounts.created ?? 0} color="zinc" />
          <StatePill label="Active" value={summary?.stateCounts.active ?? 0} color="blue" />
          <StatePill
            label="Completed"
            value={summary?.stateCounts.completed ?? 0}
            color="emerald"
          />
          <StatePill label="Failed" value={summary?.stateCounts.failed ?? 0} color="red" />
          <StatePill label="Retry" value={summary?.stateCounts.retry ?? 0} color="amber" />
          <span className="ml-auto text-xs text-zinc-600">
            {summary ? `snapshot ${formatTimestamp(summary.timestamp)}` : ''}
          </span>
        </div>
      </div>

      {/* Per-handler 24h row */}
      {summary && summary.byHandler24h.length > 0 && (
        <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-3">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Handlers (last 24h)
          </h2>
          <div className="flex flex-wrap gap-3">
            {summary.byHandler24h.map((h) => (
              <HandlerChip key={h.name} {...h} />
            ))}
          </div>
        </div>
      )}

      {/* Filter row */}
      <div className="border-b border-zinc-800 bg-zinc-950 px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex min-w-max gap-1 -mb-px" aria-label="State filter">
            {STATE_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => dispatch({ type: 'SET_STATE_FILTER', filter: s })}
                className={`border-b-2 px-4 py-3 text-sm font-medium capitalize transition-colors ${
                  stateFilter === s
                    ? 'border-white text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {s}
                {s !== 'all' && summary ? ` (${summary.stateCounts[s as JobState]})` : ''}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 py-2">
            <label htmlFor="name-filter" className="text-xs text-zinc-500">
              Handler:
            </label>
            <select
              id="name-filter"
              value={nameFilter}
              onChange={(e) => dispatch({ type: 'SET_NAME_FILTER', filter: e.target.value })}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 focus:border-zinc-500 focus:outline-none"
            >
              <option value="">All handlers</option>
              {handlerNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col gap-2" role="status" aria-label="Loading jobs">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
                key={i}
                className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-800/40 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-5 w-16 rounded-full bg-zinc-700" />
                  <div className="h-4 flex-1 rounded bg-zinc-700/60" />
                  <div className="h-3 w-32 rounded bg-zinc-700/40" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400"
          >
            {error}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState stateFilter={stateFilter} nameFilter={nameFilter} />
        ) : (
          <>
            <div className="mb-3 text-xs text-zinc-500">
              Showing {jobs.length} of {total} matching jobs
            </div>
            <div className="flex flex-col gap-2">
              {jobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  expanded={expandedId === job.id}
                  onToggle={() => dispatch({ type: 'TOGGLE_EXPAND', id: job.id })}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Components
// =============================================================================

function StatePill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'emerald' | 'red' | 'blue' | 'zinc' | 'amber';
}) {
  const colors = {
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    zinc: 'text-zinc-400',
    amber: 'text-amber-400',
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-sm font-semibold ${colors[color]}`}>{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

function HandlerChip({
  name,
  completed,
  failed,
  running,
}: {
  name: string;
  completed: number;
  failed: number;
  running: number;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs">
      <div className="font-mono text-zinc-300">{name}</div>
      <div className="mt-1 flex gap-3 text-[11px] text-zinc-500">
        <span className="text-emerald-400">{completed} ok</span>
        <span className="text-red-400">{failed} fail</span>
        {running > 0 && <span className="text-blue-400">{running} running</span>}
      </div>
    </div>
  );
}

function JobRow({
  job,
  expanded,
  onToggle,
}: {
  job: JobEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const durationMs =
    job.startedAt && job.completedAt
      ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
      : null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 transition-colors hover:border-zinc-700">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <StateBadge state={job.state} />
          <span className="truncate font-mono text-sm text-zinc-300">{job.name}</span>
          <span className="hidden shrink-0 text-xs text-zinc-600 sm:inline">
            {truncate(job.id, 32)}
          </span>
          {job.retryCount > 0 && (
            <span
              title={`retry ${job.retryCount}/${job.retryLimit}`}
              className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400"
            >
              ↻ {job.retryCount}
            </span>
          )}
          <span className="ml-auto shrink-0 font-mono text-xs text-zinc-600">
            {formatTimestamp(job.createdAt)}
          </span>
          {durationMs != null && (
            <span className="hidden shrink-0 text-xs text-zinc-500 sm:inline">{durationMs}ms</span>
          )}
          <ChevronIcon expanded={expanded} />
        </div>
        {!expanded && job.lastError && (
          <p className="mt-1.5 truncate text-xs text-red-400">
            <span className="text-zinc-600">err: </span>
            {job.lastError}
          </p>
        )}
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <div className="grid gap-4 text-sm lg:grid-cols-2">
            <MetaField label="Job ID" value={job.id} mono />
            <MetaField label="Handler" value={job.name} mono />
            <MetaField
              label="Priority"
              value={job.priority === 0 ? 'default (0)' : String(job.priority)}
            />
            <MetaField label="Retries" value={`${job.retryCount} / ${job.retryLimit}`} />
            <MetaField label="Created" value={formatTimestamp(job.createdAt)} />
            <MetaField label="Start after" value={formatTimestamp(job.startAfter)} />
            <MetaField label="Started" value={formatTimestamp(job.startedAt)} />
            <MetaField label="Completed" value={formatTimestamp(job.completedAt)} />
            {job.lockedBy && (
              <>
                <MetaField label="Locked by" value={job.lockedBy} mono />
                <MetaField label="Locked until" value={formatTimestamp(job.lockedUntil)} />
              </>
            )}

            {job.data != null && (
              <div className="col-span-full border-t border-zinc-800 pt-3">
                <h4 className="mb-1 text-xs font-medium text-zinc-500">Payload</h4>
                <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-zinc-400">
                  {JSON.stringify(job.data, null, 2)}
                </pre>
              </div>
            )}

            {job.output != null && (
              <div className="col-span-full border-t border-zinc-800 pt-3">
                <h4 className="mb-1 text-xs font-medium text-zinc-500">Output</h4>
                <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-zinc-400">
                  {JSON.stringify(job.output, null, 2)}
                </pre>
              </div>
            )}

            {job.lastError && (
              <div role="alert" className="col-span-full border-t border-zinc-800 pt-3">
                <h4 className="mb-1 text-xs font-medium text-red-500">Last error</h4>
                <p className="whitespace-pre-wrap text-xs text-red-400">{job.lastError}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const color = STATE_COLORS[state] ?? 'bg-zinc-700/20 text-zinc-400';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {state}
    </span>
  );
}

function MetaField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs text-zinc-600">{label}: </span>
      <span className={`text-xs text-zinc-400 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function EmptyState({ stateFilter, nameFilter }: { stateFilter: StateFilter; nameFilter: string }) {
  const message = (() => {
    if (stateFilter === 'all' && !nameFilter) {
      return 'No queue jobs yet. Jobs appear here when handlers are registered and producers enqueue work (e.g. agent-tasks dispatch with REVEALUI_JOBS_AGENT_DISPATCH_ENABLED=true).';
    }
    const bits: string[] = [];
    if (stateFilter !== 'all') bits.push(`state=${stateFilter}`);
    if (nameFilter) bits.push(`handler=${nameFilter}`);
    return `No jobs match ${bits.join(', ')}.`;
  })();

  return (
    <div className="flex flex-col items-center py-16">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
        <svg
          className="h-6 w-6 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <p className="max-w-md text-center text-sm text-zinc-500">{message}</p>
    </div>
  );
}
