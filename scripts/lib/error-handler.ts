/**
 * Enhanced Error Handler
 *
 * Provides helpful error messages with context, suggestions, and recovery options.
 *
 * @example
 * ```typescript
 * import { enhanceError, ErrorContext } from './error-handler.js'
 *
 * try {
 *   await someOperation()
 * } catch (error) {
 *   throw enhanceError(error, {
 *     operation: 'database connection',
 *     suggestions: ['Check DATABASE_URL', 'Ensure database is running'],
 *   })
 * }
 * ```
 */

import { createLogger } from './logger.js'
import { ErrorCode, type ScriptError } from './errors.js'

const logger = createLogger({ prefix: 'ErrorHandler' })

// =============================================================================
// Types
// =============================================================================

export interface ErrorContext {
  /** What operation was being performed */
  operation?: string
  /** Additional context about the error */
  context?: Record<string, unknown>
  /** Suggested fixes */
  suggestions?: string[]
  /** Documentation link */
  docsUrl?: string
  /** Related errors */
  relatedErrors?: Error[]
  /** Whether this error is recoverable */
  recoverable?: boolean
}

export interface EnhancedError extends Error {
  originalError?: Error
  context?: ErrorContext
  code?: ErrorCode | string
  timestamp: number
}

// =============================================================================
// Error Enhancement
// =============================================================================

/**
 * Enhance an error with helpful context and suggestions
 */
export function enhanceError(
  error: Error | string,
  context: ErrorContext = {}
): EnhancedError {
  const originalError = error instanceof Error ? error : new Error(error)
  const enhanced = originalError as EnhancedError

  enhanced.originalError = originalError
  enhanced.context = context
  enhanced.timestamp = Date.now()

  // Add suggestions based on error patterns
  if (!context.suggestions) {
    enhanced.context!.suggestions = generateSuggestions(originalError)
  }

  // Add documentation links
  if (!context.docsUrl) {
    enhanced.context!.docsUrl = getDocumentationUrl(originalError)
  }

  return enhanced
}

/**
 * Format error for display
 */
export function formatError(error: EnhancedError | Error, verbose = false): string {
  const enhanced = error as EnhancedError
  const parts: string[] = []

  // Error header
  parts.push('\x1b[31m✖ Error\x1b[0m')

  // Operation context
  if (enhanced.context?.operation) {
    parts.push(`\nOperation: ${enhanced.context.operation}`)
  }

  // Error message
  parts.push(`\n${error.message}`)

  // Additional context
  if (verbose && enhanced.context?.context) {
    parts.push('\n\nContext:')
    for (const [key, value] of Object.entries(enhanced.context.context)) {
      parts.push(`  ${key}: ${JSON.stringify(value)}`)
    }
  }

  // Suggestions
  if (enhanced.context?.suggestions && enhanced.context.suggestions.length > 0) {
    parts.push('\n\n💡 Suggested fixes:')
    for (const suggestion of enhanced.context.suggestions) {
      parts.push(`  • ${suggestion}`)
    }
  }

  // Documentation link
  if (enhanced.context?.docsUrl) {
    parts.push(`\n\n📚 Learn more: ${enhanced.context.docsUrl}`)
  }

  // Stack trace (if verbose)
  if (verbose && error.stack) {
    parts.push('\n\nStack trace:')
    parts.push(error.stack)
  }

  return parts.join('')
}

/**
 * Print error to console with formatting
 */
export function printError(error: EnhancedError | Error, verbose = false): void {
  console.error(formatError(error, verbose))
}

// =============================================================================
// Error Pattern Matching
// =============================================================================

/**
 * Generate helpful suggestions based on error patterns
 */
function generateSuggestions(error: Error): string[] {
  const message = error.message.toLowerCase()
  const suggestions: string[] = []

  // Database errors
  if (message.includes('econnrefused') || message.includes('connection refused')) {
    suggestions.push('Check if the database server is running')
    suggestions.push('Verify the DATABASE_URL environment variable')
    suggestions.push('Ensure the database port is accessible')
  }

  // Environment variable errors
  if (message.includes('env') || message.includes('environment')) {
    suggestions.push('Run: pnpm setup:env')
    suggestions.push('Check if .env file exists')
    suggestions.push('Verify all required environment variables are set')
  }

  // Module not found errors
  if (message.includes('cannot find module') || message.includes('module not found')) {
    suggestions.push('Run: pnpm install')
    suggestions.push('Check if the package is listed in package.json')
    suggestions.push('Try: pnpm clean:install')
  }

  // Permission errors
  if (message.includes('eacces') || message.includes('permission denied')) {
    suggestions.push('Check file permissions')
    suggestions.push('Try running with appropriate permissions')
    suggestions.push('Ensure you have write access to the directory')
  }

  // Network errors
  if (message.includes('enotfound') || message.includes('getaddrinfo')) {
    suggestions.push('Check your internet connection')
    suggestions.push('Verify the URL or hostname is correct')
    suggestions.push('Check if a VPN or proxy is blocking the connection')
  }

  // Port already in use
  if (message.includes('eaddrinuse') || message.includes('port') && message.includes('use')) {
    suggestions.push('Stop the process using the port')
    suggestions.push('Use a different port')
    suggestions.push('Run: lsof -i :<port> to find the process')
  }

  // TypeScript errors
  if (message.includes('type') || message.includes('typescript')) {
    suggestions.push('Run: pnpm typecheck:all')
    suggestions.push('Check for missing type definitions')
    suggestions.push('Update @types packages')
  }

  // Build errors
  if (message.includes('build') && message.includes('fail')) {
    suggestions.push('Run: pnpm clean')
    suggestions.push('Delete node_modules and reinstall: pnpm clean:install')
    suggestions.push('Check for TypeScript errors: pnpm typecheck:all')
  }

  // Test errors
  if (message.includes('test') && message.includes('fail')) {
    suggestions.push('Run tests in verbose mode: pnpm test --verbose')
    suggestions.push('Check test setup and configuration')
    suggestions.push('Ensure test database is initialized: pnpm db:setup-test')
  }

  // Git errors
  if (message.includes('git') || message.includes('repository')) {
    suggestions.push('Check if you are in a git repository')
    suggestions.push('Verify git is installed: git --version')
    suggestions.push('Check git remote configuration: git remote -v')
  }

  // File not found
  if (message.includes('enoent') || message.includes('no such file')) {
    suggestions.push('Check if the file path is correct')
    suggestions.push('Verify the file exists')
    suggestions.push('Check for typos in the file name')
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    suggestions.push('Increase the timeout limit')
    suggestions.push('Check for network or performance issues')
    suggestions.push('Try the operation again')
  }

  return suggestions
}

