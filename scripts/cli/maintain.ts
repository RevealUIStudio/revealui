#!/usr/bin/env tsx

/**
 * Maintenance CLI
 *
 * Unified CLI for codebase maintenance tasks including fixing linting errors,
 * TypeScript issues, import extensions, and running validation checks.
 *
 * Commands:
 *   fix-imports       Fix missing .js extensions in imports
 *   fix-lint          Fix common linting errors
 *   fix-types         Fix TypeScript errors
 *   fix-supabase      Update Supabase type definitions
 *   fix-node16        Fix Node16 module resolution imports
 *   fix-validation    Fix validation issues
 *   fix-test          Fix test errors
 *   audit-scripts     Audit package.json scripts for issues
 *   validate-scripts  Validate package scripts against templates
 *   fix-scripts       Auto-fix package scripts (add missing, align with templates)
 *   clean             Clean generated files and caches
 *
 * Usage:
 *   pnpm maintain <command> [options]
 *   pnpm maintain fix-imports --dry-run
 *   pnpm maintain fix-lint --path "apps/cms/**"
 *   pnpm maintain audit-scripts --json
 */

import type { ParsedArgs } from '../lib/args.js'
import { getExecutionLogger } from '../lib/audit/execution-logger.js'
import { dispatchCommand } from '../lib/cli/dispatch.js'
import { ErrorCode } from '../lib/errors.js'
import { fail, ok } from '../lib/output.js'
import { BaseCLI, type CommandDefinition } from './_base.js'

class MaintainCLI extends BaseCLI {
  name = 'maintain'
  description = 'Codebase maintenance and automated fixes'
  private executionId: string | null = null
  private executionSuccess = true
  private executionError: string | undefined

  /**
   * Lifecycle hook: called before command execution
   */
  async beforeRun(): Promise<void> {
    const logger = await getExecutionLogger()
    this.executionId = await logger.startExecution({
      scriptName: this.name,
      command: this.args.command || 'unknown',
      args: this.args.positional,
    })
  }

  /**
   * Lifecycle hook: called after command execution
   */
  async afterRun(): Promise<void> {
    if (this.executionId) {
      const logger = await getExecutionLogger()
      await logger.endExecution(this.executionId, {
        success: this.executionSuccess,
        error: this.executionError,
      })
    }
  }

