/**
 * API Route Wrapper
 *
 * Wraps Next.js API routes to automatically set up request context,
 * error handling, and logging.
 */

import { getClientIp } from '@revealui/security';
import { handleApiError } from './errors.js';
import { logger } from './logger.js';
import {
  createRequestContext,
  getRequestDuration,
  runInRequestContext,
} from './request-context.js';

/**
 * API route handler function
 */
export type ApiHandler = (request: Request) => Promise<Response>;

/**
 * Wrap an API route handler with request context, logging, and error handling
 *
 * Benefits:
 * - Automatic request ID generation and propagation
 * - Request context available via getRequestContext()
 * - Automatic error handling with proper status codes
 * - Request/response logging with timing
 * - All logs include request ID automatically
 *
 * @param handler - API route handler function
 * @returns Wrapped handler with request context
 *
 * @example
 * ```typescript
 * // app/api/users/route.ts
 * import { withRequestContext } from '@revealui/core/utils/api-wrapper'
 * // Uses standard Web API Request/Response
 *
 * export const GET = withRequestContext(async (request) => {
 *   // Request ID automatically available in logs
 *   logger.info('Fetching users') // Includes requestId automatically
 *
 *   const users = await db.query.users.findMany()
 *   return Response.json(users)
 * })
 * ```
 */
export function withRequestContext(handler: ApiHandler): ApiHandler {
  return async (request: Request): Promise<Response> => {
    // Create request context from headers
    const context = createRequestContext({
      headers: Object.fromEntries(request.headers.entries()),
      path: new URL(request.url).pathname,
      method: request.method,
      ip: getClientIp(request),
    });

    // Log incoming request
    logger.info('Incoming request', {
      method: context.method,
      path: context.path,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    try {
      // Run handler within request context
      const response = await runInRequestContext(context, () => handler(request));

      // Log successful response
      const duration = getRequestDuration();
      logger.info('Request completed', {
        method: context.method,
        path: context.path,
        status: response.status,
        duration,
      });

      // Add request ID to response headers
      response.headers.set('x-request-id', context.requestId);
      response.headers.set('x-request-duration', duration?.toString() || '0');

      return response;
    } catch (error) {
      // Handle errors with proper logging and status codes
      const duration = getRequestDuration();
      logger.error('Request failed', {
        method: context.method,
        path: context.path,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      // Convert error to API response
      const apiError = handleApiError(error, {
        method: context.method,
        path: context.path,
      });

      const errorResponse = Response.json(
        {
          error: {
            message: apiError.message,
            code: apiError.code,
            ...(apiError.retryable !== undefined && { retryable: apiError.retryable }),
          },
        },
        { status: apiError.statusCode },
      );

      // Add request ID to error response
      errorResponse.headers.set('x-request-id', context.requestId);
      errorResponse.headers.set('x-request-duration', duration?.toString() || '0');

      return errorResponse;
    }
  };
}

/**
 * Server action wrapper for request context
 *
 * Use this for Next.js Server Actions to enable request tracing
 *
 * @param action - Server action function
 * @returns Wrapped action with request context
 *
 * @example
 * ```typescript
 * 'use server'
 *
 * import { withServerActionContext } from '@revealui/core/utils/api-wrapper'
 *
 * export const createUser = withServerActionContext(async (data) => {
 *   logger.info('Creating user') // Includes requestId
 *   return await db.insert(users).values(data)
 * })
 * ```
 */
export function withServerActionContext<TArgs extends unknown[], TReturn>(
  action: (...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    // Create request context (no headers available in server actions)
    const context = createRequestContext({});

    // Log server action execution
    logger.info('Server action started', {
      action: action.name || 'anonymous',
    });

    try {
      // Run action within request context
      const result = await runInRequestContext(context, () => action(...args));

      // Log successful execution
      const duration = getRequestDuration();
      logger.info('Server action completed', {
        action: action.name || 'anonymous',
        duration,
      });

      return result;
    } catch (error) {
      // Log error
      const duration = getRequestDuration();
      logger.error('Server action failed', {
        action: action.name || 'anonymous',
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    }
  };
}
