'use client';

import { Button } from '@revealui/presentation';
import { useAgentMemory } from '@revealui/sync';
import { useState } from 'react';

interface AgentMemoryProps {
  agentId: string;
}

interface MemoryTypeInfo {
  label: string;
  color: string;
}

interface EnrichedMemory {
  id: string;
  type: string;
  content: string;
  created_at: string;
  expires_at?: string | null;
  typeInfo: MemoryTypeInfo;
  isExpired: boolean;
}

const MEMORY_TYPE_LABELS: Record<string, MemoryTypeInfo> = {
  episodic: { label: 'Episodic', color: 'text-primary bg-primary/10' },
  semantic: { label: 'Semantic', color: 'text-accent-foreground bg-accent/10' },
  working: { label: 'Working', color: 'text-warning-foreground bg-warning/15' },
} as const;

const FALLBACK_TYPE_INFO: MemoryTypeInfo = {
  label: '',
  color: 'text-muted-foreground bg-muted',
};

function isMemoryExpired(expiresAt: string | null | undefined): boolean {
  return !!expiresAt && new Date(expiresAt) < new Date();
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

/**
 * Real-time agent memory viewer powered by @revealui/sync.
 * Displays episodic, semantic, and working memories with live updates
 * via ElectricSQL shape subscriptions.
 */
export function AgentMemory({ agentId }: AgentMemoryProps) {
  const { memories, isLoading, error, remove } = useAgentMemory(agentId);
  const [filter, setFilter] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Compute type counts and filtered+enriched list in a single pass
  const typeCounts: Record<string, number> = {};
  const filteredEnriched: EnrichedMemory[] = [];

  for (const memory of memories) {
    typeCounts[memory.type] = (typeCounts[memory.type] ?? 0) + 1;

    if (filter === null || memory.type === filter) {
      filteredEnriched.push({
        ...memory,
        typeInfo: MEMORY_TYPE_LABELS[memory.type] ?? {
          ...FALLBACK_TYPE_INFO,
          label: memory.type,
        },
        isExpired: isMemoryExpired(memory.expires_at),
      });
    }
  }

  const sorted = filteredEnriched.toSorted(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await remove(id);
    } finally {
      setRemovingId(null);
    }
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error"
      >
        Failed to load agent memory
      </div>
    );
  }

  return (
    <div>
      {/* Filter chips — Tabs primitive not applicable: "All" requires null active value */}
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            filter === null
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All ({memories.length})
        </button>
        {Object.entries(MEMORY_TYPE_LABELS).map(([type, { label }]) => (
          <button
            key={type}
            type="button"
            onClick={() => setFilter(filter === type ? null : type)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === type
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label} ({typeCounts[type] ?? 0})
          </button>
        ))}
        {isLoading && (
          <div
            className="ml-auto h-3 w-3 animate-spin rounded-full border border-border border-t-foreground"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Memory list */}
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {isLoading ? 'Loading memories...' : 'No memories recorded yet.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((memory) => (
            <li
              key={memory.id}
              className={`group rounded-lg border border-border p-3 transition-colors hover:border-border ${
                memory.isExpired ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    {/* Memory type pills use accent/warning tones not in Badge — left as handroll */}
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${memory.typeInfo.color}`}
                    >
                      {memory.typeInfo.label}
                    </span>
                    {memory.isExpired && (
                      <span className="text-xs text-muted-foreground">expired</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(memory.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">{memory.content}</p>
                </div>
                <Button
                  type="button"
                  onClick={() => handleRemove(memory.id)}
                  disabled={removingId === memory.id}
                  appearance="ghost"
                  variant="neutral"
                  size="icon"
                  className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-error disabled:opacity-50"
                  title="Delete memory"
                  aria-label="Delete memory"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