  defineGlobalArgs() {
    return [
      {
        name: 'dry-run',
        type: 'boolean' as const,
        description: 'Show what would be changed without making changes',
        default: false,
      },
      {
        name: 'path',
        type: 'string' as const,
        description: 'Glob pattern to filter files',
      },
      {
        name: 'verbose',
        type: 'boolean' as const,
        description: 'Show detailed output',
        alias: 'v',
        default: false,
      },
    ]
  }

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'fix-imports',
        description: 'Fix missing .js extensions in imports',
        handler: async (args) => this.fixImports(args),
      },
      {
        name: 'fix-lint',
        description: 'Fix common linting errors',
        handler: async (args) => this.fixLint(args),
      },
      {
        name: 'fix-types',
        description: 'Fix TypeScript errors',
        handler: async (args) => this.fixTypes(args),
      },
      {
        name: 'fix-supabase',
        description: 'Update Supabase type definitions',
        handler: async (args) => this.fixSupabase(args),
      },
      {
        name: 'fix-node16',
        description: 'Fix Node16 module resolution imports',
        handler: async (args) => this.fixNode16(args),
      },
      {
        name: 'fix-validation',
        description: 'Fix validation issues',
        handler: async (args) => this.fixValidation(args),
      },
      {
        name: 'fix-test',
        description: 'Fix test errors',
        handler: async (args) => this.fixTest(args),
      },
      {
        name: 'audit-scripts',
        description: 'Audit package.json scripts for issues',
        options: [
          {
            name: 'show-duplicates',
            type: 'boolean' as const,
            description: 'Show all duplicate scripts with details',
            default: false,
          },
        ],
        handler: async (args) => this.auditScripts(args),
      },
      {
        name: 'validate-scripts',
        description: 'Validate package scripts against templates',
        options: [
          {
            name: 'package',
            type: 'string' as const,
            description: 'Specific package to validate (e.g., @revealui/ai)',
          },
          {
            name: 'strict',
            type: 'boolean' as const,
            description: 'Fail on warnings, not just errors',
            default: false,
          },
        ],
        handler: async (args) => this.validateScripts(args),
      },
      {
        name: 'fix-scripts',
        description: 'Auto-fix package scripts (add missing, align with templates)',
        options: [
          {
            name: 'package',
            type: 'string' as const,
            description: 'Specific package to fix (e.g., @revealui/ai)',
          },
          {
            name: 'backup',
            type: 'boolean' as const,
            description: 'Create backup before modifying',
            default: false,
          },
        ],
        handler: async (args) => this.fixScripts(args),
      },
      {
        name: 'clean',
        description: 'Clean generated files and caches',
        handler: async (args) => this.clean(args),
      },
    ]
  }

  /**
   * Fix missing .js extensions in imports
   * Delegates to scripts/commands/fix/fix-import-extensions.ts
   */
  private async fixImports(args: ParsedArgs) {
    const result = await dispatchCommand('scripts/commands/fix/fix-import-extensions.ts', {
      args,
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to fix import extensions', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Import extensions fixed' })
  }

  /**
   * Fix common linting errors
   * Delegates to scripts/commands/fix/fix-linting-errors.ts
   */
  private async fixLint(args: ParsedArgs) {
    const result = await dispatchCommand('scripts/commands/fix/fix-linting-errors.ts', {
      args,
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to fix linting errors', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Linting errors fixed' })
  }

  /**
   * Fix TypeScript errors
   * Delegates to scripts/commands/fix/fix-typescript-errors.ts
   */
  private async fixTypes(args: ParsedArgs) {
    const result = await dispatchCommand('scripts/commands/fix/fix-typescript-errors.ts', {
      args,
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to fix TypeScript errors', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'TypeScript errors fixed' })
  }

  /**
   * Update Supabase type definitions
   * Delegates to scripts/commands/fix/fix-supabase-types.ts
   */
  private async fixSupabase(args: ParsedArgs) {
    const result = await dispatchCommand('scripts/commands/fix/fix-supabase-types.ts', {
      args,
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to update Supabase types', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Supabase types updated' })
  }

  /**
   * Fix Node16 module resolution imports
   * Delegates to scripts/gates/ops/fix-node16-imports.ts
   */
  private async fixNode16(args: ParsedArgs) {
    const result = await dispatchCommand('scripts/gates/ops/fix-node16-imports.ts', {
      args,
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to fix Node16 imports', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Node16 imports fixed' })
  }

  /**
   * Fix validation issues
   * Delegates to scripts/validate/fix-validation-issues.ts
   */
  private async fixValidation(args: ParsedArgs) {
    const result = await dispatchCommand('scripts/validate/fix-validation-issues.ts', {
      args,
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to fix validation issues', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Validation issues fixed' })
  }

  /**
   * Fix test errors
   * Delegates to scripts/commands/fix/fix-test-errors.ts
   */
  private async fixTest(args: ParsedArgs) {
    const result = await dispatchCommand('scripts/commands/fix/fix-test-errors.ts', {
      args,
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to fix test errors', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Test errors fixed' })
  }

  /**
   * Audit package.json scripts for issues
   * Delegates to scripts/commands/maintain/audit-scripts.ts
   */
  private async auditScripts(args: ParsedArgs) {
    const result = await dispatchCommand('scripts/commands/maintain/audit-scripts.ts', {
      args,
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Script audit failed (duplication >30%)', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Script audit complete' })
  }

  /**
   * Validate package scripts against templates
   * Delegates to scripts/commands/maintain/validate-scripts.ts
   */
  private async validateScripts(args: ParsedArgs) {
    const result = await dispatchCommand('scripts/commands/maintain/validate-scripts.ts', {
      args,
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Script validation failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Script validation complete' })
  }

  /**
   * Auto-fix package scripts
   * Delegates to scripts/commands/maintain/fix-scripts.ts
   */
  private async fixScripts(args: ParsedArgs) {
    const result = await dispatchCommand('scripts/commands/maintain/fix-scripts.ts', {
      args,
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Script fix failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Script fix complete' })
  }

  /**
   * Clean generated files and caches
   */
  private async clean(args: ParsedArgs) {
    const targets = ['dist', '.turbo', 'node_modules/.cache', '.next', 'coverage', '.vitest']

    if (args.dryRun) {
      return ok({ message: 'Dry run complete', targets })
    }

    // TODO: Implement cleanup using Bash tool or dispatchCommand
    // For now, user should run: pnpm turbo clean
    this.output.progress('Manual cleanup required: pnpm turbo clean')
    this.output.progress(`Target directories: ${targets.join(', ')}`)

    return ok({ message: 'Cleanup instructions provided' })
  }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

const cli = new MaintainCLI()
await cli.run()
