'use client';

import { useShape } from '@electric-sql/react';
import type { MutationResult } from '../mutations.js';
import { useSyncMutations } from '../mutations.js';
import { useElectricConfig } from '../provider/index.js';

export interface AgentContextRecord {
  id: string;
  session_id: string;
  agent_id: string;
  context: Record<string, unknown>;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentContextInput {
  agent_id: string;
  context?: Record<string, unknown>;
  priority?: number;
}

export interface UpdateAgentContextInput {
  context?: Record<string, unknown>;
  priority?: number;
}

export interface UseAgentContextsResult {
  contexts: AgentContextRecord[];
  isLoading: boolean;
  error: Error | null;
  create: (data: CreateAgentContextInput) => Promise<MutationResult<AgentContextRecord>>;
  update: (
    id: string,
    data: UpdateAgentContextInput,
  ) => Promise<MutationResult<AgentContextRecord>>;
  remove: (id: string) => Promise<MutationResult<void>>;
}

export function useAgentContexts(): UseAgentContextsResult {
  const { proxyBaseUrl } = useElectricConfig();
  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/agent-contexts`,
  });

  const { create, update, remove } = useSyncMutations<
    CreateAgentContextInput,
    UpdateAgentContextInput,
    AgentContextRecord
  >('agent-contexts');

  return {
    contexts: Array.isArray(data) ? (data as unknown as AgentContextRecord[]) : [],
    isLoading,
    error: error as Error | null,
    create,
    update,
    remove,
  };
}
