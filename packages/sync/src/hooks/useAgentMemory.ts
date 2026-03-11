'use client';

import { useShape } from '@electric-sql/react';
import type { MutationResult } from '../mutations.js';
import { useSyncMutations } from '../mutations.js';
import { useElectricConfig } from '../provider/index.js';

const AGENT_ID_RE = /^[a-zA-Z0-9_-]+$/;

export interface AgentMemoryRecord {
  id: string;
  agent_id: string;
  content: string;
  type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
}

export interface CreateAgentMemoryInput {
  agent_id: string;
  content: string;
  type: string;
  source: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  expires_at?: string | null;
}

export interface UpdateAgentMemoryInput {
  content?: string;
  type?: string;
  metadata?: Record<string, unknown>;
  expires_at?: string | null;
}

export interface UseAgentMemoryResult {
  memories: AgentMemoryRecord[];
  isLoading: boolean;
  error: Error | null;
  create: (data: CreateAgentMemoryInput) => Promise<MutationResult<AgentMemoryRecord>>;
  update: (id: string, data: UpdateAgentMemoryInput) => Promise<MutationResult<AgentMemoryRecord>>;
  remove: (id: string) => Promise<MutationResult<void>>;
}

export function useAgentMemory(agentId: string): UseAgentMemoryResult {
  const { proxyBaseUrl } = useElectricConfig();
  const isValid = agentId.length > 0 && AGENT_ID_RE.test(agentId);

  // Hook must always be called (Rules of Hooks). Pass an impossible WHERE when
  // the ID is invalid so the shape returns no rows but the hook still runs.
  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/agent-memories`,
    params: { agent_id: isValid ? agentId : '00000000-0000-0000-0000-000000000000' },
  });

  const { create, update, remove } = useSyncMutations<
    CreateAgentMemoryInput,
    UpdateAgentMemoryInput,
    AgentMemoryRecord
  >('agent-memories');

  if (!isValid) {
    return {
      memories: [],
      isLoading: false,
      error: new Error(
        'Invalid agentId: must be non-empty alphanumeric, hyphens, underscores only',
      ),
      create,
      update,
      remove,
    };
  }

  return {
    memories: Array.isArray(data) ? (data as unknown as AgentMemoryRecord[]) : [],
    isLoading,
    error: error as Error | null,
    create,
    update,
    remove,
  };
}
