/**
 * Lazy loaders for optional `@revealui/ai` (Pro peer).
 *
 * OSS / thin deploys omit the package; dynamic import must not crash cold start.
 * When the module is missing, responses must NOT claim the caller is on Free /
 * needs a Pro license — that message is reserved for real entitlement denial
 * (`requireFeature` / `requireAIAccess`). Import failure is a deployment fault
 * (503 AI_MODULE_UNAVAILABLE). Resolve failure after the module loads is a
 * 500 AI_RESOLVE_FAILED (or 409 LLM_NOT_CONFIGURED when typed that way).
 *
 * Same optional-peer pattern as `services-loader.ts`.
 */

import { logger } from '@revealui/core/observability/logger';
import { z } from '@revealui/openapi';

export const AI_MODULE_UNAVAILABLE_CODE = 'AI_MODULE_UNAVAILABLE' as const;
export const AI_RESOLVE_FAILED_CODE = 'AI_RESOLVE_FAILED' as const;

/** OpenAPI / Zod body for 503 AI_MODULE_UNAVAILABLE responses. */
export const AiModuleUnavailableBodySchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.literal(AI_MODULE_UNAVAILABLE_CODE),
});

/** OpenAPI / Zod body for 500 AI_RESOLVE_FAILED responses. */
export const AiResolveFailedBodySchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.literal(AI_RESOLVE_FAILED_CODE),
});

export const AI_MODULE_UNAVAILABLE_MESSAGE =
  'The AI runtime is not available in this deployment. This is a server configuration problem, not a Free-plan limit. Contact support if you are on Pro or Enterprise.';

export const AI_RESOLVE_FAILED_MESSAGE =
  'Could not start AI for this account. Check Settings → API keys, then try again. This is not a Free-plan limit.';

/** Machine-readable body when `@revealui/ai` failed to load. */
export interface AiModuleUnavailableBody {
  success: false;
  error: string;
  code: typeof AI_MODULE_UNAVAILABLE_CODE;
}

/** Machine-readable body when BYOK / client resolve failed (non-config). */
export interface AiResolveFailedBody {
  success: false;
  error: string;
  code: typeof AI_RESOLVE_FAILED_CODE;
}

export function aiModuleUnavailableBody(detail?: string): AiModuleUnavailableBody {
  return {
    success: false,
    error: detail?.trim()
      ? `${AI_MODULE_UNAVAILABLE_MESSAGE} (${detail})`
      : AI_MODULE_UNAVAILABLE_MESSAGE,
    code: AI_MODULE_UNAVAILABLE_CODE,
  };
}

export function aiResolveFailedBody(detail?: string): AiResolveFailedBody {
  return {
    success: false,
    error: detail?.trim() ? `${AI_RESOLVE_FAILED_MESSAGE} (${detail})` : AI_RESOLVE_FAILED_MESSAGE,
    code: AI_RESOLVE_FAILED_CODE,
  };
}

type AiRoot = typeof import('@revealui/ai');
type AiLlmClient = typeof import('@revealui/ai/llm/client');
type AiStreamingRuntime = typeof import('@revealui/ai/orchestration/streaming-runtime');

let aiRootPromise: Promise<AiRoot | null> | null = null;

/**
 * Cached root import of `@revealui/ai`. Logs once on failure (not per request).
 */
export function getAiModule(): Promise<AiRoot | null> {
  if (!aiRootPromise) {
    aiRootPromise = import('@revealui/ai').catch((err: unknown) => {
      logger.error('[ai-module-loader] @revealui/ai import failed', {
        message: err instanceof Error ? err.message : String(err),
      });
      return null;
    });
  }
  return aiRootPromise;
}

/** Load the three modules agent-stream needs. Any miss → null + logged. */
export async function loadAgentStreamAiModules(): Promise<{
  ai: AiRoot;
  llmClient: AiLlmClient;
  streamingRuntime: AiStreamingRuntime;
} | null> {
  const [ai, llmClient, streamingRuntime] = await Promise.all([
    getAiModule(),
    import('@revealui/ai/llm/client').catch((err: unknown) => {
      logger.error('[ai-module-loader] @revealui/ai/llm/client import failed', {
        message: err instanceof Error ? err.message : String(err),
      });
      return null;
    }),
    import('@revealui/ai/orchestration/streaming-runtime').catch((err: unknown) => {
      logger.error('[ai-module-loader] streaming-runtime import failed', {
        message: err instanceof Error ? err.message : String(err),
      });
      return null;
    }),
  ]);

  // Empty mock modules (vitest `() => ({})`) and partial deploys must not pass.
  // Use `in` + try/catch: Vitest auto-mocks throw on missing named exports.
  const hasFn = (mod: object | null, name: string): boolean => {
    if (!(mod && name in mod)) return false;
    try {
      return typeof (mod as Record<string, unknown>)[name] === 'function';
    } catch {
      return false;
    }
  };
  if (
    !(
      hasFn(ai, 'resolveLLMClientForRequest') &&
      hasFn(llmClient, 'LLMClient') &&
      hasFn(streamingRuntime, 'StreamingAgentRuntime')
    )
  ) {
    if (ai || llmClient || streamingRuntime) {
      logger.error('[ai-module-loader] agent-stream modules loaded but missing required exports');
    }
    return null;
  }
  return {
    ai: ai as AiRoot,
    llmClient: llmClient as AiLlmClient,
    streamingRuntime: streamingRuntime as AiStreamingRuntime,
  };
}

/** Test-only: reset cached import promise between cases. */
export function resetAiModuleLoaderForTests(): void {
  aiRootPromise = null;
}
