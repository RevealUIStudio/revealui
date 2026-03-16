'use client';

import { useShape } from '@electric-sql/react';
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import type { MutationResult } from '../mutations.js';
import { useSyncMutations } from '../mutations.js';
import { useElectricConfig } from '../provider/index.js';
import { toRecords } from '../shape-utils.js';

export interface CoordinationSessionRecord {
  id: string;
  agent_id: string;
  started_at: string;
  ended_at: string | null;
  task: string;
  status: string;
  pid: number | null;
  tools: Record<string, number> | null;
  metadata: Record<string, unknown> | null;
}

export interface CreateCoordinationSessionInput {
  agent_id: string;
  task?: string;
  pid?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateCoordinationSessionInput {
  task?: string;
  status?: string;
  ended_at?: string;
  tools?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface UseCoordinationSessionsResult {
  sessions: CoordinationSessionRecord[];
  isLoading: boolean;
  error: Error | null;
  create: (
    data: CreateCoordinationSessionInput,
  ) => Promise<MutationResult<CoordinationSessionRecord>>;
  update: (
    id: string,
    data: UpdateCoordinationSessionInput,
  ) => Promise<MutationResult<CoordinationSessionRecord>>;
  remove: (id: string) => Promise<MutationResult<void>>;
}

export function useCoordinationSessions(): UseCoordinationSessionsResult {
  const { proxyBaseUrl } = useElectricConfig();
  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/coordination-sessions`,
    fetchClient: fetchWithTimeout,
  });

  const { create, update, remove } = useSyncMutations<
    CreateCoordinationSessionInput,
    UpdateCoordinationSessionInput,
    CoordinationSessionRecord
  >('coordination-sessions');

  return {
    sessions: toRecords<CoordinationSessionRecord>(data),
    isLoading,
    error: error || null,
    create,
    update,
    remove,
  };
}