/**
 * Get documentation URL based on error type
 */
function getDocumentationUrl(error: Error): string | undefined {
  const message = error.message.toLowerCase()

  if (message.includes('database') || message.includes('connection')) {
    return 'https://docs.revealui.dev/database-setup'
  }

  if (message.includes('env') || message.includes('environment')) {
    return 'https://docs.revealui.dev/environment-setup'
  }

  if (message.includes('build')) {
    return 'https://docs.revealui.dev/build-setup'
  }

  if (message.includes('test')) {
    return 'https://docs.revealui.dev/testing'
  }

  return 'https://docs.revealui.dev/troubleshooting'
}

// =============================================================================
// Common Error Handlers
// =============================================================================

/**
 * Handle database connection errors
 */
export function handleDatabaseError(error: Error): EnhancedError {
  return enhanceError(error, {
    operation: 'database connection',
    suggestions: [
      'Check if the database server is running',
      'Verify DATABASE_URL in .env file',
      'Run: pnpm db:status',
      'Initialize database: pnpm db:init',
    ],
    docsUrl: 'https://docs.revealui.dev/database-setup',
    recoverable: true,
  })
}

/**
 * Handle file system errors
 */
export function handleFileSystemError(error: Error, filePath?: string): EnhancedError {
  const suggestions = ['Check file permissions', 'Verify the file path is correct']

  if (filePath) {
    suggestions.push(`File path: ${filePath}`)
  }

  return enhanceError(error, {
    operation: 'file system operation',
    context: filePath ? { filePath } : undefined,
    suggestions,
    recoverable: true,
  })
}

/**
 * Handle network errors
 */
export function handleNetworkError(error: Error, url?: string): EnhancedError {
  return enhanceError(error, {
    operation: 'network request',
    context: url ? { url } : undefined,
    suggestions: [
      'Check your internet connection',
      'Verify the URL is correct',
      'Check if a firewall or VPN is blocking the connection',
      'Try again in a few moments',
    ],
    recoverable: true,
  })
}

/**
 * Handle validation errors
 */
export function handleValidationError(
  error: Error,
  field?: string,
  value?: unknown
): EnhancedError {
  return enhanceError(error, {
    operation: 'validation',
    context: field && value ? { field, value } : undefined,
    suggestions: [
      'Check the input value',
      'Verify the value meets requirements',
      'See error message for details',
    ],
    recoverable: true,
  })
}

/**
 * Handle command execution errors
 */
export function handleCommandError(error: Error, command: string): EnhancedError {
  return enhanceError(error, {
    operation: 'command execution',
    context: { command },
    suggestions: [
      'Check if the command exists',
      'Verify the command syntax',
      'Ensure required dependencies are installed',
      `Try running: ${command}`,
    ],
    recoverable: false,
  })
}

// =============================================================================
// Error Recovery
// =============================================================================

/**
 * Attempt to recover from an error
 */
export async function attemptRecovery(
  error: EnhancedError,
  retryFn?: () => Promise<unknown>
): Promise<{ recovered: boolean; result?: unknown }> {
  if (!error.context?.recoverable) {
    return { recovered: false }
  }

  logger.warn('Attempting error recovery...')

  // Log suggestions
  if (error.context.suggestions) {
    logger.info('Suggested fixes:')
    for (const suggestion of error.context.suggestions) {
      logger.info(`  • ${suggestion}`)
    }
  }

  // Retry if function provided
  if (retryFn) {
    try {
      const result = await retryFn()
      logger.success('Recovery successful')
      return { recovered: true, result }
    } catch (retryError) {
      logger.error('Recovery failed')
      return { recovered: false }
    }
  }

  return { recovered: false }
}

/**
 * Wrap a function with error enhancement
 */
export function withErrorHandler<T extends (...args: any[]) => any>(
  fn: T,
  context: ErrorContext
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args)
      if (result instanceof Promise) {
        return result.catch((error) => {
          throw enhanceError(error, context)
        })
      }
      return result
    } catch (error) {
      throw enhanceError(error as Error, context)
    }
  }) as T
}

/**
 * Create a retry wrapper with enhanced error handling
 */
export async function retryWithEnhancedErrors<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number
    delay?: number
    context?: ErrorContext
  } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, context = {} } = options

  let lastError: Error | undefined

  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (i < retries - 1) {
        logger.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw enhanceError(lastError!, {
    ...context,
    context: {
      ...context.context,
      attempts: retries,
    },
  })
}
