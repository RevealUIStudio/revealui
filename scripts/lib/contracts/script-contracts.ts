/**
 * Script Contracts with Zod
 *
 * Runtime-validated input/output schemas for scripts using Zod.
 * Provides type-safe, validated contracts for script interfaces.
 *
 * @dependencies
 * - zod - Runtime schema validation with type inference
 *
 * @example
 * ```typescript
 * import { z } from 'zod'
 * import { defineScriptContract, validateInput, validateOutput } from './script-contracts.js'
 *
 * // Define a contract
 * const BackupContract = defineScriptContract({
 *   name: 'backup-database',
 *   description: 'Create database backup',
 *   input: z.object({
 *     tables: z.array(z.string()).optional(),
 *     format: z.enum(['json', 'sql']).default('json'),
 *     compress: z.boolean().default(true),
 *   }),
 *   output: z.object({
 *     success: z.boolean(),
 *     path: z.string().optional(),
 *     size: z.number().optional(),
 *   }),
 * })
 *
 * // Use in a script
 * const input = validateInput(BackupContract, args)
 * const result = await doBackup(input)
 * return validateOutput(BackupContract, result)
 * ```
 */

import { type ZodType, z } from 'zod'

// =============================================================================
// Core Types
// =============================================================================

/**
 * Script contract definition with input/output schemas
 */
export interface ScriptContract<
  TInput extends ZodType = ZodType,
  TOutput extends ZodType = ZodType,
> {
  /** Contract name (usually matches script name) */
  name: string

  /** Contract description */
  description: string

  /** Input schema (arguments/parameters) */
  input: TInput

  /** Output schema (return value) */
  output: TOutput

  /** Contract version (for evolution tracking) */
  version?: string

  /** Tags for categorization */
  tags?: string[]

  /** Examples of valid inputs */
  examples?: Array<{
    name: string
    input: z.infer<TInput>
    expectedOutput?: z.infer<TOutput>
  }>
}

/**
 * Contract validation result
 */
export interface ValidationResult<T = unknown> {
  /** Whether validation succeeded */
  success: boolean

  /** Validated data (if successful) */
  data?: T

  /** Validation errors (if failed) */
  errors?: ValidationError[]
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Error path (e.g., 'input.tables[0]') */
  path: string[]

  /** Error message */
  message: string

  /** Error code */
  code: string
}

// =============================================================================
// Contract Definition
// =============================================================================

/**
 * Define a script contract with type inference
 */
