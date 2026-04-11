/**
 * useEpisodicMemory Hook
 *
 * React hook for managing episodic memory in client components.
 */

import type { AgentMemory } from '@revealui/contracts/agents';
import { useCallback, useEffect, useState } from 'react';
import { createAIError } from '../errors.js';

// =============================================================================
// Types
// =============================================================================

export interface UseEpisodicMemoryReturn {
  memories: AgentMemory[];
  addMemory: (memory: AgentMemory) => Promise<string>;
  removeMemory: (memoryId: string) => Promise<void>;
  getMemory: (memoryId: string) => AgentMemory | undefined;
  search: (query: string) => Promise<AgentMemory[]>;
  accessCount: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isAgentMemory = (value: unknown): value is AgentMemory => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && typeof value.content === 'string';
};

const parseEpisodicPayload = (
  payload: unknown,
): {
  memories: AgentMemory[];
  accessCount: number;
  tag?: string;
  memoryId?: string;
} => {
  if (!isRecord(payload)) {
    return { memories: [], accessCount: 0 };
  }

  const memories = Array.isArray(payload.memories) ? payload.memories.filter(isAgentMemory) : [];

  const accessCount = typeof payload.accessCount === 'number' ? payload.accessCount : 0;
  const tag = typeof payload.tag === 'string' ? payload.tag : undefined;
  const memoryId = typeof payload.memoryId === 'string' ? payload.memoryId : undefined;

  return { memories, accessCount, tag, memoryId };
};

// =============================================================================
// Hook
// =============================================================================

/**
 * React hook for episodic memory management.
 *
 * @param userId - User identifier
 * @returns Episodic memory state and operations
 */
export function useEpisodicMemory(userId: string): UseEpisodicMemoryReturn {
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [accessCount, setAccessCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load initial state
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/memory/episodic/${userId}`);
        if (!response.ok) {
          throw createAIError('load episodic memory', response.status, response.statusText);
        }

        const payload = (await response.json()) as unknown;
        if (!mounted) return;

        const parsed = parseEpisodicPayload(payload);
        setMemories(parsed.memories);
        setAccessCount(parsed.accessCount);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [userId]);

  // Refresh function
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/memory/episodic/${userId}`);
      if (!response.ok) {
        throw createAIError('refresh episodic memory', response.status, response.statusText);
      }

      const payload = (await response.json()) as unknown;
      const parsed = parseEpisodicPayload(payload);
      setMemories(parsed.memories);
      setAccessCount(parsed.accessCount);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Add memory
  const addMemory = useCallback(
    async (memory: AgentMemory): Promise<string> => {
      try {
        setError(null);
        const response = await fetch(`/api/memory/episodic/${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(memory),
        });

        if (!response.ok) {
          throw createAIError('add memory', response.status, response.statusText);
        }

        const payload = (await response.json()) as unknown;
        const parsed = parseEpisodicPayload(payload);

        // Refresh to get updated list
        await refresh();

        return parsed.tag ?? parsed.memoryId ?? memory.id;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [userId, refresh],
  );

  // Remove memory
  const removeMemory = useCallback(
    async (memoryId: string) => {
      try {
        setError(null);
        const response = await fetch(`/api/memory/episodic/${userId}/${memoryId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw createAIError('remove memory', response.status, response.statusText);
        }

        // Refresh to get updated list
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [userId, refresh],
  );

  // Get memory
  const getMemory = useCallback(
    (memoryId: string): AgentMemory | undefined => {
      return memories.find((m) => m.id === memoryId);
    },
    [memories],
  );

  // Search using vector similarity via API
  const search = useCallback(
    async (query: string): Promise<AgentMemory[]> => {
      try {
        const response = await fetch('/api/memory/search-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, options: { limit: 20, threshold: 0.5 } }),
        });

        if (!response.ok) {
          throw createAIError('search memory', response.status, response.statusText);
        }

        const data = (await response.json()) as {
          results?: Array<{ memory: AgentMemory; similarity: number }>;
        };

        if (data.results && Array.isArray(data.results)) {
          return data.results.map((r) => r.memory);
        }

        // Fallback to client-side filter if API returns unexpected format
        const lowerQuery = query.toLowerCase();
        return memories.filter((m) => m.content.toLowerCase().includes(lowerQuery));
      } catch {
        // Fallback to client-side text filter on error
        const lowerQuery = query.toLowerCase();
        return memories.filter((m) => m.content.toLowerCase().includes(lowerQuery));
      }
    },
    [memories],
  );

  return {
    memories,
    addMemory,
    removeMemory,
    getMemory,
    search,
    accessCount,
    isLoading,
    error,
    refresh,
  };
}
