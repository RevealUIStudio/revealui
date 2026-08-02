/**
 * Node / RSC entry observability init (Phase 2.3.3).
 * Sink: `@revealui/core/observability` (structured logger → console in dev).
 * No `@sentry/nextjs`.
 */

import {
  bindRequestId,
  captureActionFailure,
  captureException,
  initNodeObservability,
} from '@revealui/core/observability/capture';

const SERVICE = 'rsc-poc';

/** Call once from entry.rsc (module top-level is fine). */
export function initRscPocNodeObservability(): void {
  initNodeObservability({ service: SERVICE });
}

/** Prefer x-request-id, then x-correlation-id. */
export function bindRequestIdFromRequest(request: Request): void {
  const id =
    request.headers.get('x-request-id') ?? request.headers.get('x-correlation-id') ?? undefined;
  bindRequestId(id);
}

export function reportRenderError(
  error: unknown,
  meta: { phase: 'action' | 'form' | 'loader'; pathname: string; actionId?: string },
): void {
  if (meta.phase === 'action' && meta.actionId) {
    captureActionFailure(meta.actionId, error, {
      pathname: meta.pathname,
      phase: meta.phase,
      service: SERVICE,
    });
    return;
  }
  captureException(error, {
    pathname: meta.pathname,
    phase: meta.phase,
    service: SERVICE,
    kind: meta.phase === 'loader' ? 'loader_failure' : 'form_action_failure',
  });
}
