'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

interface TaskSubmission {
  id: string;
  agentId: string | null;
  skillName: string;
  status: string;
  priority: number;
  costUsdc: string | null;
  output: Record<string, unknown> | null;
  artifacts: Array<{ name: string; url: string; mimeType: string }>;
  errorMessage: string | null;
  executionMeta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskProgress {
  taskId: string;
  status: string;
  progress: number;
  message: string;
  updatedAt: string;
}

type StatusFilter = 'all' | 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/50 text-yellow-400',
  queued: 'bg-blue-900/50 text-blue-400',
  running: 'bg-cyan-900/50 text-cyan-400',
  completed: 'bg-green-900/50 text-green-400',
  failed: 'bg-red-900/50 text-red-400',
  cancelled: 'bg-zinc-800 text-zinc-500',
};

// =============================================================================
// Task Dashboard
// =============================================================================

export default function TaskDashboardPage() {
  const [tasks, setTasks] = useState<TaskSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    // Fetch all tasks for the current user
    // The API returns tasks filtered by submitter via auth
    fetch(`${apiUrl}/api/revmarket/tasks`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { tasks: TaskSubmission[] }) => {
        setTasks(data.tasks ?? []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const filteredTasks = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  const statusCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <LicenseGate feature="ai">
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin/marketplace" className="text-sm text-zinc-500 hover:text-zinc-300">
                RevMarket
              </Link>
              <span className="mx-2 text-zinc-700">/</span>
              <span className="text-sm text-zinc-300">My Tasks</span>
              <h1 className="mt-1 text-xl font-semibold text-white">Task Dashboard</h1>
              <p className="mt-0.5 text-sm text-zinc-400">
                Track your submitted tasks — progress, cost, and artifacts
              </p>
            </div>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="border-b border-zinc-800 bg-zinc-950 px-6">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {(
              [
                'all',
                'running',
                'queued',
                'pending',
                'completed',
                'failed',
                'cancelled',
              ] as StatusFilter[]
            ).map((s) => {
              const count = s === 'all' ? tasks.length : (statusCounts[s] ?? 0);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    filter === s
                      ? 'border-white text-white'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)} ({count})
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <TaskTableSkeleton />
          ) : error ? (
            <div className="rounded-lg border border-red-900 bg-red-950/50 p-4 text-sm text-red-400">
              Failed to load tasks: {error}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg text-zinc-400">No tasks found</p>
              <p className="mt-1 text-sm text-zinc-500">
                {filter !== 'all' ? 'Try a different filter' : 'Submit a task from the marketplace'}
              </p>
              <Link
                href="/admin/marketplace"
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                Browse Agents
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  apiUrl={apiUrl}
                  isExpanded={selectedTask === task.id}
                  onToggle={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
                  onCancelled={() =>
                    setTasks((prev) =>
                      prev.map((t) => (t.id === task.id ? { ...t, status: 'cancelled' } : t)),
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </LicenseGate>
  );
}

// =============================================================================
// Task Row
// =============================================================================

function TaskRow({
  task,
  apiUrl,
  isExpanded,
  onToggle,
  onCancelled,
}: {
  task: TaskSubmission;
  apiUrl: string;
  isExpanded: boolean;
  onToggle: () => void;
  onCancelled: () => void;
}) {
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll progress for running tasks
  useEffect(() => {
    if (task.status !== 'running') return;

    function poll() {
      fetch(`${apiUrl}/api/revmarket/tasks/${task.id}/progress`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data: TaskProgress) => setProgress(data))
        .catch(() => {
          /* ignore polling errors */
        });
    }

    poll();
    pollRef.current = setInterval(poll, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [apiUrl, task.id, task.status]);

  async function handleCancel() {
    try {
      const res = await fetch(`${apiUrl}/api/revmarket/tasks/${task.id}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) onCancelled();
    } catch {
      /* ignore */
    }
  }

  const statusClass = STATUS_COLORS[task.status] ?? 'bg-zinc-800 text-zinc-400';

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      {/* Row header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <span className={`rounded px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
          {task.status}
        </span>
        <span className="flex-1 text-sm text-white truncate">{task.skillName}</span>
        <span className="text-xs text-zinc-500">P{task.priority}</span>
        {task.costUsdc && <span className="text-xs text-zinc-400">${task.costUsdc}</span>}
        <span className="text-xs text-zinc-600">
          {new Date(task.createdAt).toLocaleDateString()}
        </span>
        <span className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Progress bar for running tasks */}
      {task.status === 'running' && progress && progress.progress > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500">{progress.progress}%</span>
          </div>
          {progress.message && <p className="mt-1 text-xs text-zinc-500">{progress.message}</p>}
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-zinc-800 px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-500">Task ID:</span>{' '}
              <span className="font-mono text-xs text-zinc-300">{task.id}</span>
            </div>
            <div>
              <span className="text-zinc-500">Agent:</span>{' '}
              <span className="text-zinc-300">{task.agentId ?? 'Unassigned'}</span>
            </div>
            <div>
              <span className="text-zinc-500">Created:</span>{' '}
              <span className="text-zinc-300">{new Date(task.createdAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-zinc-500">Updated:</span>{' '}
              <span className="text-zinc-300">{new Date(task.updatedAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Error message */}
          {task.errorMessage && (
            <div className="rounded border border-red-900 bg-red-950/50 p-3 text-sm text-red-400">
              {task.errorMessage}
            </div>
          )}

          {/* Output */}
          {task.output && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Output:</p>
              <pre className="overflow-x-auto rounded bg-zinc-950 p-3 text-xs text-zinc-400">
                {JSON.stringify(task.output, null, 2)}
              </pre>
            </div>
          )}

          {/* Artifacts */}
          {task.artifacts.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Artifacts:</p>
              <div className="space-y-1">
                {task.artifacts.map((artifact) => (
                  <a
                    key={artifact.url}
                    href={artifact.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-blue-400 hover:text-blue-300"
                  >
                    {artifact.name} ({artifact.mimeType})
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Cancel button for cancellable tasks */}
          {(task.status === 'pending' || task.status === 'queued') && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-red-950/50 transition-colors"
            >
              Cancel Task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

function TaskTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
          key={i}
          className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
        >
          <div className="flex items-center gap-4">
            <div className="h-5 w-16 rounded bg-zinc-800" />
            <div className="h-4 w-48 rounded bg-zinc-800" />
            <div className="ml-auto h-3 w-20 rounded bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
