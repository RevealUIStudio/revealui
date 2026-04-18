'use client';

import { useShape } from '@electric-sql/react';
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import type { MutationResult } from '../mutations.js';
import { useSyncMutations } from '../mutations.js';
import { useElectricConfig } from '../provider/index.js';
import { toRecords } from '../shape-utils.js';

const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;

export interface SharedFactRecord {
  id: string;
  session_id: string;
  agent_id: string;
  content: string;
  fact_type: string;
  confidence: number;
  tags: string[];
  source_ref: Record<string, unknown> | null;
  superseded_by: string | null;
  created_at: string;
}

export interface CreateSharedFactInput {
  session_id: string;
  agent_id: string;
  content: string;
  fact_type: string;
  confidence?: number;
  tags?: string[];
  source_ref?: Record<string, unknown>;
}

export interface UpdateSharedFactInput {
  confidence?: number;
  tags?: string[];
  superseded_by?: string | null;
}

export interface UseSharedFactsResult {
  facts: SharedFactRecord[];
  isLoading: boolean;
  error: Error | null;
  publish: (data: CreateSharedFactInput) => Promise<MutationResult<SharedFactRecord>>;
  update: (id: string, data: UpdateSharedFactInput) => Promise<MutationResult<SharedFactRecord>>;
  remove: (id: string) => Promise<MutationResult<void>>;
}

export function useSharedFacts(sessionId: string): UseSharedFactsResult {
  const { proxyBaseUrl } = useElectricConfig();
  const isValid = sessionId.length > 0 && SESSION_ID_RE.test(sessionId);

  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/shared-facts`,
    params: { session_id: isValid ? sessionId : '00000000-0000-0000-0000-000000000000' },
    fetchClient: fetchWithTimeout,
  });

  const {
    create: publish,
    update,
    remove,
  } = useSyncMutations<CreateSharedFactInput, UpdateSharedFactInput, SharedFactRecord>(
    'shared-facts',
  );

  if (!isValid) {
    return {
      facts: [],
      isLoading: false,
      error: new Error(
        'Invalid sessionId: must be non-empty alphanumeric, hyphens, underscores only',
      ),
      publish,
      update,
      remove,
    };
  }

  return {
    facts: toRecords<SharedFactRecord>(data),
    isLoading,
    error: error || null,
    publish,
    update,
    remove,
  };
}
