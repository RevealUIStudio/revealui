/**
 * Error Response Utilities for RevealHandler
 *
 * Creates standardized error responses using standard Response objects
 * (RevealHandler expects Response, not NextResponse)
 */

import { ApplicationError, handleApiError, ValidationError } from '@revealui/core/utils/errors';
import type { ErrorResponse } from './error-types';

/**
 * Create a standardized error response for RevealHandler routes
 *
 * @param error - The error to convert to a response
 * @param context - Additional context for error handling
 * @returns Response with standardized error format
 */
export function createErrorResponse(error: unknown, context?: Record<string, unknown>): Response {
  const handled = handleApiError(error, context);

  const response: ErrorResponse = {
    error: handled.code || 'INTERNAL_ERROR',
    message: handled.message,
    ...(handled.code && { code: handled.code }),
    ...(error instanceof ValidationError && error.context && { details: error.context }),
  };

  return new Response(JSON.stringify(response), {
    status: handled.statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a validation error response
 *
 * @param message - Error message
 * @param field - Field that failed validation
 * @param value - Invalid value
 * @param details - Additional validation details
 * @returns Response with 400 status
 */
export function createValidationErrorResponse(
  message: string,
  field: string,
  value: unknown,
  details?: Record<string, unknown>,
): Response {
  const error = new ValidationError(message, field, value, details);
  return createErrorResponse(error);
}

/**
 * Create an application error response
 *
 * @param message - Error message
 * @param code - Error code
 * @param statusCode - HTTP status code (default: 500)
 * @param context - Additional context
 * @returns Response with specified status code
 */
export function createApplicationErrorResponse(
  message: string,
  code: string,
  statusCode = 500,
  context?: Record<string, unknown>,
): Response {
  const error = new ApplicationError(message, code, statusCode, context);
  return createErrorResponse(error);
}
