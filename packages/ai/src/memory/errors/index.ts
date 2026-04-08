/**
 * Memory System Errors
 *
 * Custom error classes for the memory system with proper error codes and types.
 */

/**
 * Base error class for memory system errors
 */
export class MemoryError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 500) {
    super(message);
    this.name = 'MemoryError';
    this.code = code;
    this.statusCode = statusCode;
    // Capture stack trace if available (Node.js/V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Database connection errors
 */
export class DatabaseConnectionError extends MemoryError {
  constructor(message = 'Database connection failed', originalError?: Error) {
    super(
      originalError ? `${message}: ${originalError.message}` : message,
      'DB_CONNECTION_ERROR',
      503,
    );
    this.name = 'DatabaseConnectionError';
  }
}

/**
 * Database constraint violation errors
 */
export class DatabaseConstraintError extends MemoryError {
  constructor(message = 'Database constraint violation', originalError?: Error) {
    super(
      originalError ? `${message}: ${originalError.message}` : message,
      'DB_CONSTRAINT_ERROR',
      409,
    );
    this.name = 'DatabaseConstraintError';
  }
}

/**
 * Database query/operation errors
 */
export class DatabaseOperationError extends MemoryError {
  constructor(message = 'Database operation failed', originalError?: Error) {
    super(
      originalError ? `${message}: ${originalError.message}` : message,
      'DB_OPERATION_ERROR',
      500,
    );
    this.name = 'DatabaseOperationError';
  }
}

/**
 * Validation errors
 */
export class ValidationError extends MemoryError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

/**
 * Not found errors
 */
export class NotFoundError extends MemoryError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends MemoryError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 500);
    this.name = 'ConfigurationError';
  }
}

/**
 * Data migration errors
 */
export class MigrationError extends MemoryError {
  constructor(message: string) {
    super(message, 'MIGRATION_ERROR', 400);
    this.name = 'MigrationError';
  }
}
