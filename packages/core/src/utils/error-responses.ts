/**
 * Framework-Agnostic Error Response Utilities
 *
 * Provides standardized error response data objects (not Response/NextResponse wrappers).
 * These functions return plain data objects that can be wrapped by framework-specific
 * response utilities (NextResponse.json, new Response, etc.).
 *
 * Use these functions to create error response data, then wrap in your framework's
 * response type:
 * - Next.js: `NextResponse.json(createErrorResponseData(...), { status: 400 })`
 * - Standard: `new Response(JSON.stringify(createErrorResponseData(...)), { status: 400 })`
 */

import { ApplicationError, ValidationError } from './errors.js';

/**
 * Error response data format
 */
export interface ErrorResponseData {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Create error response data from an error object
 *
 * @param error - The error to convert to response data
 * @param context - Additional context for error handling
 * @returns Error response data object
 */
export function createErrorResponseData(
  error: unknown,
  context?: Record<string, unknown>,
): ErrorResponseData {
  if (error instanceof ApplicationError) {
    return {
      error: error.code || 'INTERNAL_ERROR',
      message: error.message,
      code: error.code,
      ...(error.context && { details: error.context }),
      ...(context && { details: { ...error.context, ...context } }),
    };
  }

  if (error instanceof ValidationError) {
    return {
      error: 'VALIDATION_ERROR',
      message: error.message,
      code: 'VALIDATION_ERROR',
      ...(error.context && { details: error.context }),
      ...(context && { details: { ...error.context, ...context } }),
    };
  }

  // Unknown error  -  never expose raw error messages to clients
  return {
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    ...(context && { details: context }),
  };
}

/**
 * Create validation error response data
 *
 * @param message - Error message
 * @param field - Field that failed validation
 * @param value - Invalid value
 * @param details - Additional validation details
 * @returns Validation error response data
 */
export function createValidationErrorResponseData(
  message: string,
  field: string,
  value: unknown,
  details?: Record<string, unknown>,
): ErrorResponseData {
  return {
    error: 'VALIDATION_ERROR',
    message,
    code: 'VALIDATION_ERROR',
    details: {
      field,
      value,
      ...details,
    },
  };
}

/**
 * Create application error response data
 *
 * @param message - Error message
 * @param code - Error code
 * @param statusCode - HTTP status code (for reference, not included in data)
 * @param context - Additional context
 * @returns Application error response data
 */
export function createApplicationErrorResponseData(
  message: string,
  code: string,
  statusCode?: number,
  context?: Record<string, unknown>,
): ErrorResponseData {
  return {
    error: code || 'INTERNAL_ERROR',
    message,
    code,
    ...(context && { details: context }),
    ...(statusCode !== undefined && { statusCode }), // Include for reference if needed
  };
}

/**
 * Create success response data
 *
 * @param data - Response data
 * @returns Success response data (can be wrapped by framework)
 */
export function createSuccessResponseData<T>(data: T): T {
  return data;
}
