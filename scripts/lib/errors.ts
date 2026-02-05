/**
 * Unified Error System
 *
 * Consolidates error-handler.ts and errors.ts into a single comprehensive error system.
 * Provides standardized error codes, enhanced error messages, suggestions, and recovery options.
 *
 * Features:
 * - Typed error codes with exit code mapping
 * - Contextual error enhancement with suggestions
 * - Pattern-based suggestion generation
 * - Documentation link generation
 * - Error recovery helpers
 * - Retry logic with enhanced errors
 *
 * @example
 * ```typescript
 * import { ScriptError, ErrorCode } from './errors.js'
 *
 * // Throw typed errors with suggestions
 * throw new ScriptError('Database connection failed', ErrorCode.EXECUTION_ERROR, {
 *   suggestions: ['Check if database is running', 'Verify DATABASE_URL'],
 *   docsUrl: 'https://docs.revealui.dev/database',
 * })
 *
 * // Use factory functions with auto-suggestions
 * throw notFound('Workflow', id) // Auto-generates helpful suggestions
 *
 * // Handle errors with proper exit codes
 * try {
 *   await runCommand()
 * } catch (error) {
 *   if (error instanceof ScriptError) {
 *     console.error(error.format()) // Pretty formatted error
 *     process.exit(error.code)
 *   }
 *   process.exit(ErrorCode.GENERAL_ERROR)
 * }
 * ```
 *
 * @dependencies
 * - None (foundational module with no external dependencies)
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
// biome-ignore lint/style/useNamingConvention: Error codes use SCREAMING_SNAKE_CASE by convention
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
 * Enhanced error options
 */
export interface EnhancedErrorOptions {
  /** Additional error details/context */
  context?: Record<string, unknown>
  /** Suggested fixes for the error */
  suggestions?: string[]
  /** Documentation URL for more information */
  docsUrl?: string
  /** Recovery steps that can be attempted */
  recovery?: string[]
  /** Whether this error is recoverable */
  recoverable?: boolean
  /** What operation was being performed */
  operation?: string
}

/**
 * Unified error class for CLI scripts
 *
 * Includes error codes, contextual information, suggestions, and recovery options.
 * Merges functionality from both ScriptError and EnhancedError.
 */
export class ScriptError extends Error {
  /** Error code (maps to exit code) */
  public readonly code: ErrorCode

  /** Additional error details/context */
  public readonly context?: Record<string, unknown>

  /** Error code as string (for JSON output) */
  public readonly codeString: string

  /** Suggested fixes for this error */
  public readonly suggestions?: string[]

  /** Documentation URL */
  public readonly docsUrl?: string

  /** Recovery steps */
  public readonly recovery?: string[]

  /** Whether this error is recoverable */
  public readonly recoverable?: boolean

  /** Operation being performed when error occurred */
  public readonly operation?: string

  /** Timestamp when error was created */
  public readonly timestamp: number

  /** Original error if this wraps another error */
  public readonly originalError?: Error

  // Legacy property for backward compatibility
  public get details(): Record<string, unknown> | undefined {
    return this.context
  }

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.GENERAL_ERROR,
    options?: EnhancedErrorOptions | Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ScriptError'
    this.code = code
    this.codeString = ErrorCode[code] ?? 'UNKNOWN'
    this.timestamp = Date.now()

