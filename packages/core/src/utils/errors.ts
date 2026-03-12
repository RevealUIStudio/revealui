/**
 * Error Handling Utilities
 *
 * Standardized error handling for RevealUI framework.
 */

import { logger } from './logger.js';

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
    super(message);
    this.name = 'ApplicationError';
    Error.captureStackTrace(this, ApplicationError);
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
    super(message);
    this.name = 'ValidationError';
    Error.captureStackTrace(this, ValidationError);
  }
}

/**
 * Database Error
 * Use for database operation failures with Postgres error code parsing
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public pgCode?: string,
    public constraint?: string,
    public table?: string,
    public column?: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DatabaseError';
    Error.captureStackTrace(this, DatabaseError);
  }
}

/**
 * Authentication Error
 * Use for failed login, expired sessions, invalid tokens
 */
export class AuthenticationError extends ApplicationError {
  constructor(message = 'Authentication required', context?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', 401, context);
    this.name = 'AuthenticationError';
    Error.captureStackTrace(this, AuthenticationError);
  }
}

/**
 * Authorization Error
 * Use for insufficient permissions, forbidden access
 */
export class AuthorizationError extends ApplicationError {
  constructor(message = 'Insufficient permissions', context?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', 403, context);
    this.name = 'AuthorizationError';
    Error.captureStackTrace(this, AuthorizationError);
  }
}

/**
 * Not Found Error
 * Use for missing resources (users, posts, pages, etc.)
 */
export class NotFoundError extends ApplicationError {
  constructor(resource: string, identifier?: string, context?: Record<string, unknown>) {
    const message = identifier ? `${resource} not found: ${identifier}` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, { resource, identifier, ...context });
    this.name = 'NotFoundError';
    Error.captureStackTrace(this, NotFoundError);
  }
}

/**
 * Conflict Error
 * Use for duplicate resources, concurrent modification conflicts
 */
export class ConflictError extends ApplicationError {
  constructor(message = 'Resource conflict', context?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, context);
    this.name = 'ConflictError';
    Error.captureStackTrace(this, ConflictError);
  }
}

/**
 * Rate Limit Error
 * Use for too many requests, throttling
 */
export class RateLimitError extends ApplicationError {
  constructor(
    message = 'Too many requests',
    public retryAfterMs?: number,
    context?: Record<string, unknown>,
  ) {
    super(message, 'RATE_LIMITED', 429, { retryAfterMs, ...context });
    this.name = 'RateLimitError';
    Error.captureStackTrace(this, RateLimitError);
  }
}

/**
 * Postgres Error Codes
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PostgresErrorCode = {
  // Class 23 - Integrity Constraint Violation
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',

  // Class 42 - Syntax Error or Access Rule Violation
  UNDEFINED_TABLE: '42P01',
  UNDEFINED_COLUMN: '42703',
  DUPLICATE_TABLE: '42P07',
  DUPLICATE_COLUMN: '42701',

  // Class 40 - Transaction Rollback
  DEADLOCK_DETECTED: '40P01',
  SERIALIZATION_FAILURE: '40001',

  // Class 57 - Operator Intervention
  QUERY_CANCELED: '57014',
  ADMIN_SHUTDOWN: '57P01',

  // Class 53 - Insufficient Resources
  DISK_FULL: '53100',
  OUT_OF_MEMORY: '53200',
  TOO_MANY_CONNECTIONS: '53300',

  // Class 08 - Connection Exception
  CONNECTION_EXCEPTION: '08000',
  CONNECTION_FAILURE: '08006',
  CONNECTION_DOES_NOT_EXIST: '08003',

  // Class 25 - Invalid Transaction State
  INVALID_TRANSACTION_STATE: '25000',
  ACTIVE_SQL_TRANSACTION: '25001',
} as const;

/**
 * Extract Postgres error information from an error object
 */
