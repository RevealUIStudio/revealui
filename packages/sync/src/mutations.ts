'use client';

import { useCallback } from 'react';
import { useElectricConfig } from './provider/index.js';

export interface MutationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Make an authenticated mutation request to the CMS API.
 * Credentials are included so the session cookie is sent cross-origin.
 */
async function mutationFetch<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<MutationResult<T>> {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
