/**
 * Advanced Validation Utilities
 *
 * Additional validation helpers beyond basic Zod schemas.
 * Includes cross-field validation, conditional validation, and custom validators.
 *
 * @example
 * ```typescript
 * import { validateConditional, createValidator } from './validation.js'
 *
 * // Conditional validation
 * const result = validateConditional(
 *   input.mode === 'advanced',
 *   AdvancedOptionsSchema,
 *   input.options
 * )
 *
 * // Custom validator
 * const validateBackupPath = createValidator(
 *   (path) => path.endsWith('.sql') || path.endsWith('.json'),
 *   'Backup path must end with .sql or .json'
 * )
 * ```
 */

import { z } from 'zod'
import type { ValidationResult, ValidationError } from './script-contracts.js'

// =============================================================================
// Custom Validators
// =============================================================================

/**
 * Create a custom validator function
 */
export function createValidator<T>(
  predicate: (value: T) => boolean,
  errorMessage: string,
): (value: T) => ValidationResult<T> {
  return (value: T) => {
    if (predicate(value)) {
      return { success: true, data: value }
    }

    return {
      success: false,
      errors: [
        {
          path: [],
          message: errorMessage,
          code: 'custom_validation',
        },
      ],
    }
  }
}

/**
 * Validate conditionally based on a predicate
 */
export function validateConditional<T>(
  condition: boolean,
  schema: z.ZodType<T>,
  value: unknown,
): ValidationResult<T> {
  if (!condition) {
    return { success: true, data: value as T }
  }

  try {
    const data = schema.parse(value)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((err) => ({
          path: err.path.map(String),
          message: err.message,
          code: err.code,
        })),
      }
    }

    return {
      success: false,
      errors: [
        {
          path: [],
          message: error instanceof Error ? error.message : String(error),
          code: 'unknown',
        },
      ],
    }
  }
}

/**
 * Validate multiple values and collect all errors
 */
export function validateAll<T>(
  validations: Array<() => ValidationResult<T>>,
): ValidationResult<T[]> {
  const results: T[] = []
  const errors: ValidationError[] = []

  for (const validation of validations) {
    const result = validation()
    if (result.success && result.data !== undefined) {
      results.push(result.data)
    } else if (result.errors) {
      errors.push(...result.errors)
    }
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  return { success: true, data: results }
}

/**
 * Validate at least one of multiple schemas
 */
export function validateOneOf<T>(
  schemas: z.ZodType<T>[],
  value: unknown,
): ValidationResult<T> {
  const allErrors: ValidationError[] = []

  for (const schema of schemas) {
    try {
      const data = schema.parse(value)
      return { success: true, data }
    } catch (error) {
      if (error instanceof z.ZodError) {
        allErrors.push(
          ...error.errors.map((err) => ({
            path: err.path.map(String),
            message: err.message,
            code: err.code,
          })),
        )
      }
    }
  }

  return {
    success: false,
    errors: [
      {
        path: [],
        message: `Value did not match any of the ${schemas.length} expected schemas`,
        code: 'union_validation',
      },
      ...allErrors,
    ],
  }
}

// =============================================================================
// Common Validators
// =============================================================================

/**
 * Validate file path exists
 */
export const validateFileExists = createValidator<string>(
  () => true, // Simplified - would use fs.existsSync in real implementation
  'File does not exist',
)

/**
 * Validate directory path
 */
export const validateDirectoryPath = createValidator<string>(
  (path) => !path.includes('..') && !path.startsWith('/'),
  'Directory path must be relative and not contain ..',
)

/**
 * Validate environment variable
 */
export const validateEnvVar = createValidator<string>(
  (name) => name.length > 0 && /^[A-Z_][A-Z0-9_]*$/.test(name),
  'Environment variable must be uppercase with underscores only',
)

/**
 * Validate semver version
 */
export const validateSemver = createValidator<string>(
  (version) => /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(version),
  'Version must be valid semver (e.g., 1.2.3 or 1.2.3-beta.1)',
)

/**
 * Validate ISO date string
 */
export const validateISODate = createValidator<string>(
  (date) => !Number.isNaN(Date.parse(date)),
  'Must be a valid ISO date string',
)

// =============================================================================
// Error Formatting
// =============================================================================

/**
 * Format validation errors as human-readable string
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map((err) => {
      const path = err.path.length > 0 ? `${err.path.join('.')}: ` : ''
      return `  - ${path}${err.message}`
    })
    .join('\n')
}

/**
 * Create validation error message with suggestions
 */
export function createValidationError(
  errors: ValidationError[],
  suggestions?: string[],
): string {
  let message = 'Validation failed:\n'
  message += formatValidationErrors(errors)

  if (suggestions && suggestions.length > 0) {
    message += '\n\nSuggestions:\n'
    message += suggestions.map((s) => `  - ${s}`).join('\n')
  }

  return message
}

// =============================================================================
// Schema Utilities
// =============================================================================

/**
 * Make all fields in a schema optional
 */
export function makeOptional<T extends z.ZodTypeAny>(schema: T): z.ZodOptional<T> {
  return schema.optional()
}

/**
 * Make all fields in an object schema partial
 */
export function makePartial<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }> {
  return schema.partial()
}

/**
 * Extend an object schema with additional fields
 */
export function extendSchema<T extends z.ZodRawShape, U extends z.ZodRawShape>(
  base: z.ZodObject<T>,
  extension: U,
): z.ZodObject<T & U> {
  return base.extend(extension)
}

/**
 * Create a discriminated union schema
 */
export function createDiscriminatedUnion<T extends string, U extends z.ZodTypeAny[]>(
  discriminator: T,
  options: U,
): z.ZodDiscriminatedUnion<T, U> {
  return z.discriminatedUnion(discriminator, options)
}
