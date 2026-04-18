'use client';

import { useShape } from '@electric-sql/react';
import { useCallback } from 'react';
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import type { MutationResult } from '../mutations.js';
import { useSyncMutations } from '../mutations.js';
import { useElectricConfig } from '../provider/index.js';
import { toRecords } from '../shape-utils.js';

const SESSION_SCOPE_RE = /^[a-zA-Z0-9_-]+$/;

export interface SharedMemoryRecord {
  id: string;
  content: string;
  type: string;
  agent_id: string | null;
  scope: string;
  session_scope: string | null;
  source_facts: string[];
  reconciled_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateSharedMemoryInput {
  agent_id: string;
  site_id: string;
  session_scope: string;
  content: string;
  type: string;
  source: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  source_facts?: string[];
}

export interface UpdateSharedMemoryInput {
  content?: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface UseSharedMemoriesResult {
  memories: SharedMemoryRecord[];
  isLoading: boolean;
  error: Error | null;
  share: (data: CreateSharedMemoryInput) => Promise<MutationResult<SharedMemoryRecord>>;
  update: (
    id: string,
    data: UpdateSharedMemoryInput,
  ) => Promise<MutationResult<SharedMemoryRecord>>;
  remove: (id: string) => Promise<MutationResult<void>>;
  triggerReconciliation: (sessionId: string, siteId: string) => Promise<MutationResult<unknown>>;
}

export function useSharedMemories(sessionScope: string): UseSharedMemoriesResult {
  const { proxyBaseUrl } = useElectricConfig();
  const isValid = sessionScope.length > 0 && SESSION_SCOPE_RE.test(sessionScope);

  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/shared-memories`,
    params: {
      session_scope: isValid ? sessionScope : '00000000-0000-0000-0000-000000000000',
    },
    fetchClient: fetchWithTimeout,
  });

  const {
    create: share,
    update,
    remove,
  } = useSyncMutations<CreateSharedMemoryInput, UpdateSharedMemoryInput, SharedMemoryRecord>(
    'shared-memories',
  );

  const triggerReconciliation = useCallback(
    async (sessionId: string, siteId: string): Promise<MutationResult<unknown>> => {
      const response = await fetch(`${proxyBaseUrl}/api/sync/reconcile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, site_id: siteId }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        return {
          success: false,
          error: errorData?.error ?? `Reconciliation failed with status ${response.status}`,
        };
      }

      const result = await response.json();
      return { success: true, data: result };
    },
    [proxyBaseUrl],
  );

  if (!isValid) {
    return {
      memories: [],
      isLoading: false,
      error: new Error(
        'Invalid sessionScope: must be non-empty alphanumeric, hyphens, underscores only',
      ),
      share,
      update,
      remove,
      triggerReconciliation,
    };
  }

  return {
    memories: toRecords<SharedMemoryRecord>(data),
    isLoading,
    error: error || null,
    share,
    update,
    remove,
    triggerReconciliation,
  };
}
