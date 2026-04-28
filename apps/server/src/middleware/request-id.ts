/**
 * Request ID Middleware
 *
 * Assigns a unique request ID to every request for log correlation.
 * Reads from x-request-id header if present, otherwise generates a UUID.
 */

import type { MiddlewareHandler } from 'hono';

/** Maximum allowed length for x-request-id header to prevent log injection */
const MAX_REQUEST_ID_LENGTH = 128;

export const requestIdMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const header = c.req.header('x-request-id');
    // Reject oversized or non-printable-ASCII request IDs to prevent log injection
    const requestId =
      header && header.length <= MAX_REQUEST_ID_LENGTH && /^[\x20-\x7e]+$/.test(header)
        ? header
        : crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-ID', requestId);
    await next();
  };
};
