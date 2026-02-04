/**
 * Dual-Mode Output System
 *
 * Provides unified output handling for CLI scripts that supports both
 * human-readable (colored, formatted) and machine-readable (JSON) modes.
 *
 * @example
 * ```typescript
 * const output = new OutputHandler(args.flags.json ? 'json' : 'human')
 *
 * // Progress messages (suppressed in JSON mode)
 * output.progress('Processing files...')
 *
 * // Final result (formatted for humans, JSON for agents)
 * output.result({
 *   success: true,
 *   data: { workflows: [...] },
 *   metadata: { duration: 123 }
 * })
 * ```
 *
 * @dependencies
 * - scripts/lib/logger.ts - Colored console logging utilities
 */

import { createLogger, type Logger } from './logger.js'

// =============================================================================
// Types
// =============================================================================

export type OutputMode = 'human' | 'json'

export interface ScriptOutput<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean
  /** Result data (if successful) */
  data?: T
  /** Error information (if failed) */
  error?: OutputErrorInfo
  /** Optional metadata about the operation */
  metadata?: OutputMetadata
}

export interface OutputErrorInfo {
  /** Error code (maps to exit code) */
  code: string
  /** Human-readable error message */
  message: string
  /** Additional error details */
  details?: Record<string, unknown>
}

export interface OutputMetadata {
  /** Operation duration in milliseconds */
  duration?: number
  /** ISO timestamp of operation */
  timestamp?: string
  /** Number of items processed */
  count?: number
  /** Additional metadata */
  [key: string]: unknown
}

export interface OutputHandlerOptions {
  /** Output mode: 'human' for colored output, 'json' for machine-readable */
  mode: OutputMode
  /** Logger options for human mode */
  loggerPrefix?: string
  /** Whether to include timestamps in human output */
  timestamps?: boolean
  /** Stream to write JSON output to (default: stdout) */
  jsonStream?: NodeJS.WritableStream
}

// =============================================================================
// Output Handler
// =============================================================================

/**
 * Dual-mode output handler for CLI scripts
 */
export class OutputHandler {
  private mode: OutputMode
  private logger: Logger
  private jsonStream: NodeJS.WritableStream
  private startTime: number

  constructor(options: OutputHandlerOptions | OutputMode) {
    const opts = typeof options === 'string' ? { mode: options } : options

    this.mode = opts.mode
    this.jsonStream = opts.jsonStream ?? process.stdout
    this.startTime = Date.now()

    // In JSON mode, suppress all logger output
    this.logger = createLogger({
      level: opts.mode === 'json' ? 'silent' : 'info',
      prefix: opts.loggerPrefix,
      timestamps: opts.timestamps,
    })
  }

  /**
   * Get the current output mode
   */
  getMode(): OutputMode {
    return this.mode
  }

  /**
   * Check if in JSON mode
   */
  isJsonMode(): boolean {
    return this.mode === 'json'
  }

  /**
   * Log a progress message (suppressed in JSON mode)
   */
  progress(message: string): void {
    if (this.mode === 'human') {
      this.logger.info(message)
    }
  }

  /**
   * Log a debug message (suppressed in JSON mode)
   */
  debug(message: string): void {
    if (this.mode === 'human') {
      this.logger.debug(message)
    }
  }

  /**
   * Log a warning (suppressed in JSON mode)
   */
  warn(message: string): void {
    if (this.mode === 'human') {
      this.logger.warn(message)
    }
  }

  /**
   * Show a progress bar (suppressed in JSON mode)
   */
  progressBar(current: number, total: number, label?: string): void {
    if (this.mode === 'human') {
      this.logger.progress(current, total, label)
    }
  }

  /**
   * Print a header (suppressed in JSON mode)
   */
  header(title: string): void {
    if (this.mode === 'human') {
      this.logger.header(title)
    }
  }

