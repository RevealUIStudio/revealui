'use client';

import { useShape } from '@electric-sql/react';
import type { MutationResult } from '../mutations.js';
import { useSyncMutations } from '../mutations.js';
import { useElectricConfig } from '../provider/index.js';

export interface ConversationRecord {
  id: string;
  user_id: string;
  agent_id: string;
  title?: string | null;
  status: string;
  device_id?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CreateConversationInput {
  agent_id: string;
  title?: string;
  device_id?: string;
}

export interface UpdateConversationInput {
  title?: string;
  status?: string;
}

export interface UseConversationsResult {
  conversations: ConversationRecord[];
  isLoading: boolean;
  error: Error | null;
  create: (data: CreateConversationInput) => Promise<MutationResult<ConversationRecord>>;
  update: (
    id: string,
    data: UpdateConversationInput,
  ) => Promise<MutationResult<ConversationRecord>>;
  remove: (id: string) => Promise<MutationResult<void>>;
}

// _userId kept for API compatibility — filtering is enforced by the server-side
// proxy at /api/shapes/conversations, which reads the session cookie directly.
export function useConversations(_userId: string): UseConversationsResult {
  const { proxyBaseUrl } = useElectricConfig();
  // The proxy validates the session and enforces row-level filtering server-side.
  // Client-provided params are not forwarded — the proxy overrides them.
  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/conversations`,
  });

  const { create, update, remove } = useSyncMutations<
    CreateConversationInput,
    UpdateConversationInput,
    ConversationRecord
  >('conversations');

  return {
    conversations: Array.isArray(data) ? (data as unknown as ConversationRecord[]) : [],
    isLoading,
    error: error as Error | null,
    create,
    update,
    remove,
  };
}
