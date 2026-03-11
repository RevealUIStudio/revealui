/**
 * Request ID Middleware
 *
 * Assigns a unique request ID to every request for log correlation.
 * Reads from x-request-id header if present, otherwise generates a UUID.
 */

import type { MiddlewareHandler } from 'hono';

export const requestIdMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const requestId = c.req.header('x-request-id') || crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-ID', requestId);
    await next();
  };
};