  /**
   * Print a divider line (suppressed in JSON mode)
   */
  divider(): void {
    if (this.mode === 'human') {
      this.logger.divider()
    }
  }

  /**
   * Output the final result
   *
   * In human mode: Formats and prints using logger
   * In JSON mode: Outputs structured JSON to stdout
   */
  result<T>(output: ScriptOutput<T>): void {
    // Add metadata if not present
    const enriched: ScriptOutput<T> = {
      ...output,
      metadata: {
        duration: Date.now() - this.startTime,
        timestamp: new Date().toISOString(),
        ...output.metadata,
      },
    }

    if (this.mode === 'json') {
      this.outputJson(enriched)
    } else {
      this.outputHuman(enriched)
    }
  }

  /**
   * Output a successful result
   */
  success<T>(data: T, metadata?: OutputMetadata): void {
    this.result({ success: true, data, metadata })
  }

  /**
   * Output an error result
   */
  error(error: OutputErrorInfo, metadata?: OutputMetadata): void {
    this.result({ success: false, error, metadata })
  }

  /**
   * Output raw data (for list/table commands)
   */
  data<T>(items: T[], options?: { format?: 'table' | 'list' }): void {
    if (this.mode === 'json') {
      this.outputJson({ success: true, data: items })
    } else if (options?.format === 'table' && Array.isArray(items) && items.length > 0) {
      this.logger.table(items as Record<string, unknown>[])
    } else {
      for (const item of items) {
        if (typeof item === 'object' && item !== null) {
          console.log(formatObject(item as Record<string, unknown>))
        } else {
          console.log(String(item))
        }
      }
    }
  }

  /**
   * Get the underlying logger (for advanced human-mode output)
   */
  getLogger(): Logger {
    return this.logger
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private outputJson<T>(output: ScriptOutput<T>): void {
    this.jsonStream.write(`${JSON.stringify(output, null, 2)}\n`)
  }

  private outputHuman<T>(output: ScriptOutput<T>): void {
    if (output.success) {
      if (output.data !== undefined) {
        if (typeof output.data === 'object' && output.data !== null) {
          if (Array.isArray(output.data)) {
            for (const item of output.data) {
              console.log(formatObject(item as Record<string, unknown>))
            }
          } else {
            console.log(formatObject(output.data as Record<string, unknown>))
          }
        } else {
          console.log(output.data)
        }
      }
      if (output.metadata?.duration) {
        this.logger.success(`Completed in ${output.metadata.duration}ms`)
      } else {
        this.logger.success('Completed')
      }
    } else if (output.error) {
      this.logger.error(`${output.error.message}`)
      if (output.error.details) {
        for (const [key, value] of Object.entries(output.error.details)) {
          this.logger.error(`  ${key}: ${value}`)
        }
      }
    }
  }
}

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Format an object for human-readable output
 */
function formatObject(obj: Record<string, unknown>, indent = 0): string {
  const pad = '  '.repeat(indent)
  const lines: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${pad}${key}:`)
      lines.push(formatObject(value as Record<string, unknown>, indent + 1))
    } else if (Array.isArray(value)) {
      lines.push(`${pad}${key}: [${value.length} items]`)
    } else {
      lines.push(`${pad}${key}: ${value}`)
    }
  }

  return lines.join('\n')
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an output handler based on CLI flags
 */
export function createOutput(
  flags: { json?: boolean; [key: string]: unknown },
  options?: Partial<Omit<OutputHandlerOptions, 'mode'>>,
): OutputHandler {
  return new OutputHandler({
    mode: flags.json ? 'json' : 'human',
    ...options,
  })
}

/**
 * Create a result object for success
 */
export function ok<T>(data: T, metadata?: OutputMetadata): ScriptOutput<T> {
  return { success: true, data, metadata }
}

/**
 * Create a result object for failure
 */
export function fail(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ScriptOutput<never> {
  return {
    success: false,
    error: { code, message, details },
  }
}
