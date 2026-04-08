/**
 * Standard Error Response Utilities for CMS App
 *
 * Provides standardized error response formatting for API routes.
 * Ensures consistent error format across all endpoints.
 * Wraps framework-agnostic error response data from @revealui/core with NextResponse.
 */

import {
  createApplicationErrorResponseData,
  createErrorResponseData,
  createValidationErrorResponseData,
} from '@revealui/core/utils/error-responses';
import { handleApiError } from '@revealui/core/utils/errors';
import { NextResponse } from 'next/server';
import type { ErrorResponse } from './error-types';

/**
 * Create a standardized error response for API routes
 *
 * @param error - The error to convert to a response
 * @param context - Additional context for error handling
 * @returns NextResponse with standardized error format
 */
export function createErrorResponse(
  error: unknown,
  context?: Record<string, unknown>,
): NextResponse<ErrorResponse> {
  const handled = handleApiError(error, context);
  const responseData = createErrorResponseData(error, context);

  return NextResponse.json(responseData, { status: handled.statusCode });
}

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
  const responseData = createValidationErrorResponseData(message, field, value, details);
  return NextResponse.json(responseData, { status: 400 });
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
  const responseData = createApplicationErrorResponseData(message, code, statusCode, context);
  return NextResponse.json(responseData, { status: statusCode });
}

/**
 * Create a standard success response
 *
 * @param data - Response data
 * @param statusCode - HTTP status code (default: 200)
 * @returns NextResponse with data
 */
export function createSuccessResponse<T>(data: T, statusCode = 200): NextResponse<T> {
  return NextResponse.json(data, { status: statusCode });
}
