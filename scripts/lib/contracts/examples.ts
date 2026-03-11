/**
 * Contract Usage Examples
 *
 * Demonstrates how to use Zod contracts in CLI scripts for type-safe,
 * runtime-validated input/output handling.
 *
 * @dependencies
 * - scripts/lib/contracts/script-contracts.ts - Contract definitions and validation
 * - scripts/lib/output.ts - ScriptOutput type
 * - zod - Runtime schema validation
 */

import { z } from 'zod';
import type { ScriptOutput } from '../output.js';
import { defineScriptContract, validateInput, validateOutput } from './script-contracts.js';

// =============================================================================
// Example 1: Database Migration Contract
// =============================================================================

/**
 * Database migration script contract
 */
export const DatabaseMigrationContract = defineScriptContract({
  name: 'database-migrate',
  description: 'Run database migrations',
  input: z.object({
    direction: z.enum(['up', 'down']).default('up'),
    steps: z.number().positive().optional(),
    dryRun: z.boolean().default(false),
    force: z.boolean().default(false),
    specific: z.string().optional(),
  }),
  output: z.object({
    success: z.boolean(),
    migrationsRun: z.number(),
    migrations: z.array(
      z.object({
        name: z.string(),
        status: z.enum(['success', 'failed', 'skipped']),
        error: z.string().optional(),
      }),
    ),
  }),
  version: '1.0.0',
  examples: [
    {
      name: 'Run all pending migrations',
      input: { direction: 'up' as const, dryRun: false, force: false },
      expectedOutput: {
        success: true,
        migrationsRun: 3,
        migrations: [],
      },
    },
    {
      name: 'Rollback last migration',
      input: { direction: 'down' as const, steps: 1, dryRun: false, force: false },
    },
  ],
});

// =============================================================================
// Example 2: Code Generation Contract
// =============================================================================

/**
 * Code generator script contract
 */
export const CodeGenContract = defineScriptContract({
  name: 'generate-code',
  description: 'Generate code from templates',
  input: z.object({
    template: z.enum(['component', 'api-route', 'hook', 'service']),
    name: z.string().min(1),
    outputPath: z.string().optional(),
    options: z
      .object({
        typescript: z.boolean().default(true),
        tests: z.boolean().default(true),
        storybook: z.boolean().default(false),
      })
      .optional(),
  }),
  output: z.object({
    success: z.boolean(),
    filesGenerated: z.array(z.string()),
    warnings: z.array(z.string()).optional(),
  }),
});

// =============================================================================
// Example 3: Performance Benchmark Contract
// =============================================================================

/**
 * Performance benchmark script contract
 */
export const BenchmarkContract = defineScriptContract({
  name: 'benchmark',
  description: 'Run performance benchmarks',
  input: z.object({
    targets: z.array(z.string()).min(1),
    iterations: z.number().positive().default(100),
    warmup: z.number().nonnegative().default(10),
    compare: z.string().optional(),
    outputFormat: z.enum(['json', 'table', 'markdown']).default('table'),
  }),
  output: z.object({
    success: z.boolean(),
    results: z.array(
      z.object({
        target: z.string(),
        avgMs: z.number(),
        minMs: z.number(),
        maxMs: z.number(),
        stdDev: z.number(),
        opsPerSec: z.number(),
      }),
    ),
    comparison: z
      .object({
        baseline: z.string(),
        changes: z.array(
          z.object({
            target: z.string(),
            percentChange: z.number(),
            faster: z.boolean(),
          }),
        ),
      })
      .optional(),
  }),
});

// =============================================================================
// Example Usage in a Script
// =============================================================================

/**
 * Example of using a contract in a CLI command handler
 */
export async function exampleMigrationHandler(args: unknown): Promise<ScriptOutput> {
  // Validate input
  const inputValidation = validateInput(DatabaseMigrationContract, args);

  if (!inputValidation.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input parameters',
        details: { errors: inputValidation.errors },
      },
    };
  }

  // biome-ignore lint/style/noNonNullAssertion: Data guaranteed to exist after successful validation
  const input = inputValidation.data!;

  // Use validated input
  console.log(`Running migrations: ${input.direction}`);
  console.log(`Dry run: ${input.dryRun}`);

  // Perform operation (mock example)
  const result = {
    success: true,
    migrationsRun: 3,
    migrations: [
      { name: '001_initial', status: 'success' as const },
      { name: '002_add_users', status: 'success' as const },
      { name: '003_add_posts', status: 'success' as const },
    ],
  };

  // Validate output
  const outputValidation = validateOutput(DatabaseMigrationContract, result);

  if (!outputValidation.success) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Output validation failed',
        details: { errors: outputValidation.errors },
      },
    };
  }

  return {
    success: true,
    data: outputValidation.data,
  };
}

/**
 * Example of using contracts with async validation
 */
export async function exampleWithAsyncValidation(args: unknown): Promise<ScriptOutput> {
  // Parse and validate input
  const result = DatabaseMigrationContract.input.safeParse(args);

  if (!result.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid arguments',
        details: result.error.flatten(),
      },
    };
  }

  const input = result.data;

  // Additional async validation could go here
  // e.g., checking if migration files exist

  return {
    success: true,
    data: { message: `Validated: ${input.direction}` },
  };
}