function parsePostgresError(error: unknown): {
  pgCode?: string;
  constraint?: string;
  table?: string;
  column?: string;
  detail?: string;
} {
  // Handle Postgres/pg library errors
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    const pgError = error as {
      code: string;
      constraint?: string;
      table?: string;
      column?: string;
      detail?: string;
    };

    return {
      pgCode: pgError.code,
      constraint: pgError.constraint,
      table: pgError.table,
      column: pgError.column,
      detail: pgError.detail,
    };
  }

  return {};
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
): { message: string; statusCode: number; code?: string; retryable?: boolean } {
  if (error instanceof DatabaseError) {
    logger.error('Database error in API', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      pgCode: error.pgCode,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      ...error.context,
      ...context,
    });

    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      retryable: error.context?.retryable as boolean | undefined,
    };
  }

  if (error instanceof RateLimitError) {
    logger.warn('Rate limit exceeded', {
      message: error.message,
      retryAfterMs: error.retryAfterMs,
      ...error.context,
      ...context,
    });

    return {
      message: error.message,
      statusCode: 429,
      code: error.code,
      retryable: true,
    };
  }

  if (error instanceof AuthenticationError) {
    logger.warn('Authentication failed', {
      message: error.message,
      ...error.context,
      ...context,
    });

    return {
      message: error.message,
      statusCode: 401,
      code: error.code,
    };
  }

  if (error instanceof AuthorizationError) {
    logger.warn('Authorization denied', {
      message: error.message,
      ...error.context,
      ...context,
    });

    return {
      message: error.message,
      statusCode: 403,
      code: error.code,
    };
  }

  if (error instanceof NotFoundError) {
    return {
      message: error.message,
      statusCode: 404,
      code: error.code,
    };
  }

  if (error instanceof ApplicationError) {
    logger.error('Application error', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      ...error.context,
      ...context,
    });

    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
    };
  }

  if (error instanceof ValidationError) {
    logger.warn('Validation error', {
      message: error.message,
      field: error.field,
      ...error.context,
      ...context,
    });

    return {
      message: error.message,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    };
  }

  // Unknown error - log with full details, return generic message
  const err = error instanceof Error ? error : new Error(String(error));

  // Always use logger - it's always available from the same package
  logger.error('Unexpected error', { error: err.message, stack: err.stack });

  return {
    message: 'An error occurred',
    statusCode: 500,
  };
}

/**
 * Handle database errors with Postgres error code parsing
 *
 * @param error - Database error
 * @param operation - Operation being performed (e.g., 'insert user', 'update order')
 * @param context - Additional context (e.g., { userId: '123', table: 'users' })
 * @returns Never - always throws a DatabaseError
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(users).values({ email: 'existing@example.com' })
 * } catch (error) {
 *   handleDatabaseError(error, 'insert user', { email: 'existing@example.com' })
 * }
 * ```
 */
