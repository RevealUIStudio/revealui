/**
 * Error Handling Utilities
 *
 * Standardized error handling for RevealUI framework.
 */

import { logger } from './logger.js'

/**
 * Application Error
 * Use for business logic failures, validation failures, expected errors
 */
export class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApplicationError'
    Error.captureStackTrace(this, ApplicationError)
  }
}

/**
 * Validation Error
 * Use for input validation failures, schema validation failures
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown,
    public context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ValidationError'
    Error.captureStackTrace(this, ValidationError)
  }
}

/**
 * Handle and log error in API routes
 *
 * @param error - The error to handle
 * @param context - Additional context to log
 * @returns User-friendly error message
 */
export function handleApiError(
  error: unknown,
  context?: Record<string, unknown>,
): { message: string; statusCode: number; code?: string } {
  if (error instanceof ApplicationError) {
    logger.error('Application error', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      ...error.context,
      ...context,
    })

    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
    }
  }

  if (error instanceof ValidationError) {
    logger.warn('Validation error', {
      message: error.message,
      field: error.field,
      ...error.context,
      ...context,
    })

    return {
      message: error.message,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    }
  }

  // Unknown error - log with full details, return generic message
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  logger.error('Unexpected error', {
    message: errorMessage,
    stack: errorStack,
    ...context,
  })

  return {
    message: 'An error occurred',
    statusCode: 500,
  }
}

/**
 * Handle database errors
 *
 * @param error - Database error
 * @param operation - Operation being performed
 * @param context - Additional context
 * @returns User-friendly error or re-throws
 */
export function handleDatabaseError(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>,
): never {
  if (error instanceof Error) {
    // Check for specific database errors
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      throw new ApplicationError(
        'Resource already exists',
        'DUPLICATE_ERROR',
        409,
        { operation, ...context },
      )
    }

    if (error.message.includes('foreign key') || error.message.includes('constraint')) {
      throw new ApplicationError(
        'Invalid reference',
        'REFERENCE_ERROR',
        400,
        { operation, ...context },
      )
    }

    if (error.message.includes('not found') || error.message.includes('does not exist')) {
      throw new ApplicationError(
        'Resource not found',
        'NOT_FOUND',
        404,
        { operation, ...context },
      )
    }
  }

  // Log and re-throw unknown database errors
  logger.error('Database error', {
    operation,
    error: error instanceof Error ? error.message : String(error),
    ...context,
  })

  throw new ApplicationError(
    'Database operation failed',
    'DATABASE_ERROR',
    500,
    { operation, ...context },
  )
}
