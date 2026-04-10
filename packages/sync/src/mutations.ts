'use client';

import { useCallback } from 'react';
import { useElectricConfig } from './provider/index.js';

/** Default timeout for mutation fetch requests (milliseconds). */
const MUTATION_FETCH_TIMEOUT_MS = 10_000;

export interface MutationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Make an authenticated mutation request to the admin API.
 * Credentials are included so the session cookie is sent cross-origin.
 * Requests are aborted after {@link MUTATION_FETCH_TIMEOUT_MS} (10 s).
 */
async function mutationFetch<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<MutationResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MUTATION_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      signal: controller.signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return {
      success: false,
      error: errorData?.error ?? `Request failed with status ${response.status}`,
    };
  }

  const data = (await response.json()) as T;
  return { success: true, data };
}

/**
 * Hook that returns mutation functions for a given sync API endpoint.
 */
export function useSyncMutations<TCreate, TUpdate, TRecord>(endpoint: string) {
  const { proxyBaseUrl } = useElectricConfig();
  const baseUrl = `${proxyBaseUrl}/api/sync/${endpoint}`;

  const create = useCallback(
    async (data: TCreate): Promise<MutationResult<TRecord>> => {
      return mutationFetch<TRecord>(baseUrl, 'POST', data);
    },
    [baseUrl],
  );

  const update = useCallback(
    async (id: string, data: TUpdate): Promise<MutationResult<TRecord>> => {
      return mutationFetch<TRecord>(`${baseUrl}/${encodeURIComponent(id)}`, 'PATCH', data);
    },
    [baseUrl],
  );

  const remove = useCallback(
    async (id: string): Promise<MutationResult<void>> => {
      return mutationFetch<void>(`${baseUrl}/${encodeURIComponent(id)}`, 'DELETE');
    },
    [baseUrl],
  );

  return { create, update, remove };
}
