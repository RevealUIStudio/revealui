/**
 * Typed Error System
 *
 * Provides standardized error codes and error classes for CLI scripts.
 * Exit codes follow Unix conventions with additional granularity.
 *
 * @example
 * ```typescript
 * import { ScriptError, ErrorCode } from './errors.js'
 *
 * // Throw typed errors
 * throw new ScriptError('Workflow not found', ErrorCode.NOT_FOUND, {
 *   workflowId: id,
 * })
 *
 * // Handle errors with proper exit codes
 * try {
 *   await runCommand()
 * } catch (error) {
 *   if (error instanceof ScriptError) {
 *     process.exit(error.code)
 *   }
 *   process.exit(ErrorCode.GENERAL_ERROR)
 * }
 * ```
 */

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Standardized exit codes for CLI scripts.
 *
 * These follow Unix conventions where 0 = success, non-zero = failure,
 * with specific codes for different failure types.
 */
export enum ErrorCode {
  /** Operation completed successfully */
  SUCCESS = 0,

  /** General/unknown error */
  GENERAL_ERROR = 1,

  /** Configuration error (missing env var, bad config file) */
  CONFIG_ERROR = 2,

  /** Execution error (command failed, external service error) */
  EXECUTION_ERROR = 3,

  /** Validation error (bad input, invalid arguments) */
  VALIDATION_ERROR = 4,

  /** Timeout error (operation took too long) */
  TIMEOUT_ERROR = 5,

  /** Resource not found (workflow, file, etc.) */
  NOT_FOUND = 6,

  /** Permission denied (auth failed, insufficient permissions) */
  PERMISSION_DENIED = 7,

  /** Conflict error (resource already exists, concurrent modification) */
  CONFLICT = 8,

  /** Operation cancelled by user */
  CANCELLED = 9,

  /** Dependency error (missing tool, wrong version) */
  DEPENDENCY_ERROR = 10,

  /** Network error (connection failed, DNS resolution) */
  NETWORK_ERROR = 11,

  /** Rate limit exceeded */
  RATE_LIMITED = 12,

  /** Invalid state (operation not allowed in current state) */
  INVALID_STATE = 13,
}

/**
 * Human-readable descriptions for error codes
 */
export const ErrorCodeDescriptions: Record<ErrorCode, string> = {
  [ErrorCode.SUCCESS]: 'Operation completed successfully',
  [ErrorCode.GENERAL_ERROR]: 'An unexpected error occurred',
  [ErrorCode.CONFIG_ERROR]: 'Configuration error',
  [ErrorCode.EXECUTION_ERROR]: 'Command execution failed',
  [ErrorCode.VALIDATION_ERROR]: 'Invalid input or arguments',
  [ErrorCode.TIMEOUT_ERROR]: 'Operation timed out',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.PERMISSION_DENIED]: 'Permission denied',
  [ErrorCode.CONFLICT]: 'Resource conflict',
  [ErrorCode.CANCELLED]: 'Operation cancelled',
  [ErrorCode.DEPENDENCY_ERROR]: 'Missing or incompatible dependency',
  [ErrorCode.NETWORK_ERROR]: 'Network error',
  [ErrorCode.RATE_LIMITED]: 'Rate limit exceeded',
  [ErrorCode.INVALID_STATE]: 'Invalid state for operation',
}

// =============================================================================
// Error Class
// =============================================================================

/**
 * Typed error class for CLI scripts
 *
 * Includes an error code that maps to process exit codes,
 * plus optional structured details for debugging.
 */
export class ScriptError extends Error {
  /** Error code (maps to exit code) */
  public readonly code: ErrorCode

  /** Additional error details */
  public readonly details?: Record<string, unknown>

  /** Error code as string (for JSON output) */
  public readonly codeString: string

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.GENERAL_ERROR,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ScriptError'
    this.code = code
    this.details = details
    this.codeString = ErrorCode[code] ?? 'UNKNOWN'

    // Maintain proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, ScriptError)
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): {
    code: string
    exitCode: number
    message: string
    details?: Record<string, unknown>
  } {
    return {
      code: this.codeString,
      exitCode: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    }
  }

  /**
   * Get the human-readable description for this error's code
   */
  getCodeDescription(): string {
    return ErrorCodeDescriptions[this.code] ?? 'Unknown error'
  }
}

