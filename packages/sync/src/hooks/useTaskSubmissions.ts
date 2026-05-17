'use client';

import { useShape } from '@electric-sql/react';
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import type { MutationResult } from '../mutations.js';
import { useSyncMutations } from '../mutations.js';
import { useElectricConfig } from '../provider/index.js';
import { toRecords } from '../shape-utils.js';

export interface TaskSubmissionRecord {
  id: string;
  submitter_id: string;
  agent_id: string | null;
  skill_name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  artifacts: Array<{ name: string; url: string; mimeType: string }>;
  status: string;
  priority: number;
  cost_usdc: string | null;
  payment_method: string | null;
  execution_meta: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskSubmissionInput {
  skill_name: string;
  input: Record<string, unknown>;
  priority?: number;
}

export interface UpdateTaskSubmissionInput {
  status?: string;
}

export interface UseTaskSubmissionsResult {
  submissions: TaskSubmissionRecord[];
  isLoading: boolean;
  error: Error | null;
  create: (data: CreateTaskSubmissionInput) => Promise<MutationResult<TaskSubmissionRecord>>;
  update: (
    id: string,
    data: UpdateTaskSubmissionInput,
  ) => Promise<MutationResult<TaskSubmissionRecord>>;
  remove: (id: string) => Promise<MutationResult<void>>;
}

export function useTaskSubmissions(): UseTaskSubmissionsResult {
  const { proxyBaseUrl } = useElectricConfig();
  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/task-submissions`,
    fetchClient: fetchWithTimeout,
  });

  const { create, update, remove } = useSyncMutations<
    CreateTaskSubmissionInput,
    UpdateTaskSubmissionInput,
    TaskSubmissionRecord
  >('task-submissions');

  return {
    submissions: toRecords<TaskSubmissionRecord>(data),
    isLoading,
    error: error || null,
    create,
    update,
    remove,
  };
}
