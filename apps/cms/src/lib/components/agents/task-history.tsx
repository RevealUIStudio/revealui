'use client';

import { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config/api';

interface AgentActionRow {
  id: string;
  agentId: string;
  tool: string;
  params: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

interface TaskHistoryProps {
  agentId: string;
  /** Increment to trigger a refresh */
  refreshKey?: number;
}

/**
 * Displays the last 20 completed A2A tasks for an agent.
 * Fetches from GET /a2a/agents/:id/tasks.
 */
export function TaskHistory({ agentId, refreshKey }: TaskHistoryProps) {
  const [rows, setRows] = useState<AgentActionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = getApiUrl();

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an intentional re-fetch trigger passed from parent
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(`${apiUrl}/a2a/agents/${encodeURIComponent(agentId)}/tasks`, {
          credentials: 'include',
        });
        if (!r.ok) {
          if (!cancelled) setRows([]);
          return;
        }
        const data: unknown = await r.json();
        const tasks =
          data !== null &&
          typeof data === 'object' &&
          'tasks' in data &&
          Array.isArray((data as { tasks: unknown }).tasks)
            ? (data as { tasks: AgentActionRow[] }).tasks
            : [];
        if (!cancelled) setRows(tasks);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, apiUrl, refreshKey]);

  if (loading) {
    return (
      <div className="flex h-16 items-center justify-center">
        <div
          className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300"
          aria-hidden="true"
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-600">No tasks recorded yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const inputText = extractText(row.params);
        const outputText = extractResultText(row.result);
        const ts = new Date(row.startedAt).toLocaleString();

        return (
          <li key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <StatusBadge status={row.status} />
              <span className="ml-auto shrink-0 font-mono text-xs text-zinc-600">{ts}</span>
              {row.durationMs != null && (
                <span className="shrink-0 text-xs text-zinc-600">{row.durationMs}ms</span>
              )}
            </div>
            {inputText && (
              <p className="mt-2 truncate text-xs text-zinc-400">
                <span className="text-zinc-600">in: </span>
                {inputText}
              </p>
            )}
            {outputText && (
              <p className="mt-0.5 truncate text-xs text-zinc-300">
                <span className="text-zinc-600">out: </span>
                {outputText}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400',
    failed: 'bg-red-500/10 text-red-400',
    cancelled: 'bg-zinc-600/20 text-zinc-400',
  };
  const color = colors[status] ?? 'bg-zinc-700/20 text-zinc-400';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>;
}

/** Pull the user text from the tasks/send params */
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

/** Pull the agent response text from the A2ATask result */
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
