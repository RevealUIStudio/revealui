'use client';

import { useAgentContexts } from '@revealui/sync';

interface AgentContextsProps {
  agentId: string;
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AgentContexts({ agentId }: AgentContextsProps) {
  const { contexts, isLoading, error } = useAgentContexts();

  const agentContexts = contexts.filter((c) => c.agent_id === agentId);

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400"
      >
        Failed to load agent contexts
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex h-10 items-center justify-center"
        role="status"
        aria-label="Loading contexts"
      >
        <div className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-zinc-300" />
      </div>
    );
  }

  if (agentContexts.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-zinc-600">No active contexts for this agent.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {agentContexts.map((ctx) => (
        <li key={ctx.id} className="rounded-lg border border-zinc-800 p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-400">
              priority {ctx.priority}
            </span>
            <span className="text-xs text-zinc-600">{formatRelativeTime(ctx.created_at)}</span>
          </div>
          {Object.keys(ctx.context).length > 0 ? (
            <pre className="overflow-auto rounded bg-zinc-950 p-2 font-mono text-xs text-zinc-300">
              {JSON.stringify(ctx.context, null, 2)}
            </pre>
          ) : (
            <p className="text-xs text-zinc-600">empty context</p>
          )}
        </li>
      ))}
    </ul>
  );
}
