'use client';

import { Badge, Button, Card, EmptyState, LinkButton, Skeleton } from '@revealui/presentation';
import type { TaskSubmissionRecord } from '@revealui/sync';
import { useTaskSubmissions } from '@revealui/sync';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

interface TaskProgress {
  taskId: string;
  status: string;
  progress: number;
  message: string;
  updatedAt: string;
}

type StatusFilter = 'all' | 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

const STATUS_BADGE_COLORS: Record<string, 'warning' | 'brand' | 'success' | 'danger' | 'muted'> = {
  pending: 'warning',
  queued: 'brand',
  running: 'brand',
  completed: 'success',
  failed: 'danger',
  cancelled: 'muted',
};

// =============================================================================
// Task Dashboard
// =============================================================================

export default function TaskDashboardPage() {
  const { submissions, isLoading, error } = useTaskSubmissions();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  const filteredTasks =
    filter === 'all' ? submissions : submissions.filter((t) => t.status === filter);

  const statusCounts = submissions.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <LicenseGate feature="ai">
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/marketplace"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                RevMarket
              </Link>
              <span className="mx-2 text-muted-foreground">/</span>
              <span className="text-sm text-muted-foreground">My Tasks</span>
              <h1 className="mt-1 text-xl font-semibold text-foreground">Task Dashboard</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Track your submitted tasks - progress, cost, and artifacts
              </p>
            </div>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="border-b border-border bg-muted px-6">
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
              const count = s === 'all' ? submissions.length : (statusCounts[s] ?? 0);
              return (
                <Button
                  key={s}
                  type="button"
                  appearance="ghost"
                  variant={filter === s ? 'brand' : 'neutral'}
                  size="sm"
                  onClick={() => setFilter(s)}
                  className={`h-auto whitespace-nowrap rounded-none border-b-2 px-4 py-3 text-sm font-medium ${
                    filter === s
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)} ({count})
                </Button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <TaskTableSkeleton />
          ) : error ? (
            <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
              Failed to load tasks: {error.message}
            </div>
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              title="No tasks found"
              description={
                filter !== 'all' ? 'Try a different filter' : 'Submit a task from the marketplace'
              }
              action={<LinkButton href="/marketplace">Browse Agents</LinkButton>}
            />
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  apiUrl={apiUrl}
                  isExpanded={selectedTask === task.id}
                  onToggle={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
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
}: {
  task: TaskSubmissionRecord;
  apiUrl: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll the transient progress endpoint while the task is running.
  // The task's status field itself arrives via Electric live sync — no polling needed for that.
  useEffect(() => {
    if (task.status !== 'running') return;

    function poll() {
      fetch(`${apiUrl}/api/revmarket/tasks/${task.id}/progress`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data: TaskProgress) => setProgress(data))
        .catch(() => {
          /* ignore transient polling errors */
        });
    }

    poll();
    pollRef.current = setInterval(poll, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [apiUrl, task.id, task.status]);

  return (
    <Card>
      {/* Row header */}
      <Button
        type="button"
        appearance="ghost"
        variant="neutral"
        onClick={onToggle}
        className="flex h-auto w-full items-center gap-4 rounded-none px-4 py-3 text-left hover:bg-muted"
      >
        <Badge color={STATUS_BADGE_COLORS[task.status] ?? 'muted'}>{task.status}</Badge>
        <span className="flex-1 truncate text-sm text-foreground">{task.skill_name}</span>
        <span className="text-xs text-muted-foreground">P{task.priority}</span>
        {task.cost_usdc && <span className="text-xs text-muted-foreground">${task.cost_usdc}</span>}
        <span className="text-xs text-muted-foreground">
          {new Date(task.created_at).toLocaleDateString()}
        </span>
        <span
          className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </Button>

      {/* Progress bar for running tasks */}
      {task.status === 'running' && progress && progress.progress > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{progress.progress}%</span>
          </div>
          {progress.message && (
            <p className="mt-1 text-xs text-muted-foreground">{progress.message}</p>
          )}
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Task ID:</span>{' '}
              <span className="font-mono text-xs text-foreground">{task.id}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Agent:</span>{' '}
              <span className="text-foreground">{task.agent_id ?? 'Unassigned'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{' '}
              <span className="text-foreground">{new Date(task.created_at).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated:</span>{' '}
              <span className="text-foreground">{new Date(task.updated_at).toLocaleString()}</span>
            </div>
          </div>

          {/* Error message */}
          {task.error_message && (
            <div className="rounded border border-error/30 bg-error/10 p-3 text-sm text-error">
              {task.error_message}
            </div>
          )}

          {/* Output */}
          {task.output && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Output:</p>
              <pre className="overflow-x-auto rounded bg-muted p-3 text-xs text-muted-foreground">
                {JSON.stringify(task.output, null, 2)}
              </pre>
            </div>
          )}

          {/* Artifacts */}
          {task.artifacts.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Artifacts:</p>
              <div className="space-y-1">
                {task.artifacts.map((artifact) => (
                  <a
                    key={artifact.url}
                    href={artifact.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded border border-border bg-muted px-3 py-2 text-sm text-primary hover:text-primary/80"
                  >
                    {artifact.name} ({artifact.mimeType})
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

function TaskTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
        <Skeleton key={i} className="h-12 rounded-lg" />
      ))}
    </div>
  );
}