    // Handle both old-style (details) and new-style (EnhancedErrorOptions)
    if (options) {
      // Use 'in' operator for type-safe property access with proper type assertions
      this.context =
        'context' in options
          ? (options.context as Record<string, unknown> | undefined)
          : (options as Record<string, unknown>)
      this.suggestions =
        'suggestions' in options
          ? ((options.suggestions as string[] | undefined) ??
            generateSuggestionsFromMessage(message, this.codeString))
          : generateSuggestionsFromMessage(message, this.codeString)
      this.docsUrl =
        'docsUrl' in options
          ? ((options.docsUrl as string | undefined) ??
            getDocumentationUrl(message, this.codeString))
          : getDocumentationUrl(message, this.codeString)
      this.recovery = 'recovery' in options ? (options.recovery as string[] | undefined) : undefined
      this.recoverable =
        'recoverable' in options ? (options.recoverable as boolean | undefined) : undefined
      this.operation =
        'operation' in options ? (options.operation as string | undefined) : undefined
    } else {
      // Auto-generate suggestions and docs URL
      this.suggestions = generateSuggestionsFromMessage(message, this.codeString)
      this.docsUrl = getDocumentationUrl(message, this.codeString)
    }

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
    context?: Record<string, unknown>
    suggestions?: string[]
    docsUrl?: string
    recovery?: string[]
    timestamp: number
  } {
    return {
      code: this.codeString,
      exitCode: this.code,
      message: this.message,
      ...(this.context && { context: this.context }),
      ...(this.suggestions && { suggestions: this.suggestions }),
      ...(this.docsUrl && { docsUrl: this.docsUrl }),
      ...(this.recovery && { recovery: this.recovery }),
      timestamp: this.timestamp,
    }
  }

  /**
   * Get the human-readable description for this error's code
   */
  getCodeDescription(): string {
    return ErrorCodeDescriptions[this.code] ?? 'Unknown error'
  }

  /**
   * Format error for display with colors and suggestions
   */
  format(verbose = false): string {
    const parts: string[] = []

    // Error header
    parts.push('\x1b[31m✖ Error\x1b[0m')

    // Operation context
    if (this.operation) {
      parts.push(`\nOperation: ${this.operation}`)
    }

    // Error message
    parts.push(`\n${this.message}`)
    parts.push(`\nCode: ${this.codeString} (exit ${this.code})`)

    // Additional context
    if (verbose && this.context) {
      parts.push('\n\nContext:')
      for (const [key, value] of Object.entries(this.context)) {
        parts.push(`  ${key}: ${JSON.stringify(value)}`)
      }
    }

    // Suggestions
    if (this.suggestions && this.suggestions.length > 0) {
      parts.push('\n\n💡 Suggested fixes:')
      for (const suggestion of this.suggestions) {
        parts.push(`  • ${suggestion}`)
      }
    }

    // Recovery steps
    if (this.recovery && this.recovery.length > 0) {
      parts.push('\n\n🔄 Recovery steps:')
      for (const step of this.recovery) {
        parts.push(`  ${step}`)
      }
    }

    // Documentation link
    if (this.docsUrl) {
      parts.push(`\n\n📚 Learn more: ${this.docsUrl}`)
    }

    // Stack trace (if verbose)
    if (verbose && this.stack) {
      parts.push('\n\nStack trace:')
      parts.push(this.stack)
    }

    return parts.join('')
  }

  /**
   * Print error to console with formatting
   */
  print(verbose = false): void {
    console.error(this.format(verbose))
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

// =============================================================================
// Error Enhancement Helpers
// =============================================================================

/**
 * Generate helpful suggestions based on error message patterns
 */
function generateSuggestionsFromMessage(message: string, codeString: string): string[] {
  const lowerMessage = message.toLowerCase()
  const suggestions: string[] = []

  // Database errors
  if (lowerMessage.includes('econnrefused') || lowerMessage.includes('connection refused')) {
    suggestions.push('Check if the database server is running')
    suggestions.push('Verify the DATABASE_URL environment variable')
    suggestions.push('Ensure the database port is accessible')
  }

  // Environment variable errors
  if (lowerMessage.includes('env') || lowerMessage.includes('environment')) {
    suggestions.push('Run: pnpm setup:env')
    suggestions.push('Check if .env file exists')
    suggestions.push('Verify all required environment variables are set')
  }

  // Module not found errors
  if (lowerMessage.includes('cannot find module') || lowerMessage.includes('module not found')) {
    suggestions.push('Run: pnpm install')
    suggestions.push('Check if the package is listed in package.json')
    suggestions.push('Try: pnpm clean:install')
  }

  // Permission errors
  if (lowerMessage.includes('eacces') || lowerMessage.includes('permission denied')) {
    suggestions.push('Check file permissions')
    suggestions.push('Try running with appropriate permissions')
    suggestions.push('Ensure you have write access to the directory')
  }

  // Network errors
  if (lowerMessage.includes('enotfound') || lowerMessage.includes('getaddrinfo')) {
    suggestions.push('Check your internet connection')
    suggestions.push('Verify the URL or hostname is correct')
    suggestions.push('Check if a VPN or proxy is blocking the connection')
  }

  // Port already in use
  if (
    lowerMessage.includes('eaddrinuse') ||
    (lowerMessage.includes('port') && lowerMessage.includes('use'))
  ) {
    suggestions.push('Stop the process using the port')
    suggestions.push('Use a different port')
    suggestions.push('Run: lsof -i :<port> to find the process')
  }

  // TypeScript errors
  if (lowerMessage.includes('type') || lowerMessage.includes('typescript')) {
    suggestions.push('Run: pnpm typecheck:all')
    suggestions.push('Check for missing type definitions')
    suggestions.push('Update @types packages')
  }

  // Build errors
  if (lowerMessage.includes('build') && lowerMessage.includes('fail')) {
    suggestions.push('Run: pnpm clean')
    suggestions.push('Delete node_modules and reinstall: pnpm clean:install')
    suggestions.push('Check for TypeScript errors: pnpm typecheck:all')
  }

  // Test errors
  if (lowerMessage.includes('test') && lowerMessage.includes('fail')) {
    suggestions.push('Run tests in verbose mode: pnpm test --verbose')
    suggestions.push('Check test setup and configuration')
    suggestions.push('Ensure test database is initialized: pnpm db:setup-test')
  }

  // Git errors
  if (lowerMessage.includes('git') || lowerMessage.includes('repository')) {
    suggestions.push('Check if you are in a git repository')
    suggestions.push('Verify git is installed: git --version')
    suggestions.push('Check git remote configuration: git remote -v')
  }

  // File not found
  if (lowerMessage.includes('enoent') || lowerMessage.includes('no such file')) {
    suggestions.push('Check if the file path is correct')
    suggestions.push('Verify the file exists')
    suggestions.push('Check for typos in the file name')
  }

  // Timeout errors
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    suggestions.push('Increase the timeout limit')
    suggestions.push('Check for network or performance issues')
    suggestions.push('Try the operation again')
  }

  // Error code specific suggestions
  if (codeString === 'NOT_FOUND') {
    suggestions.push('Verify the resource identifier is correct')
    suggestions.push('Check if the resource was deleted')
  }

  if (codeString === 'VALIDATION_ERROR') {
    suggestions.push('Check the input value')
    suggestions.push('Verify the value meets requirements')
    suggestions.push('See error message for details')
  }

  return suggestions
}