export function defineScriptContract<TInput extends ZodType, TOutput extends ZodType>(
  contract: ScriptContract<TInput, TOutput>,
): ScriptContract<TInput, TOutput> {
  return contract
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate input against contract schema
 */
export function validateInput<TInput extends ZodType>(
  // biome-ignore lint/suspicious/noExplicitAny: Output type not used in input validation
  contract: ScriptContract<TInput, any>,
  input: unknown,
): ValidationResult<z.infer<TInput>> {
  try {
    const data = contract.input.parse(input)
    return {
      success: true,
      data,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map((err) => ({
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
 * Validate output against contract schema
 */
export function validateOutput<TOutput extends ZodType>(
  // biome-ignore lint/suspicious/noExplicitAny: Input type not used in output validation
  contract: ScriptContract<any, TOutput>,
  output: unknown,
): ValidationResult<z.infer<TOutput>> {
  try {
    const data = contract.output.parse(output)
    return {
      success: true,
      data,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map((err) => ({
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
 * Safe parse that returns ValidationResult instead of throwing
 */
export function safeValidateInput<TInput extends ZodType>(
  // biome-ignore lint/suspicious/noExplicitAny: Output type not used in input validation
  contract: ScriptContract<TInput, any>,
  input: unknown,
): ValidationResult<z.infer<TInput>> {
  return validateInput(contract, input)
}

/**
 * Safe parse that returns ValidationResult instead of throwing
 */
export function safeValidateOutput<TOutput extends ZodType>(
  // biome-ignore lint/suspicious/noExplicitAny: Input type not used in output validation
  contract: ScriptContract<any, TOutput>,
  output: unknown,
): ValidationResult<z.infer<TOutput>> {
  return validateOutput(contract, output)
}

// =============================================================================
// Common Schemas
// =============================================================================

/**
 * Standard script output schema
 */
export const ScriptOutputSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.unknown()).optional(),
    })
    .optional(),
  metadata: z
    .object({
      duration: z.number().optional(),
      timestamp: z.string().optional(),
      count: z.number().optional(),
    })
    .passthrough()
    .optional(),
})

/**
 * Database operation input schema
 */
export const DatabaseOperationInputSchema = z.object({
  database: z.string().optional(),
  tables: z.array(z.string()).optional(),
  dryRun: z.boolean().default(false),
  force: z.boolean().default(false),
})

/**
 * File operation input schema
 */
export const FileOperationInputSchema = z.object({
  path: z.string(),
  pattern: z.string().optional(),
  recursive: z.boolean().default(false),
  dryRun: z.boolean().default(false),
})

/**
 * Backup operation output schema
 */
export const BackupOutputSchema = z.object({
  success: z.boolean(),
  path: z.string().optional(),
  size: z.number().optional(),
  duration: z.number().optional(),
  error: z.string().optional(),
})

// =============================================================================
// Example Contracts
// =============================================================================

/**
 * Database backup contract example
 */
export const DatabaseBackupContract = defineScriptContract({
  name: 'database-backup',
  description: 'Create a database backup',
  input: z.object({
    tables: z.array(z.string()).optional(),
    format: z.enum(['json', 'sql', 'dump']).default('json'),
    compress: z.boolean().default(true),
    outputPath: z.string().optional(),
  }),
  output: BackupOutputSchema,
  version: '1.0.0',
  tags: ['database', 'backup'],
})

/**
 * Database restore contract example
 */
export const DatabaseRestoreContract = defineScriptContract({
  name: 'database-restore',
  description: 'Restore database from backup',
  input: z.object({
    backupPath: z.string(),
    tables: z.array(z.string()).optional(),
    dryRun: z.boolean().default(false),
    force: z.boolean().default(false),
  }),
  output: z.object({
    success: z.boolean(),
    tablesRestored: z.number().optional(),
    duration: z.number().optional(),
    error: z.string().optional(),
  }),
  version: '1.0.0',
  tags: ['database', 'restore'],
})

/**
 * File cleanup contract example
 */
export const FileCleanupContract = defineScriptContract({
  name: 'file-cleanup',
  description: 'Clean up temporary or generated files',
  input: z.object({
    pattern: z.string(),
    directory: z.string().default('.'),
    recursive: z.boolean().default(false),
    dryRun: z.boolean().default(true),
    maxAge: z.number().optional(),
  }),
  output: z.object({
    success: z.boolean(),
    filesDeleted: z.number(),
    spaceSaved: z.number().optional(),
    files: z.array(z.string()).optional(),
  }),
  version: '1.0.0',
  tags: ['files', 'cleanup'],
})

/**
 * Validation check contract example
 */
export const ValidationCheckContract = defineScriptContract({
  name: 'validation-check',
  description: 'Run validation checks on codebase',
  input: z.object({
    checks: z.array(z.enum(['types', 'lint', 'tests', 'env'])).optional(),
    fix: z.boolean().default(false),
    exitOnError: z.boolean().default(true),
  }),
  output: z.object({
    success: z.boolean(),
    results: z.array(
      z.object({
        check: z.string(),
        passed: z.boolean(),
        errors: z.array(z.string()).optional(),
        warnings: z.array(z.string()).optional(),
      }),
    ),
    summary: z.object({
      total: z.number(),
      passed: z.number(),
      failed: z.number(),
    }),
  }),
  version: '1.0.0',
  tags: ['validation', 'quality'],
})

// =============================================================================
// Contract Registry
// =============================================================================

/**
 * Registry of available contracts for runtime lookup
 */
const contractRegistry = new Map<string, ScriptContract>()

/**
 * Register a contract in the registry
 */
export function registerContract(contract: ScriptContract): void {
  contractRegistry.set(contract.name, contract)
}

/**
 * Get a contract from the registry
 */
export function getContract(name: string): ScriptContract | undefined {
  return contractRegistry.get(name)
}

/**
 * List all registered contracts
 */
export function listContracts(): ScriptContract[] {
  return Array.from(contractRegistry.values())
}

// Register example contracts
registerContract(DatabaseBackupContract)
registerContract(DatabaseRestoreContract)
registerContract(FileCleanupContract)
registerContract(ValidationCheckContract)