export function handleDatabaseError(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>,
): never {
  const pgError = parsePostgresError(error);
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Parse Postgres error codes for specific error types
  if (pgError.pgCode) {
    switch (pgError.pgCode) {
      // Unique constraint violation
      case PostgresErrorCode.UNIQUE_VIOLATION: {
        const field = pgError.constraint?.replace(/_/g, ' ') || 'field';
        const message = `Duplicate ${field}: this value already exists`;

        logger.warn('Unique constraint violation', {
          operation,
          constraint: pgError.constraint,
          table: pgError.table,
          detail: pgError.detail,
          ...context,
        });

        throw new DatabaseError(
          message,
          'UNIQUE_VIOLATION',
          409,
          pgError.pgCode,
          pgError.constraint,
          pgError.table,
          pgError.column,
          {
            operation,
            detail: pgError.detail,
            ...context,
          },
        );
      }

      // Foreign key constraint violation
      case PostgresErrorCode.FOREIGN_KEY_VIOLATION: {
        const constraint = pgError.constraint?.replace(/_/g, ' ') || 'reference';
        const message = `Invalid ${constraint}: referenced record does not exist`;

        logger.warn('Foreign key violation', {
          operation,
          constraint: pgError.constraint,
          table: pgError.table,
          detail: pgError.detail,
          ...context,
        });

        throw new DatabaseError(
          message,
          'FOREIGN_KEY_VIOLATION',
          400,
          pgError.pgCode,
          pgError.constraint,
          pgError.table,
          pgError.column,
          {
            operation,
            detail: pgError.detail,
            ...context,
          },
        );
      }

      // Not null constraint violation
      case PostgresErrorCode.NOT_NULL_VIOLATION: {
        const field = pgError.column || 'field';
        const message = `Missing required field: ${field} cannot be null`;

        logger.warn('Not null violation', {
          operation,
          column: pgError.column,
          table: pgError.table,
          ...context,
        });

        throw new DatabaseError(
          message,
          'NOT_NULL_VIOLATION',
          400,
          pgError.pgCode,
          pgError.constraint,
          pgError.table,
          pgError.column,
          {
            operation,
            ...context,
          },
        );
      }

      // Check constraint violation
      case PostgresErrorCode.CHECK_VIOLATION: {
        const constraint = pgError.constraint?.replace(/_/g, ' ') || 'constraint';
        const message = `Validation failed: ${constraint} check constraint violated`;

        logger.warn('Check constraint violation', {
          operation,
          constraint: pgError.constraint,
          table: pgError.table,
          detail: pgError.detail,
          ...context,
        });

        throw new DatabaseError(
          message,
          'CHECK_VIOLATION',
          400,
          pgError.pgCode,
          pgError.constraint,
          pgError.table,
          pgError.column,
          {
            operation,
            detail: pgError.detail,
            ...context,
          },
        );
      }

      // Deadlock detected
      case PostgresErrorCode.DEADLOCK_DETECTED: {
        const message = 'Database deadlock detected - please retry the operation';

        logger.error('Deadlock detected', {
          operation,
          table: pgError.table,
          ...context,
        });

        throw new DatabaseError(
          message,
          'DEADLOCK_DETECTED',
          409,
          pgError.pgCode,
          pgError.constraint,
          pgError.table,
          pgError.column,
          {
            operation,
            retryable: true,
            ...context,
          },
        );
      }

      // Serialization failure (concurrent update conflict)
      case PostgresErrorCode.SERIALIZATION_FAILURE: {
        const message = 'Concurrent update conflict - please retry the operation';

        logger.warn('Serialization failure', {
          operation,
          ...context,
        });

        throw new DatabaseError(
          message,
          'SERIALIZATION_FAILURE',
          409,
          pgError.pgCode,
          pgError.constraint,
          pgError.table,
          pgError.column,
          {
            operation,
            retryable: true,
            ...context,
          },
        );
      }

      // Query canceled (timeout)
      case PostgresErrorCode.QUERY_CANCELED: {
        const message = 'Database query timeout - operation took too long';

        logger.error('Query timeout', {
          operation,
          ...context,
        });

        throw new DatabaseError(
          message,
          'QUERY_TIMEOUT',
          504,
          pgError.pgCode,
          pgError.constraint,
          pgError.table,
          pgError.column,
          {
            operation,
            ...context,
          },
        );
      }

      // Connection errors
      case PostgresErrorCode.CONNECTION_EXCEPTION:
      case PostgresErrorCode.CONNECTION_FAILURE:
      case PostgresErrorCode.CONNECTION_DOES_NOT_EXIST: {
        const message = 'Database connection error - please try again';

        logger.error('Database connection error', {
          operation,
          pgCode: pgError.pgCode,
          ...context,
        });

        throw new DatabaseError(
          message,
          'CONNECTION_ERROR',
          503,
          pgError.pgCode,
          pgError.constraint,
          pgError.table,
          pgError.column,
          {
            operation,
            retryable: true,
            ...context,
          },
        );
      }

      // Resource errors
      case PostgresErrorCode.DISK_FULL:
      case PostgresErrorCode.OUT_OF_MEMORY:
      case PostgresErrorCode.TOO_MANY_CONNECTIONS: {
        const message = 'Database resource limit reached - please try again later';

        logger.error('Database resource error', {
          operation,
          pgCode: pgError.pgCode,
          ...context,
        });

        throw new DatabaseError(
          message,
          'RESOURCE_ERROR',
          503,
          pgError.pgCode,
          pgError.constraint,
          pgError.table,
          pgError.column,
          {
            operation,
            retryable: true,
            ...context,
          },
        );
      }

      // Undefined table/column
      case PostgresErrorCode.UNDEFINED_TABLE:
      case PostgresErrorCode.UNDEFINED_COLUMN: {
        const message = 'Database schema error - table or column does not exist';

        logger.error('Schema error', {
          operation,
          pgCode: pgError.pgCode,
          table: pgError.table,
          column: pgError.column,
          ...context,
        });

        throw new DatabaseError(
          message,
          'SCHEMA_ERROR',
          500,
          pgError.pgCode,
          pgError.constraint,
          pgError.table,
          pgError.column,
          {
            operation,
            ...context,
          },
        );
      }
    }
  }

  // Fallback: Check error message for common patterns (if no pgCode)
  if (error instanceof Error) {
    if (errorMessage.includes('unique') || errorMessage.includes('duplicate')) {
      logger.warn('Unique violation (message-based)', {
        operation,
        message: errorMessage,
        ...context,
      });
      throw new DatabaseError(
        'Resource already exists',
        'UNIQUE_VIOLATION',
        409,
        undefined,
        undefined,
        undefined,
        undefined,
        { operation, ...context },
      );
    }

    if (
      errorMessage.includes('foreign key') ||
      errorMessage.includes('violates foreign key constraint')
    ) {
      logger.warn('Foreign key violation (message-based)', {
        operation,
        message: errorMessage,
        ...context,
      });
      throw new DatabaseError(
        'Invalid reference',
        'FOREIGN_KEY_VIOLATION',
        400,
        undefined,
        undefined,
        undefined,
        undefined,
        { operation, ...context },
      );
    }

    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      logger.warn('Not found (message-based)', { operation, message: errorMessage, ...context });
      throw new DatabaseError(
        'Resource not found',
        'NOT_FOUND',
        404,
        undefined,
        undefined,
        undefined,
        undefined,
        { operation, ...context },
      );
    }
  }

  // Unknown database error - log with full details
  logger.error('Unexpected database error', {
    operation,
    error: errorMessage,
    pgCode: pgError.pgCode,
    constraint: pgError.constraint,
    table: pgError.table,
    column: pgError.column,
    detail: pgError.detail,
    ...context,
  });

  throw new DatabaseError(
    'Database operation failed',
    'DATABASE_ERROR',
    500,
    pgError.pgCode,
    pgError.constraint,
    pgError.table,
    pgError.column,
    {
      operation,
      originalError: errorMessage,
      ...context,
    },
  );
}
