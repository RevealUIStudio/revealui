/**
 * Validation Result Builder
 *
 * Provides a builder pattern for accumulating validation results.
 * Used across generators to collect errors, warnings, and success messages.
 *
 * @dependencies
 * - None (standalone utility)
 *
 * @example
 * ```typescript
 * const builder = new ValidationResultBuilder()
 * builder.addError('Missing required field: name')
 * builder.addWarning('Deprecated API usage')
 * builder.addSuccess('All tests passed')
 *
 * const result = builder.build()
 * if (!result.isValid) {
 *   console.error('Validation failed:', result.errors)
 * }
 * ```
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Severity level for validation messages
 */
export type ValidationSeverity = 'error' | 'warning' | 'info' | 'success'

/**
 * Validation message
 */
export interface ValidationMessage {
  /** Severity level */
  severity: ValidationSeverity
  /** Message text */
  message: string
  /** Optional file path */
  file?: string
  /** Optional line number */
  line?: number
  /** Optional code reference */
  code?: string
  /** Optional context/details */
  context?: Record<string, unknown>
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed (no errors) */
  isValid: boolean
  /** Error messages */
  errors: ValidationMessage[]
  /** Warning messages */
  warnings: ValidationMessage[]
  /** Info messages */
  info: ValidationMessage[]
  /** Success messages */
  success: ValidationMessage[]
  /** All messages combined */
  all: ValidationMessage[]
  /** Summary statistics */
  summary: {
    totalErrors: number
    totalWarnings: number
    totalInfo: number
    totalSuccess: number
    totalMessages: number
  }
}

/**
 * Options for validation message
 */
export interface MessageOptions {
  /** File path */
  file?: string
  /** Line number */
  line?: number
  /** Error/warning code */
  code?: string
  /** Additional context */
  context?: Record<string, unknown>
}

// =============================================================================
// Validation Result Builder
// =============================================================================

/**
 * Builder for creating validation results
 *
 * @example
 * ```typescript
 * const builder = new ValidationResultBuilder()
 *   .addError('Invalid syntax', { file: 'test.ts', line: 10 })
 *   .addWarning('Unused variable')
 *   .addSuccess('Type check passed')
 *
 * const result = builder.build()
 * console.log(result.summary)
 * ```
 */
export class ValidationResultBuilder {
  private messages: ValidationMessage[] = []

  /**
   * Add an error message
   *
   * @param message - Error message
   * @param options - Additional options
   * @returns This builder for chaining
   */
  addError(message: string, options?: MessageOptions): this {
    this.messages.push({
      severity: 'error',
      message,
      ...options,
    })
    return this
  }

  /**
   * Add a warning message
   *
   * @param message - Warning message
   * @param options - Additional options
   * @returns This builder for chaining
   */
  addWarning(message: string, options?: MessageOptions): this {
    this.messages.push({
      severity: 'warning',
      message,
      ...options,
    })
    return this
  }

  /**
   * Add an info message
   *
   * @param message - Info message
   * @param options - Additional options
   * @returns This builder for chaining
   */
  addInfo(message: string, options?: MessageOptions): this {
    this.messages.push({
      severity: 'info',
      message,
      ...options,
    })
    return this
  }

  /**
   * Add a success message
   *
   * @param message - Success message
   * @param options - Additional options
   * @returns This builder for chaining
   */
  addSuccess(message: string, options?: MessageOptions): this {
    this.messages.push({
      severity: 'success',
      message,
      ...options,
    })
    return this
  }

  /**
   * Add a custom message with specific severity
   *
   * @param severity - Message severity
   * @param message - Message text
   * @param options - Additional options
   * @returns This builder for chaining
   */
  addMessage(severity: ValidationSeverity, message: string, options?: MessageOptions): this {
    this.messages.push({
      severity,
      message,
      ...options,
    })
    return this
  }

  /**
   * Add multiple messages at once
   *
   * @param messages - Array of messages to add
   * @returns This builder for chaining
   */
  addMessages(messages: ValidationMessage[]): this {
    this.messages.push(...messages)
    return this
  }

  /**
   * Merge results from another builder
   *
   * @param otherBuilder - Another builder to merge
   * @returns This builder for chaining
   */
  merge(otherBuilder: ValidationResultBuilder): this {
    this.messages.push(...otherBuilder.messages)
    return this
  }

  /**
   * Merge results from a validation result
   *
   * @param result - Validation result to merge
   * @returns This builder for chaining
   */
  mergeResult(result: ValidationResult): this {
    this.messages.push(...result.all)
    return this
  }

  /**
   * Clear all messages
   *
   * @returns This builder for chaining
   */
  clear(): this {
    this.messages = []
    return this
  }

