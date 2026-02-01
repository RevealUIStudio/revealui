#!/usr/bin/env tsx
/**
 * Validation CLI
 *
 * Unified entry point for validation operations with dual-mode output support.
 *
 * Usage:
 *   pnpm validate:env         # Validate environment variables
 *   pnpm validate:console     # Check for console statements
 *   pnpm validate:packages    # Validate package scripts
 *   pnpm validate:pre-launch  # Run pre-launch validation
 *
 * Add --json flag to any command for machine-readable output.
 */

import {
  validateEnv,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS,
  type EnvValidationResult,
} from '../lib/index.js'
import { BaseCLI, runCLI, type CommandDefinition } from './_base.js'
import { type ScriptOutput, ok, fail } from '../lib/output.js'
import { executionError, validationError } from '../lib/errors.js'
import type { ParsedArgs } from '../lib/args.js'

// =============================================================================
// Types for JSON output
// =============================================================================

interface EnvValidationData {
  valid: boolean
  missing: string[]
  invalid: string[]
  warnings: string[]
  total: {
    required: number
    optional: number
    checked: number
  }
}

// =============================================================================
// Script paths for dispatched commands
// =============================================================================

const COMMAND_SCRIPTS: Record<string, string> = {
  console: '../validate/console-statements.ts',
  packages: '../validate/validate-package-scripts.ts',
  'pre-launch': '../validate/pre-launch.ts',
}

// =============================================================================
// Validate CLI
// =============================================================================

class ValidateCLI extends BaseCLI {
  name = 'validate'
  description = 'Run validation checks on the codebase'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'env',
        description: 'Validate environment variables',
        args: [{ name: 'strict', type: 'boolean', description: 'Treat warnings as errors' }],
        handler: (args) => this.validateEnv(args),
      },
      {
        name: 'console',
        description: 'Check for console statements in production code',
        args: [],
        handler: (args) => this.dispatch('console', args),
      },
      {
        name: 'packages',
        description: 'Validate package.json scripts across workspace',
        args: [],
        handler: (args) => this.dispatch('packages', args),
      },
      {
        name: 'pre-launch',
        description: 'Run comprehensive pre-launch validation',
        args: [],
        handler: (args) => this.dispatch('pre-launch', args),
      },
    ]
  }

  // ===========================================================================
  // Commands
  // ===========================================================================

  private async validateEnv(args: ParsedArgs): Promise<ScriptOutput<EnvValidationData>> {
    const strict = this.getFlag('strict', false)

    this.output.progress('Validating environment variables...')

    const result = validateEnv()

    const data: EnvValidationData = {
      valid: result.valid,
      missing: result.missing,
      invalid: result.invalid,
      warnings: result.warnings,
      total: {
        required: REQUIRED_ENV_VARS.length,
        optional: OPTIONAL_ENV_VARS.length,
        checked: REQUIRED_ENV_VARS.length + OPTIONAL_ENV_VARS.length,
      },
    }

    // Human-mode output
    if (!this.output.isJsonMode()) {
      this.output.header('Environment Validation')

      if (result.missing.length > 0) {
        this.output.warn(`Missing required variables: ${result.missing.join(', ')}`)
      }

      if (result.invalid.length > 0) {
        this.output.warn(`Invalid variables: ${result.invalid.join(', ')}`)
      }

      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          this.output.warn(warning)
        }
      }

      if (result.valid) {
        this.output.progress('All required environment variables are set')
      }
    }

    // Determine success based on strict mode
    const isValid = strict ? result.valid && result.warnings.length === 0 : result.valid

    if (!isValid) {
      throw validationError('Environment validation failed', undefined, {
        missing: result.missing,
        invalid: result.invalid,
      })
    }

    return ok(data)
  }

  /**
   * Dispatch to external script for commands not yet refactored
   */
  private async dispatch(
    command: string,
    args: ParsedArgs,
  ): Promise<ScriptOutput<{ dispatched: string }>> {
    const scriptPath = COMMAND_SCRIPTS[command]

    if (!scriptPath) {
      throw executionError(`Unknown command: ${command}`)
    }

    if (this.output.isJsonMode()) {
      this.output.progress(`Dispatching to ${command} script...`)
    }

    try {
      const forwardArgs = args.positional
      process.argv = [process.argv[0], process.argv[1], ...forwardArgs]

      await import(scriptPath)

      return ok({ dispatched: command })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
        throw executionError(`Command script not found: ${scriptPath}`, undefined, undefined, {
          hint: 'This command may not be implemented yet.',
        })
      }
      throw error
    }
  }
}

// =============================================================================
// Entry Point
// =============================================================================

runCLI(ValidateCLI)
