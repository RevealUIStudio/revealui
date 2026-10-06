/**
 * Per-request embedding client for admin routes.
 *
 * Uses the same resolver as chat: per-account key on hosted, deployment env
 * on forge. A missing hosted key is a 409, never an env model key.
 */

import { isHostedDeployment } from '@revealui/core/deployment-mode';
import { getClient } from '@revealui/db/client';
import { NextResponse } from 'next/server';

export async function resolveRequestEmbeddingClient(userId: string, workspaceId?: string) {
  let llmMod: typeof import('@revealui/ai/llm/server');
  try {
    llmMod = await import('@revealui/ai/llm/server');
  } catch {
    return null;
  }
  if (typeof llmMod.resolveLLMClientForRequest !== 'function') return null;
  return llmMod.resolveLLMClientForRequest(userId, getClient(), {
    isHosted: isHostedDeployment(process.env),
    ...(workspaceId ? { workspaceId } : {}),
  });
}

/** 409 body when the account has no usable provider key. Null for other errors. */
export function embeddingNotConfiguredResponse(err: unknown): NextResponse | null {
  if (!err || typeof err !== 'object') return null;
  if ((err as { code?: unknown }).code !== 'LLM_NOT_CONFIGURED') return null;
  const message =
    err instanceof Error ? err.message : 'No LLM provider is configured for this account.';
  const settingsPath = (err as { settingsPath?: unknown }).settingsPath;
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'LLM_NOT_CONFIGURED' as const,
      settingsPath: typeof settingsPath === 'string' ? settingsPath : '/settings/api-keys',
    },
    { status: 409 },
  );
}