  /**
   * Check if there are any error messages
   *
   * @returns True if there are errors
   */
  hasErrors(): boolean {
    return this.messages.some((m) => m.severity === 'error')
  }

  /**
   * Check if there are any warning messages
   *
   * @returns True if there are warnings
   */
  hasWarnings(): boolean {
    return this.messages.some((m) => m.severity === 'warning')
  }

  /**
   * Get error count
   *
   * @returns Number of errors
   */
  getErrorCount(): number {
    return this.messages.filter((m) => m.severity === 'error').length
  }

  /**
   * Get warning count
   *
   * @returns Number of warnings
   */
  getWarningCount(): number {
    return this.messages.filter((m) => m.severity === 'warning').length
  }

  /**
   * Build the final validation result
   *
   * @returns Validation result
   */
  build(): ValidationResult {
    const errors = this.messages.filter((m) => m.severity === 'error')
    const warnings = this.messages.filter((m) => m.severity === 'warning')
    const info = this.messages.filter((m) => m.severity === 'info')
    const success = this.messages.filter((m) => m.severity === 'success')

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      info,
      success,
      all: [...this.messages],
      summary: {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        totalInfo: info.length,
        totalSuccess: success.length,
        totalMessages: this.messages.length,
      },
    }
  }

  /**
   * Build and format as a string
   *
   * @param options - Formatting options
   * @returns Formatted string
   */
  buildFormatted(
    options: { includeSuccess?: boolean; includeInfo?: boolean; colorize?: boolean } = {},
  ): string {
    const { includeSuccess = false, includeInfo = false, colorize = false } = options
    const result = this.build()

    const lines: string[] = []

    // Add errors
    if (result.errors.length > 0) {
      lines.push(colorize ? '\x1b[31mErrors:\x1b[0m' : 'Errors:')
      for (const error of result.errors) {
        const location = error.file
          ? error.line
            ? ` (${error.file}:${error.line})`
            : ` (${error.file})`
          : ''
        lines.push(`  - ${error.message}${location}`)
      }
      lines.push('')
    }

    // Add warnings
    if (result.warnings.length > 0) {
      lines.push(colorize ? '\x1b[33mWarnings:\x1b[0m' : 'Warnings:')
      for (const warning of result.warnings) {
        const location = warning.file
          ? warning.line
            ? ` (${warning.file}:${warning.line})`
            : ` (${warning.file})`
          : ''
        lines.push(`  - ${warning.message}${location}`)
      }
      lines.push('')
    }

    // Add info (optional)
    if (includeInfo && result.info.length > 0) {
      lines.push(colorize ? '\x1b[36mInfo:\x1b[0m' : 'Info:')
      for (const infoMsg of result.info) {
        lines.push(`  - ${infoMsg.message}`)
      }
      lines.push('')
    }

    // Add success (optional)
    if (includeSuccess && result.success.length > 0) {
      lines.push(colorize ? '\x1b[32mSuccess:\x1b[0m' : 'Success:')
      for (const successMsg of result.success) {
        lines.push(`  - ${successMsg.message}`)
      }
      lines.push('')
    }

    // Add summary
    lines.push('Summary:')
    lines.push(`  Total: ${result.summary.totalMessages} messages`)
    if (result.summary.totalErrors > 0) {
      lines.push(`  Errors: ${result.summary.totalErrors}`)
    }
    if (result.summary.totalWarnings > 0) {
      lines.push(`  Warnings: ${result.summary.totalWarnings}`)
    }
    if (result.summary.totalInfo > 0) {
      lines.push(`  Info: ${result.summary.totalInfo}`)
    }
    if (result.summary.totalSuccess > 0) {
      lines.push(`  Success: ${result.summary.totalSuccess}`)
    }

    return lines.join('\n')
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a validation result from arrays
 *
 * @param errors - Error messages
 * @param warnings - Warning messages
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = createValidationResult(
 *   ['Error 1', 'Error 2'],
 *   ['Warning 1']
 * )
 * ```
 */
export function createValidationResult(
  errors: string[] = [],
  warnings: string[] = [],
): ValidationResult {
  const builder = new ValidationResultBuilder()

  for (const error of errors) {
    builder.addError(error)
  }

  for (const warning of warnings) {
    builder.addWarning(warning)
  }

  return builder.build()
}

/**
 * Merge multiple validation results
 *
 * @param results - Array of validation results
 * @returns Combined validation result
 *
 * @example
 * ```typescript
 * const result1 = builder1.build()
 * const result2 = builder2.build()
 * const combined = mergeValidationResults([result1, result2])
 * ```
 */
export function mergeValidationResults(results: ValidationResult[]): ValidationResult {
  const builder = new ValidationResultBuilder()

  for (const result of results) {
    builder.mergeResult(result)
  }

  return builder.build()
}
