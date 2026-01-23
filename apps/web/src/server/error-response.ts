/**
 * Error Response Utilities for Web App
 *
 * Creates standardized error responses using standard Response objects
 * (Web app doesn't use Next.js, so we can't use NextResponse)
 * Wraps framework-agnostic error response data from @revealui/core with Response.
 */

import {
  createApplicationErrorResponseData,
  createErrorResponseData,
  createValidationErrorResponseData,
} from '@revealui/core/utils/error-responses'
import { handleApiError } from '@revealui/core/utils/errors'

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string
  message: string
  code?: string
  details?: unknown
}

/**
 * Create a standardized error response for API routes
 *
 * @param error - The error to convert to a response
 * @param context - Additional context for error handling
 * @returns Response with standardized error format
 */
export function createErrorResponse(error: unknown, context?: Record<string, unknown>): Response {
  const handled = handleApiError(error, context)
  const responseData = createErrorResponseData(error, context)

  return new Response(JSON.stringify(responseData), {
    status: handled.statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  })
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
  const responseData = createValidationErrorResponseData(message, field, value, details)
  return new Response(JSON.stringify(responseData), {
    status: 400,
    headers: {
      'Content-Type': 'application/json',
    },
  })
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
  const responseData = createApplicationErrorResponseData(message, code, statusCode, context)
  return new Response(JSON.stringify(responseData), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
