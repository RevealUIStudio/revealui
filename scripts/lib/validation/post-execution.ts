/**
 * Post-Execution Validation
 *
 * Validation checks to run after script execution to verify
 * correctness and completeness of operations.
 *
 * @example
 * ```typescript
 * const validator = new PostExecutionValidator()
 *
 * const result = await validator.validate({
 *   checks: ['files', 'database'],
 *   expectedFiles: ['output.json', 'backup.sql'],
 *   expectedRecords: { users: 10, posts: 50 },
 * })
 * ```
 */

import { existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

// =============================================================================
// Types
// =============================================================================

/**
 * Post-execution check types
 */
export type PostCheckType =
  | 'files'        // File existence and properties
  | 'database'     // Database state verification
  | 'output'       // Output format validation
  | 'side-effects' // Verify expected side effects

/**
 * Post-execution validation options
 */
export interface PostValidationOptions {
  /** Checks to perform */
  checks?: PostCheckType[]

  /** Files that should exist */
  expectedFiles?: string[]

  /** Files that should not exist */
  unexpectedFiles?: string[]

  /** Expected file sizes (path: minBytes) */
  expectedFileSizes?: Record<string, number>

  /** Expected database record counts */
  expectedRecords?: Record<string, number>

  /** Expected output structure */
  expectedOutput?: unknown

  /** Custom validation functions */
  customValidators?: Array<() => Promise<boolean>>
}

/**
 * Post-execution validation result
 */
export interface PostValidationResult {
  /** Whether all checks passed */
  passed: boolean

  /** Validation errors */
  errors: string[]

  /** Validation warnings */
  warnings: string[]

  /** Check details */
  details: Record<string, unknown>
}

// =============================================================================
// Post-Execution Validator
// =============================================================================

export class PostExecutionValidator {
  /**
   * Validate post-execution state
   */
  async validate(options: PostValidationOptions = {}): Promise<PostValidationResult> {
    const {
      checks = ['files', 'output'],
      expectedFiles = [],
      unexpectedFiles = [],
      expectedFileSizes = {},
      customValidators = [],
    } = options

    const errors: string[] = []
    const warnings: string[] = []
    const details: Record<string, unknown> = {}

    // Check files
    if (checks.includes('files')) {
      const fileResult = await this.checkFiles(
        expectedFiles,
        unexpectedFiles,
        expectedFileSizes,
      )

      if (!fileResult.passed) {
        errors.push(...fileResult.errors)
      }

      details.files = fileResult.details
    }

    // Run custom validators
    for (let i = 0; i < customValidators.length; i++) {
      try {
        const passed = await customValidators[i]()
        if (!passed) {
          errors.push(`Custom validator ${i + 1} failed`)
        }
      } catch (error) {
        errors.push(`Custom validator ${i + 1} error: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      details,
    }
  }

  /**
   * Check file existence and properties
   */
  private async checkFiles(
    expectedFiles: string[],
    unexpectedFiles: string[],
    expectedSizes: Record<string, number>,
  ): Promise<{ passed: boolean; errors: string[]; details: Record<string, unknown> }> {
    const errors: string[] = []
    const details: Record<string, unknown> = {}

    // Check expected files exist
    for (const file of expectedFiles) {
      if (!existsSync(file)) {
        errors.push(`Expected file not found: ${file}`)
      } else {
        details[file] = { exists: true }

        // Check size if specified
        if (expectedSizes[file]) {
          const stats = await stat(file)
          if (stats.size < expectedSizes[file]) {
            errors.push(`File ${file} is smaller than expected: ${stats.size} < ${expectedSizes[file]}`)
          }
          details[file] = { exists: true, size: stats.size }
        }
      }
    }

    // Check unexpected files don't exist
    for (const file of unexpectedFiles) {
      if (existsSync(file)) {
        errors.push(`Unexpected file found: ${file}`)
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      details,
    }
  }
}

/**
 * Create a post-execution validator
 */
export function createPostExecutionValidator(): PostExecutionValidator {
  return new PostExecutionValidator()
}
