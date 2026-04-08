/**
 * useWorkingMemory Hook
 *
 * React hook for managing working memory in client components.
 */

import { useCallback, useEffect, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface UseWorkingMemoryOptions {
  autoSync?: boolean;
  syncInterval?: number; // milliseconds
}

export interface UseWorkingMemoryReturn {
  context: Record<string, unknown>;
  setContext: (context: Record<string, unknown>) => Promise<void>;
  updateContext: (updates: Partial<Record<string, unknown>>) => Promise<void>;
  getContextValue: (key: string) => unknown;
  setContextValue: (key: string, value: unknown) => Promise<void>;
  sessionState: {
    status: 'active' | 'paused' | 'completed';
    focus?: {
      siteId?: string;
      pageId?: string;
      blockId?: string;
      selection?: string[];
    };
    currentTask?: {
      id: string;
      description: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      progress?: number;
    };
  };
  updateSessionState: (state: Partial<UseWorkingMemoryReturn['sessionState']>) => Promise<void>;
  activeAgents: Array<{
    id: string;
    name: string;
    description: string;
    model: string;
    systemPrompt: string;
    tools: unknown[];
    capabilities: string[];
    temperature: number;
    maxTokens: number;
  }>;
  addAgent: (agent: UseWorkingMemoryReturn['activeAgents'][0]) => Promise<void>;
  removeAgent: (agentId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  sync: () => Promise<void>;
}

type ActiveAgent = UseWorkingMemoryReturn['activeAgents'][0];
type SessionStatus = 'active' | 'paused' | 'completed';
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSessionStatus = (value: unknown): value is SessionStatus =>
  value === 'active' || value === 'paused' || value === 'completed';

const isTaskStatus = (value: unknown): value is TaskStatus =>
  value === 'pending' || value === 'running' || value === 'completed' || value === 'failed';

const isActiveAgent = (value: unknown): value is ActiveAgent => {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    typeof value.model === 'string' &&
    typeof value.systemPrompt === 'string' &&
    Array.isArray(value.tools) &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every((capability) => typeof capability === 'string') &&
    typeof value.temperature === 'number' &&
    typeof value.maxTokens === 'number'
  );
};

const parseSessionState = (value: unknown): UseWorkingMemoryReturn['sessionState'] => {
  if (!isRecord(value)) {
    return { status: 'active' };
  }

  const status = isSessionStatus(value.status) ? value.status : 'active';
  const sessionState: UseWorkingMemoryReturn['sessionState'] = { status };

  if (isRecord(value.focus)) {
    const focusValue = value.focus;
    const selection = Array.isArray(focusValue.selection)
      ? focusValue.selection.filter((item): item is string => typeof item === 'string')
      : undefined;

    const focus = {
      siteId: typeof focusValue.siteId === 'string' ? focusValue.siteId : undefined,
      pageId: typeof focusValue.pageId === 'string' ? focusValue.pageId : undefined,
      blockId: typeof focusValue.blockId === 'string' ? focusValue.blockId : undefined,
      selection: selection && selection.length > 0 ? selection : undefined,
    };

    if (focus.siteId || focus.pageId || focus.blockId || focus.selection) {
      sessionState.focus = focus;
    }
  }

  if (isRecord(value.currentTask)) {
    const taskValue = value.currentTask;
    const id = typeof taskValue.id === 'string' ? taskValue.id : undefined;
    const description =
      typeof taskValue.description === 'string' ? taskValue.description : undefined;
    let taskStatus: TaskStatus | undefined;
    if (isTaskStatus(taskValue.status)) {
      taskStatus = taskValue.status;
    }
    const progress = typeof taskValue.progress === 'number' ? taskValue.progress : undefined;

    if (id && description && taskStatus) {
      sessionState.currentTask = {
        id,
        description,
        status: taskStatus,
        progress,
      };
    }
  }

  return sessionState;
};

const parseContextPayload = (payload: unknown): Record<string, unknown> => {
  if (!isRecord(payload)) return {};
  return isRecord(payload.context) ? payload.context : {};
};

const parseSessionPayload = (payload: unknown): UseWorkingMemoryReturn['sessionState'] => {
  if (!isRecord(payload)) return { status: 'active' };
  return parseSessionState(payload.sessionState);
};

const parseActiveAgentsPayload = (payload: unknown): UseWorkingMemoryReturn['activeAgents'] => {
  if (!isRecord(payload)) return [];
  return Array.isArray(payload.activeAgents) ? payload.activeAgents.filter(isActiveAgent) : [];
};

const parseWorkingPayload = (
  payload: unknown,
): {
  context: Record<string, unknown>;
  sessionState: UseWorkingMemoryReturn['sessionState'];
  activeAgents: UseWorkingMemoryReturn['activeAgents'];
} => ({
  context: parseContextPayload(payload),
  sessionState: parseSessionPayload(payload),
  activeAgents: parseActiveAgentsPayload(payload),
});

// =============================================================================
// Hook
// =============================================================================

/**
 * React hook for working memory management.
 *
 * @param sessionId - Session identifier
 * @param options - Hook options
 * @returns Working memory state and operations
 */
export function useWorkingMemory(
  sessionId: string,
  options: UseWorkingMemoryOptions = {},
): UseWorkingMemoryReturn {
  const { autoSync = false, syncInterval = 5000 } = options;

  const [context, setContextState] = useState<Record<string, unknown>>({});
  const [sessionState, setSessionStateState] = useState<UseWorkingMemoryReturn['sessionState']>({
    status: 'active',
  });
  const [activeAgents, setActiveAgents] = useState<UseWorkingMemoryReturn['activeAgents']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load initial state
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/memory/working/${sessionId}`);
        if (!response.ok) {
          throw new Error(`Failed to load working memory: ${response.statusText}`);
        }

        const payload = (await response.json()) as unknown;
        if (!mounted) return;

        const parsed = parseWorkingPayload(payload);
        setContextState(parsed.context);
        setSessionStateState(parsed.sessionState);
        setActiveAgents(parsed.activeAgents);
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
  }, [sessionId]);

  // Sync function
  const sync = useCallback(async () => {
    try {
      const response = await fetch(`/api/memory/working/${sessionId}`);
      if (!response.ok) {
        throw new Error(`Failed to sync working memory: ${response.statusText}`);
      }

      const payload = (await response.json()) as unknown;
      const parsed = parseWorkingPayload(payload);
      setContextState(parsed.context);
      setSessionStateState(parsed.sessionState);
      setActiveAgents(parsed.activeAgents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    }
  }, [sessionId]);

  // Auto-sync
  useEffect(() => {
    if (!autoSync) return;

    const interval = setInterval(() => {
      void sync();
    }, syncInterval);

    return () => clearInterval(interval);
  }, [autoSync, syncInterval, sync]);

  // Set context
  const setContext = useCallback(
    async (newContext: Record<string, unknown>) => {
      try {
        setError(null);
        const response = await fetch(`/api/memory/working/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: newContext }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update context: ${response.statusText}`);
        }

        const payload = (await response.json()) as unknown;
        setContextState(parseContextPayload(payload));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [sessionId],
  );

  // Update context
  const updateContext = useCallback(
    async (updates: Partial<Record<string, unknown>>) => {
      const newContext = { ...context, ...updates };
      await setContext(newContext);
    },
    [context, setContext],
  );

  // Get context value
  const getContextValue = useCallback(
    (key: string): unknown => {
      return context[key];
    },
    [context],
  );

  // Set context value
  const setContextValue = useCallback(
    async (key: string, value: unknown) => {
      await updateContext({ [key]: value });
    },
    [updateContext],
  );

  // Update session state
  const updateSessionState = useCallback(
    async (state: Partial<UseWorkingMemoryReturn['sessionState']>) => {
      try {
        setError(null);
        const response = await fetch(`/api/memory/working/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionState: state }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update session state: ${response.statusText}`);
        }

        const payload = (await response.json()) as unknown;
        setSessionStateState(parseSessionPayload(payload));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [sessionId],
  );

  // Add agent
  const addAgent = useCallback(
    async (agent: UseWorkingMemoryReturn['activeAgents'][0]) => {
      try {
        setError(null);
        const newAgents = [...activeAgents, agent];
        const response = await fetch(`/api/memory/working/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activeAgents: newAgents }),
        });

        if (!response.ok) {
          throw new Error(`Failed to add agent: ${response.statusText}`);
        }

        const payload = (await response.json()) as unknown;
        setActiveAgents(parseActiveAgentsPayload(payload));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [sessionId, activeAgents],
  );

  // Remove agent
  const removeAgent = useCallback(
    async (agentId: string) => {
      try {
        setError(null);
        const newAgents = activeAgents.filter((agent) => agent.id !== agentId);
        const response = await fetch(`/api/memory/working/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activeAgents: newAgents }),
        });

        if (!response.ok) {
          throw new Error(`Failed to remove agent: ${response.statusText}`);
        }

        const payload = (await response.json()) as unknown;
        setActiveAgents(parseActiveAgentsPayload(payload));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [sessionId, activeAgents],
  );

  return {
    context,
    setContext,
    updateContext,
    getContextValue,
    setContextValue,
    sessionState,
    updateSessionState,
    activeAgents,
    addAgent,
    removeAgent,
    isLoading,
    error,
    sync,
  };
}
