'use client';

import { useEffect, useReducer } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

const MS_PER_HOUR = 60 * 60 * 1000;
const FILTER_24H_MS = 24 * MS_PER_HOUR;
const FILTER_7D_MS = 7 * 24 * MS_PER_HOUR;
const FILTER_30D_MS = 30 * 24 * MS_PER_HOUR;

// =============================================================================
// Types
// =============================================================================

interface AgentTask {
  id: string;
  agentId: string;
  tool: string;
  params: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  status: string;
  error: string | null;
  reasoning: string | null;
  confidence: number | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

type StatusFilter = 'all' | 'completed' | 'failed' | 'running' | 'pending';
type DateFilter = 'all' | '24h' | '7d' | '30d';

interface State {
  tasks: AgentTask[];
  loading: boolean;
  error: string | null;
  statusFilter: StatusFilter;
  dateFilter: DateFilter;
  expandedId: string | null;
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; tasks: AgentTask[] }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SET_FILTER'; filter: StatusFilter }
  | { type: 'SET_DATE_FILTER'; filter: DateFilter }
  | { type: 'TOGGLE_EXPAND'; id: string };

const initialState: State = {
  tasks: [],
  loading: true,
  error: null,
  statusFilter: 'all',
  dateFilter: 'all',
  expandedId: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, tasks: action.tasks };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'SET_FILTER':
      return { ...state, statusFilter: action.filter, expandedId: null };
    case 'SET_DATE_FILTER':
      return { ...state, dateFilter: action.filter, expandedId: null };
    case 'TOGGLE_EXPAND':
      return { ...state, expandedId: state.expandedId === action.id ? null : action.id };
  }
}

// =============================================================================
// Page
// =============================================================================

export default function AgentTasksPage() {
  return (
    <LicenseGate feature="ai">
      <AgentTasksDashboard />
    </LicenseGate>
  );
}

function AgentTasksDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { tasks, loading, error, statusFilter, dateFilter, expandedId } = state;

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'FETCH_START' });

    (async () => {
      try {
        // Fetch tasks from all registered agents
        const agentsRes = await fetch(`${apiUrl}/a2a/agents`, { credentials: 'include' });
        if (!agentsRes.ok) throw new Error('Failed to load agents');

        const agentsData = (await agentsRes.json()) as { agents: Array<{ name: string }> };
        const agentNames = (agentsData.agents ?? []).map((a) =>
          a.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, ''),
        );

        // Fetch tasks from each agent in parallel
        const allTasks: AgentTask[] = [];
        const results = await Promise.allSettled(
          agentNames.map(async (agentId) => {
            const res = await fetch(`${apiUrl}/a2a/agents/${encodeURIComponent(agentId)}/tasks`, {
              credentials: 'include',
            });
            if (!res.ok) return [];
            const data = (await res.json()) as { tasks?: AgentTask[] };
            return (data.tasks ?? []).map((t) => ({ ...t, agentId }));
          }),
        );

        for (const r of results) {
          if (r.status === 'fulfilled') allTasks.push(...r.value);
        }

        // Sort by most recent first
        allTasks.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

        if (!cancelled) dispatch({ type: 'FETCH_SUCCESS', tasks: allTasks });
      } catch (e: unknown) {
        if (!cancelled) {
          dispatch({
            type: 'FETCH_ERROR',
            error:
              e instanceof Error
                ? e.message
                : 'Unable to load agent tasks. Contact support@revealui.com if this persists.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const dateThreshold: Date | null = (() => {
    if (dateFilter === 'all') return null;
    const now = Date.now();
    if (dateFilter === '24h') return new Date(now - FILTER_24H_MS);
    if (dateFilter === '7d') return new Date(now - FILTER_7D_MS);
    return new Date(now - FILTER_30D_MS);
  })();

  const filtered = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (dateThreshold && new Date(t.startedAt) < dateThreshold) return false;
    return true;
  });

  const counts = {
    all: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
    running: tasks.filter((t) => t.status === 'running').length,
    pending: tasks.filter((t) => t.status === 'pending').length,
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <h1 className="text-xl font-semibold text-white">Agent Tasks</h1>
        <p className="mt-0.5 text-sm text-zinc-400">Task execution history across all AI agents</p>
      </div>

      {/* Stats bar */}
      <div className="overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-6 py-3">
        <div className="flex min-w-max gap-6">
          <StatPill label="Total" value={counts.all} />
          <StatPill label="Completed" value={counts.completed} color="emerald" />
          <StatPill label="Failed" value={counts.failed} color="red" />
          <StatPill label="Running" value={counts.running} color="blue" />
          <StatPill label="Pending" value={counts.pending} color="zinc" />
        </div>
      </div>

      {/* Date + status filter row */}
      <div className="border-b border-zinc-800 bg-zinc-950 px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="overflow-x-auto">
            <nav className="flex gap-1 -mb-px min-w-max" aria-label="Status filter">
              {(['all', 'completed', 'failed', 'running', 'pending'] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_FILTER', filter: f })}
                  className={`border-b-2 px-4 py-3 text-sm font-medium capitalize transition-colors ${
                    statusFilter === f
                      ? 'border-white text-white'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {f} ({counts[f]})
                </button>
              ))}
            </nav>
          </div>
          <fieldset className="flex items-center gap-1 border-none p-0 py-2">
            <legend className="sr-only">Date filter</legend>
            {(['24h', '7d', '30d', 'all'] as DateFilter[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => dispatch({ type: 'SET_DATE_FILTER', filter: d })}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  dateFilter === d ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {d === 'all' ? 'All time' : d}
              </button>
            ))}
          </fieldset>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col gap-2" role="status" aria-label="Loading tasks">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
                key={i}
                className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-800/40 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-5 w-16 rounded-full bg-zinc-700" />
                  <div className="h-4 flex-1 rounded bg-zinc-700/60" />
                  <div className="hidden h-3 w-20 rounded bg-zinc-700/40 sm:block" />
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
        ) : filtered.length === 0 ? (
          <EmptyState filter={statusFilter} dateFilter={dateFilter} />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                expanded={expandedId === task.id}
                onToggle={() => dispatch({ type: 'TOGGLE_EXPAND', id: task.id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Components
// =============================================================================

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'emerald' | 'red' | 'blue' | 'zinc';
}) {
  const colors = {
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    zinc: 'text-zinc-400',
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-sm font-semibold ${color ? colors[color] : 'text-white'}`}>
        {value}
      </span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

function TaskRow({
  task,
  expanded,
  onToggle,
}: {
  task: AgentTask;
  expanded: boolean;
  onToggle: () => void;
}) {
  const inputText = extractText(task.params);
  const outputText = extractResultText(task.result);
  const ts = new Date(task.startedAt).toLocaleString();

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 transition-colors hover:border-zinc-700">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={task.status} />
          <span className="truncate text-sm text-zinc-300">{inputText ?? task.tool}</span>
          <span className="ml-auto hidden shrink-0 text-xs text-zinc-600 sm:inline">
            {task.agentId}
          </span>
          <span className="shrink-0 font-mono text-xs text-zinc-600">{ts}</span>
          {task.durationMs != null && (
            <span className="hidden shrink-0 text-xs text-zinc-500 sm:inline">
              {task.durationMs}ms
            </span>
          )}
          <ChevronIcon expanded={expanded} />
        </div>
        {!expanded && outputText && (
          <p className="mt-1.5 truncate text-xs text-zinc-500">
            <span className="text-zinc-600">out: </span>
            {outputText}
          </p>
        )}
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <div className="grid gap-4 text-sm lg:grid-cols-2">
            {/* Input */}
            <div>
              <h4 className="mb-1 text-xs font-medium text-zinc-500">Input</h4>
              <p className="whitespace-pre-wrap text-zinc-300">{inputText ?? ' - '}</p>
            </div>

            {/* Output */}
            <div>
              <h4 className="mb-1 text-xs font-medium text-zinc-500">Output</h4>
              <p className="whitespace-pre-wrap text-zinc-300">{outputText ?? ' - '}</p>
            </div>

            {/* Metadata row */}
            <div className="col-span-full flex flex-wrap gap-4 border-t border-zinc-800 pt-3">
              <MetaField label="Tool" value={task.tool} />
              <MetaField label="Agent" value={task.agentId} />
              <MetaField label="Started" value={ts} />
              <MetaField
                label="Completed"
                value={task.completedAt ? new Date(task.completedAt).toLocaleString() : ' - '}
              />
              <MetaField
                label="Duration"
                value={task.durationMs != null ? `${task.durationMs}ms` : ' - '}
              />
              {task.confidence != null && (
                <MetaField label="Confidence" value={`${Math.round(task.confidence * 100)}%`} />
              )}
            </div>

            {/* Reasoning */}
            {task.reasoning && (
              <div className="col-span-full border-t border-zinc-800 pt-3">
                <h4 className="mb-1 text-xs font-medium text-zinc-500">Reasoning</h4>
                <p className="whitespace-pre-wrap text-xs text-zinc-400">{task.reasoning}</p>
              </div>
            )}

            {/* Error */}
            {task.error && (
              <div role="alert" className="col-span-full border-t border-zinc-800 pt-3">
                <h4 className="mb-1 text-xs font-medium text-red-500">Error</h4>
                <p className="whitespace-pre-wrap text-xs text-red-400">{task.error}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-zinc-600">{label}: </span>
      <span className="font-mono text-xs text-zinc-400">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400',
    failed: 'bg-red-500/10 text-red-400',
    running: 'bg-blue-500/10 text-blue-400',
    pending: 'bg-zinc-600/20 text-zinc-400',
    cancelled: 'bg-zinc-600/20 text-zinc-400',
  };
  const color = colors[status] ?? 'bg-zinc-700/20 text-zinc-400';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
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

function EmptyState({ filter, dateFilter }: { filter: StatusFilter; dateFilter: DateFilter }) {
  const dateLabel: Record<DateFilter, string> = {
    all: '',
    '24h': ' in the last 24 hours',
    '7d': ' in the last 7 days',
    '30d': ' in the last 30 days',
  };
  const message =
    filter === 'all' && dateFilter === 'all'
      ? 'No agent tasks recorded yet. Submit a task from the Agents page to get started.'
      : filter === 'all'
        ? `No tasks found${dateLabel[dateFilter]}.`
        : `No ${filter} tasks found${dateLabel[dateFilter]}.`;

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
            d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.591.659H9.061a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V17a2.25 2.25 0 01-2.25 2.25H7.25A2.25 2.25 0 015 17v-2.5"
          />
        </svg>
      </div>
      <p className="text-sm text-zinc-500">{message}</p>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function extractText(params: Record<string, unknown> | null): string | null {
  if (!params) return null;
  try {
    const message = params.message as
      | { parts?: Array<{ type: string; text?: string }> }
      | undefined;
    return (
      message?.parts
        ?.filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join(' ')
        .trim() ?? null
    );
  } catch {
    return null;
  }
}

function extractResultText(result: Record<string, unknown> | null): string | null {
  if (!result) return null;
  try {
    const artifacts = result.artifacts as
      | Array<{ parts?: Array<{ type: string; text?: string }> }>
      | undefined;
    const fromArtifact = artifacts?.[0]?.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text ?? '')
      .join(' ')
      .trim();
    if (fromArtifact) return fromArtifact;

    const status = result.status as
      | { message?: { parts?: Array<{ type: string; text?: string }> } }
      | undefined;
    return (
      status?.message?.parts
        ?.filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join(' ')
        .trim() ?? null
    );
  } catch {
    return null;
  }
}
