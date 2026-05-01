/**
 * Audit Logging Middleware for Hono API
 *
 * Adapts the AuditSystem from @revealui/core/security for use with Hono.
 * Logs request/response data after the response is sent (non-blocking).
 *
 * Enterprise-only: should only be active when isFeatureEnabled('auditLog') is true.
 */

import { logger } from '@revealui/core/observability/logger';
import type { AuditEventType, AuditSystem } from '@revealui/core/security';
import type { MiddlewareHandler } from 'hono';

/** Tracks consecutive audit write failures for observability. */
let auditWriteFailures = 0;
const FAILURE_LOG_INTERVAL = 10;

const METHOD_EVENT_MAP: Record<string, AuditEventType> = {
  GET: 'data.read',
  POST: 'data.create',
  PUT: 'data.update',
  PATCH: 'data.update',
  DELETE: 'data.delete',
};

/**
 * Extract the resource type from a URL path.
 * e.g. /api/tickets/boards/123 → 'tickets'
 */
function extractResourceType(path: string): string {
  const segments = path.split('/').filter(Boolean);
  // Skip 'api' prefix, return the next segment
  if (segments[0] === 'api' && segments[1]) {
    return segments[1];
  }
  return segments[0] ?? 'unknown';
}

/**
 * Audit middleware that logs all API requests to the AuditSystem.
 * Logging is fire-and-forget  -  errors never crash the request.
 */
export const auditMiddleware = (audit: AuditSystem): MiddlewareHandler => {
  return async (c, next) => {
    const startTime = Date.now();

    await next();

    // Non-blocking audit log (fire and forget)
    const method = c.req.method;
    const path = c.req.path;
    const status = c.res.status;
    const user = c.get('user') as { id: string } | undefined;
    const requestId = c.get('requestId') as string | undefined;

    audit
      .log({
        type: METHOD_EVENT_MAP[method] ?? ('data.read' as AuditEventType),
        severity: status >= 500 ? 'high' : status >= 400 ? 'medium' : 'low',
        actor: {
          id: user?.id ?? 'anonymous',
          type: user ? 'user' : 'api',
          ip:
            c.req.header('x-real-ip')?.trim() ||
            c.req.header('x-forwarded-for')?.split(',')[0]?.trim(),
          userAgent: c.req.header('user-agent'),
        },
        resource: {
          type: extractResourceType(path),
          id: requestId ?? 'unknown',
        },
        action: `${method} ${path}`,
        result: status < 400 ? 'success' : 'failure',
        metadata: {
          status,
          duration: Date.now() - startTime,
          requestId,
        },
      })
      .catch((err: unknown) => {
        auditWriteFailures++;
        if (auditWriteFailures % FAILURE_LOG_INTERVAL === 1) {
          logger.warn('Audit log write failed', {
            consecutiveFailures: auditWriteFailures,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
  };
};