// =============================================================================
// Error Factory Functions
// =============================================================================

/**
 * Create a not found error
 */
export function notFound(
  resource: string,
  id?: string,
  details?: Record<string, unknown>,
): ScriptError {
  const message = id ? `${resource} not found: ${id}` : `${resource} not found`
  return new ScriptError(message, ErrorCode.NOT_FOUND, { resource, id, ...details })
}

/**
 * Create a validation error
 */
export function validationError(
  message: string,
  field?: string,
  details?: Record<string, unknown>,
): ScriptError {
  return new ScriptError(message, ErrorCode.VALIDATION_ERROR, { field, ...details })
}

/**
 * Create a config error
 */
export function configError(
  message: string,
  envVar?: string,
  details?: Record<string, unknown>,
): ScriptError {
  return new ScriptError(message, ErrorCode.CONFIG_ERROR, { envVar, ...details })
}

/**
 * Create a timeout error
 */
export function timeoutError(
  operation: string,
  timeoutMs: number,
  details?: Record<string, unknown>,
): ScriptError {
  return new ScriptError(`${operation} timed out after ${timeoutMs}ms`, ErrorCode.TIMEOUT_ERROR, {
    operation,
    timeoutMs,
    ...details,
  })
}

/**
 * Create an execution error
 */
export function executionError(
  command: string,
  exitCode?: number,
  stderr?: string,
  details?: Record<string, unknown>,
): ScriptError {
  const message =
    exitCode !== undefined
      ? `Command failed with exit code ${exitCode}: ${command}`
      : `Command failed: ${command}`
  return new ScriptError(message, ErrorCode.EXECUTION_ERROR, {
    command,
    exitCode,
    stderr,
    ...details,
  })
}

/**
 * Create a conflict error
 */
export function conflictError(
  resource: string,
  reason?: string,
  details?: Record<string, unknown>,
): ScriptError {
  const message = reason ? `Conflict: ${resource} - ${reason}` : `Conflict: ${resource}`
  return new ScriptError(message, ErrorCode.CONFLICT, { resource, reason, ...details })
}

/**
 * Create a permission denied error
 */
export function permissionDenied(
  action: string,
  resource?: string,
  details?: Record<string, unknown>,
): ScriptError {
  const message = resource
    ? `Permission denied: ${action} on ${resource}`
    : `Permission denied: ${action}`
  return new ScriptError(message, ErrorCode.PERMISSION_DENIED, {
    action,
    resource,
    ...details,
  })
}

/**
 * Create an invalid state error
 */
export function invalidState(
  operation: string,
  currentState: string,
  expectedStates?: string[],
  details?: Record<string, unknown>,
): ScriptError {
  const expected = expectedStates?.length ? `. Expected one of: ${expectedStates.join(', ')}` : ''
  return new ScriptError(
    `Cannot ${operation} in state '${currentState}'${expected}`,
    ErrorCode.INVALID_STATE,
    { operation, currentState, expectedStates, ...details },
  )
}

// =============================================================================
// Error Handling Utilities
// =============================================================================

/**
 * Check if an error is a ScriptError
 */
export function isScriptError(error: unknown): error is ScriptError {
  return error instanceof ScriptError
}

/**
 * Get the exit code for an error
 */
export function getExitCode(error: unknown): number {
  if (isScriptError(error)) {
    return error.code
  }
  return ErrorCode.GENERAL_ERROR
}

/**
 * Wrap an unknown error as a ScriptError
 */
export function wrapError(error: unknown, code: ErrorCode = ErrorCode.GENERAL_ERROR): ScriptError {
  if (isScriptError(error)) {
    return error
  }

  if (error instanceof Error) {
    return new ScriptError(error.message, code, {
      originalName: error.name,
      stack: error.stack,
    })
  }

  return new ScriptError(String(error), code)
}

/**
 * Run a function and wrap any errors
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorCode?: ErrorCode,
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    throw wrapError(error, errorCode)
  }
}
