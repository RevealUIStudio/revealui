/**
 * useAgentContext Hook
 *
 * React hook for managing agent context in client components.
 * Wraps AgentContextManager for client-side usage.
 */

import { useCallback, useEffect, useState } from 'react';
import { createAIError } from '../errors.js';

// =============================================================================
// Types
// =============================================================================

export interface UseAgentContextOptions {
  autoSync?: boolean;
  syncInterval?: number; // milliseconds
}

export interface UseAgentContextReturn {
  context: Record<string, unknown>;
  getContext: (key: string) => unknown;
  setContext: (key: string, value: unknown) => Promise<void>;
  updateContext: (updates: Partial<Record<string, unknown>>) => Promise<void>;
  removeContext: (key: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  sync: () => Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseContextPayload = (payload: unknown): Record<string, unknown> => {
  if (!isRecord(payload)) return {};
  const { context } = payload;
  return isRecord(context) ? context : {};
};

// =============================================================================
// Hook
// =============================================================================

/**
 * React hook for agent context management.
 *
 * @param sessionId - Session identifier
 * @param agentId - Agent identifier
 * @param options - Hook options
 * @returns Agent context state and operations
 */
export function useAgentContext(
  sessionId: string,
  agentId: string,
  options: UseAgentContextOptions = {},
): UseAgentContextReturn {
  const { autoSync = false, syncInterval = 5000 } = options;

  const [context, setContextState] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load initial state
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/memory/context/${sessionId}/${agentId}`);
        if (!response.ok) {
          throw createAIError('load agent context', response.status, response.statusText);
        }

        const payload = (await response.json()) as unknown;
        if (!mounted) return;

        setContextState(parseContextPayload(payload));
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
  }, [sessionId, agentId]);

  // Sync function
  const sync = useCallback(async () => {
    try {
      const response = await fetch(`/api/memory/context/${sessionId}/${agentId}`);
      if (!response.ok) {
        throw createAIError('sync agent context', response.status, response.statusText);
      }

      const payload = (await response.json()) as unknown;
      setContextState(parseContextPayload(payload));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    }
  }, [sessionId, agentId]);

  // Auto-sync
  useEffect(() => {
    if (!autoSync) return;

    const interval = setInterval(() => {
      void sync();
    }, syncInterval);

    return () => clearInterval(interval);
  }, [autoSync, syncInterval, sync]);

  // Get context value
  const getContext = useCallback(
    (key: string): unknown => {
      return context[key];
    },
    [context],
  );

  // Set context value
  const setContext = useCallback(
    async (key: string, value: unknown) => {
      try {
        setError(null);
        const response = await fetch(`/api/memory/context/${sessionId}/${agentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value }),
        });

        if (!response.ok) {
          throw createAIError('update context', response.status, response.statusText);
        }

        const payload = (await response.json()) as unknown;
        setContextState(parseContextPayload(payload));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [sessionId, agentId],
  );

  // Update context
  const updateContext = useCallback(
    async (updates: Partial<Record<string, unknown>>) => {
      try {
        setError(null);
        const response = await fetch(`/api/memory/context/${sessionId}/${agentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw createAIError('update context', response.status, response.statusText);
        }

        const payload = (await response.json()) as unknown;
        setContextState(parseContextPayload(payload));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [sessionId, agentId],
  );

  // Remove context key
  const removeContext = useCallback(
    async (key: string) => {
      try {
        setError(null);
        const response = await fetch(`/api/memory/context/${sessionId}/${agentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        });

        if (!response.ok) {
          throw createAIError('remove context key', response.status, response.statusText);
        }

        const payload = (await response.json()) as unknown;
        setContextState(parseContextPayload(payload));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [sessionId, agentId],
  );

  return {
    context,
    getContext,
    setContext,
    updateContext,
    removeContext,
    isLoading,
    error,
    sync,
  };
}
