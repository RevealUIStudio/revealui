/**
 * Browser entry observability init (Phase 2.3.3).
 * Sink: `@revealui/core/observability` (structured logger → console in dev).
 * No `@sentry/nextjs`.
 */
'use client';

import { captureException, initBrowserObservability } from '@revealui/core/observability/capture';

const SERVICE = 'rsc-poc';

/** Call once at the start of entry.browser main(). */
export function initRscPocBrowserObservability(): void {
  initBrowserObservability({ service: SERVICE });
}

/** ErrorBoundary onError → capture (no secrets). */
export function reportClientRenderError(error: Error): void {
  captureException(error, {
    service: SERVICE,
    kind: 'react_error_boundary',
    pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });
}