/**
 * Get documentation URL based on error type
 */
function getDocumentationUrl(message: string, codeString: string): string | undefined {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('database') || lowerMessage.includes('connection')) {
    return 'https://docs.revealui.dev/database-setup'
  }

  if (lowerMessage.includes('env') || lowerMessage.includes('environment')) {
    return 'https://docs.revealui.dev/environment-setup'
  }

  if (lowerMessage.includes('build')) {
    return 'https://docs.revealui.dev/build-setup'
  }

  if (lowerMessage.includes('test')) {
    return 'https://docs.revealui.dev/testing'
  }

  if (codeString === 'CONFIG_ERROR') {
    return 'https://docs.revealui.dev/configuration'
  }

  return 'https://docs.revealui.dev/troubleshooting'
}

// =============================================================================
// Error Recovery Helpers
// =============================================================================

/**
 * Retry a function with enhanced error handling
 */
export async function retryWithEnhancedErrors<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number
    delay?: number
    operation?: string
    context?: Record<string, unknown>
  } = {},
): Promise<T> {
  const { retries = 3, delay = 1000, operation, context = {} } = options

  let lastError: Error | undefined

  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (i < retries - 1) {
        console.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // Wrap last error with retry context
  if (lastError instanceof ScriptError) {
    throw new ScriptError(lastError.message, lastError.code, {
      ...lastError.context,
      context: {
        ...lastError.context,
        ...context,
        attempts: retries,
      },
      suggestions: lastError.suggestions,
      docsUrl: lastError.docsUrl,
      operation: operation ?? lastError.operation,
    })
  }

  throw new ScriptError(lastError?.message ?? 'Unknown error', ErrorCode.GENERAL_ERROR, {
    context: { ...context, attempts: retries },
    operation,
  })
}

/**
 * Wrap a function with enhanced error handling
 */
// biome-ignore lint/suspicious/noExplicitAny: Generic function wrapper requires any for flexibility
export function withEnhancedErrors<T extends (...args: any[]) => any>(
  fn: T,
  options: Omit<EnhancedErrorOptions, 'context'> & { code?: ErrorCode } = {},
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args)
      if (result instanceof Promise) {
        return result.catch((error) => {
          if (error instanceof ScriptError) {
            throw error
          }
          throw new ScriptError(
            error.message ?? String(error),
            options.code ?? ErrorCode.GENERAL_ERROR,
            options,
          )
        })
      }
      return result
    } catch (error) {
      if (error instanceof ScriptError) {
        throw error
      }
      throw new ScriptError(
        (error as Error).message ?? String(error),
        options.code ?? ErrorCode.GENERAL_ERROR,
        options,
      )
    }
  }) as T
}
