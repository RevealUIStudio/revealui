'use client';

import { useShape } from '@electric-sql/react';
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import type { MutationResult } from '../mutations.js';
import { useSyncMutations } from '../mutations.js';
import { useElectricConfig } from '../provider/index.js';

export interface CoordinationWorkItemRecord {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  owner_agent: string | null;
  owner_session: string | null;
  parent_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreateCoordinationWorkItemInput {
  title: string;
  description?: string;
  priority?: number;
  owner_agent?: string;
  parent_id?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCoordinationWorkItemInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: number;
  owner_agent?: string;
  metadata?: Record<string, unknown>;
}

export interface UseCoordinationWorkItemsResult {
  workItems: CoordinationWorkItemRecord[];
  isLoading: boolean;
  error: Error | null;
  create: (
    data: CreateCoordinationWorkItemInput,
  ) => Promise<MutationResult<CoordinationWorkItemRecord>>;
  update: (
    id: string,
    data: UpdateCoordinationWorkItemInput,
  ) => Promise<MutationResult<CoordinationWorkItemRecord>>;
  remove: (id: string) => Promise<MutationResult<void>>;
}

export function useCoordinationWorkItems(): UseCoordinationWorkItemsResult {
  const { proxyBaseUrl } = useElectricConfig();
  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/coordination-work-items`,
    fetchClient: fetchWithTimeout,
  });

  const { create, update, remove } = useSyncMutations<
    CreateCoordinationWorkItemInput,
    UpdateCoordinationWorkItemInput,
    CoordinationWorkItemRecord
  >('coordination-work-items');

  return {
    workItems: Array.isArray(data) ? (data as unknown as CoordinationWorkItemRecord[]) : [],
    isLoading,
    error: error as Error | null,
    create,
    update,
    remove,
  };
}
