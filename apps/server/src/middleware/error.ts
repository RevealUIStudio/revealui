import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { errorEvents } from '@revealui/db/schema';
import * as Sentry from '@sentry/node';
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export interface APIErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: unknown;
  requestId?: string;
}

/** Fire-and-forget  -  persist to error_events without blocking the response. */
function persistError(
  level: 'warn' | 'error' | 'fatal',
  message: string,
  stack: string | undefined,
  requestId: string | undefined,
  url: string | undefined,
) {
  (async () => {
    try {
      const db = getClient();
      await db.insert(errorEvents).values({
        id: crypto.randomUUID(),
        level,
        message,
        stack,
        app: 'api',
        context: 'server',
        environment: process.env.NODE_ENV ?? 'production',
        url,
        requestId,
      });
    } catch (dbErr) {
      logger.error(
        'error-handler: failed to persist error event',
        dbErr instanceof Error ? dbErr : new Error(String(dbErr)),
      );
    }
  })();
}

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') as string | undefined;
  const error = err instanceof Error ? err : new Error(String(err));
  const url = c.req.url;
  logger.error('API Error', error, { requestId });

  // Handle HTTP exceptions
  if (err instanceof HTTPException) {
    // Only persist 5xx server errors  -  4xx are client mistakes, not bugs
    if (err.status >= 500) {
      Sentry.captureException(err, { extra: { requestId, url } });
      persistError('error', err.message, err.stack, requestId, url);
    }
    return c.json(
      {
        success: false as const,
        error: err.message,
        code: `HTTP_${err.status}`,
        requestId,
      } satisfies APIErrorResponse,
      err.status,
    );
  }

  // Handle validation errors  -  client mistake, no persist
  if (err.name === 'ZodError') {
    // Strip field-level details in production to avoid leaking schema information
    let details: unknown;
    if (process.env.NODE_ENV !== 'production') {
      try {
        details = JSON.parse(err.message);
      } catch {
        details = err.message;
      }
    }
    return c.json(
      {
        success: false as const,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        ...(details !== undefined && { details }),
        requestId,
      } satisfies APIErrorResponse,
      400,
    );
  }

  // Unhandled server error  -  persist and report to Sentry
  Sentry.captureException(error, { extra: { requestId, url } });
  persistError('error', error.message, error.stack, requestId, url);

  return c.json(
    {
      success: false as const,
      error: 'An error occurred while processing your request',
      code: 'INTERNAL_ERROR',
      requestId,
    } satisfies APIErrorResponse,
    500,
  );
};
