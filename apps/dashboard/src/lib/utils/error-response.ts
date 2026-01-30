/**
 * Standard Error Response Utilities for Dashboard App (Simplified)
 *
 * Provides standardized error response formatting for API routes without external dependencies.
 */

import { NextResponse } from 'next/server'
import type { ErrorResponse } from './error-types.js'

/**
 * Create a validation error response
 *
 * @param message - Error message
 * @param field - Field that failed validation
 * @param value - Invalid value
 * @param details - Additional validation details
 * @returns NextResponse with 400 status
 */
export function createValidationErrorResponse(
  message: string,
  field: string,
  value: unknown,
  details?: Record<string, unknown>,
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: 'VALIDATION_ERROR',
      message,
      details: { field, value, ...details },
    },
    { status: 400 },
  )
}

/**
 * Create an application error response
 *
 * @param message - Error message
 * @param code - Error code
 * @param statusCode - HTTP status code (default: 500)
 * @param context - Additional context
 * @returns NextResponse with specified status code
 */
export function createApplicationErrorResponse(
  message: string,
  code: string,
  statusCode = 500,
  context?: Record<string, unknown>,
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: code,
      message,
      details: context,
    },
    { status: statusCode },
  )
}
