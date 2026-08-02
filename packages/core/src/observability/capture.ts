/**
 * Framework-agnostic error/event capture (Phase 2.3.3).
 *
 * Prefer this over `@sentry/nextjs`. Sink is the structured logger
 * (`@revealui/core/observability/logger` → console or remote via LoggerConfig).
 * Browser-safe: no node: builtins. Node handlers are gated on `process`.
 */

import type { LogContext } from './logger.js';
import { logError, logger } from './logger.js';

/** Keys that must never ride along on capture context (secrets / bodies). */
const FORBIDDEN_CONTEXT_KEYS = new Set([
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'cookies',
  'body',
  'formdata',
  'form',
  'formstate',
  'credentials',
  'apikey',
  'api_key',
  'sessiontoken',
]);

export interface CaptureContext extends LogContext {
  tags?: Record<string, string>;
}

export interface InitNodeObservabilityOptions {
  /** Service name for log context (default `app`). */
  service?: string;
  /**
   * Install process `unhandledRejection` / `uncaughtException` handlers.
   * Default true. Idempotent across multiple calls.
   */
  installProcessHandlers?: boolean;
}

export interface InitBrowserObservabilityOptions {
  /** Service name for log context (default `app`). */
  service?: string;
  /**
   * Install `window` error + unhandledrejection listeners.
   * Default true. Idempotent across multiple calls.
   */
  installWindowHandlers?: boolean;
}

let nodeHandlersInstalled = false;
let browserHandlersInstalled = false;

/**
 * Strip secret-shaped keys from capture context.
 * Never logs form bodies or credentials.
 */
export function sanitizeCaptureContext(context?: CaptureContext): LogContext | undefined {
  if (!context) return undefined;
  const out: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (FORBIDDEN_CONTEXT_KEYS.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Capture an exception to the configured sink (console / remote logger).
 */
export function captureException(error: unknown, context?: CaptureContext): void {
  const err = error instanceof Error ? error : new Error(String(error));
  logError(err, sanitizeCaptureContext(context));
}

/**
 * Capture a non-error event/message.
 */
export function captureMessage(message: string, context?: CaptureContext): void {
  logger.info(message, sanitizeCaptureContext(context));
}

/**
 * Capture a failed server action. Pass action id only — never the body.
 */
export function captureActionFailure(
  actionId: string,
  error: unknown,
  context?: CaptureContext,
): void {
  captureException(error, {
    ...context,
    actionId,
    kind: 'action_failure',
  });
}

/**
 * Bind a request/correlation id onto the default logger context when present.
 */
export function bindRequestId(requestId: string | null | undefined): void {
  if (requestId && requestId.length > 0) {
    logger.setContext({ requestId });
  }
}

/**
 * Node/SSR init: service context + optional process-level handlers.
 * Call once from the RSC/Hono entry.
 */
export function initNodeObservability(options: InitNodeObservabilityOptions = {}): void {
  const service = options.service ?? 'app';
  logger.setContext({ service, runtime: 'node' });
  logger.info('observability: node init', { service, runtime: 'node' });

  if (options.installProcessHandlers === false) return;
  if (nodeHandlersInstalled) return;
  if (typeof process === 'undefined' || typeof process.on !== 'function') return;

  nodeHandlersInstalled = true;
  process.on('unhandledRejection', (reason: unknown) => {
    captureException(reason, { kind: 'unhandledRejection' });
  });
  process.on('uncaughtException', (err: Error) => {
    captureException(err, { kind: 'uncaughtException' });
  });
}

/**
 * Browser init: service context + optional window-level handlers.
 * Call once from the client entry (before hydrate).
 */
export function initBrowserObservability(options: InitBrowserObservabilityOptions = {}): void {
  const service = options.service ?? 'app';
  logger.setContext({ service, runtime: 'browser' });
  logger.info('observability: browser init', { service, runtime: 'browser' });

  if (options.installWindowHandlers === false) return;
  if (browserHandlersInstalled) return;
  if (typeof window === 'undefined') return;

  browserHandlersInstalled = true;
  window.addEventListener('error', (event: ErrorEvent) => {
    captureException(event.error ?? event.message, {
      kind: 'window.error',
      filename: event.filename,
    });
  });
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    captureException(event.reason, { kind: 'unhandledrejection' });
  });
}

/** Test-only: reset install flags (vitest). */
export function resetObservabilityInstallFlagsForTests(): void {
  nodeHandlersInstalled = false;
  browserHandlersInstalled = false;
}
