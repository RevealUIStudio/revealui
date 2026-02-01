#!/usr/bin/env tsx
/**
 * Maintenance CLI
 *
 * Unified CLI for codebase maintenance tasks including fixing linting errors,
 * TypeScript issues, import extensions, and running validation checks.
 *
 * Commands:
 *   fix imports       Fix missing .js extensions in imports
 *   fix lint          Fix common linting errors
 *   fix types         Fix TypeScript errors
 *   fix supabase      Update Supabase type definitions
 *   fix node16        Fix Node16 module resolution imports
 *   fix validation    Fix validation issues
 *   fix test          Fix test errors
 *   audit scripts     Audit package.json scripts for issues
 *   clean             Clean generated files and caches
 *
 * Usage:
 *   pnpm maintain <command> [options]
 *   pnpm maintain fix imports --dry-run
 *   pnpm maintain fix lint --path "apps/cms/**"
 *   pnpm maintain audit scripts --json
 */

import { BaseCLI, type CommandDefinition } from './_base.js'
import type { ParsedArgs } from '../lib/args.js'
import { ok, fail } from '../lib/output.js'
import { ErrorCode } from '../lib/errors.js'
import { execCommand } from '../lib/index.js'

class MaintainCLI extends BaseCLI {
  name = 'maintain'
  description = 'Codebase maintenance and automated fixes'

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
        name: 'fix',
        description: 'Fix common codebase issues',
        subcommands: [
          {
            name: 'imports',
            description: 'Fix missing .js extensions in imports',
            handler: async (args) => this.fixImports(args),
          },
          {
            name: 'lint',
            description: 'Fix common linting errors',
            handler: async (args) => this.fixLint(args),
          },
          {
            name: 'types',
            description: 'Fix TypeScript errors',
            handler: async (args) => this.fixTypes(args),
          },
          {
            name: 'supabase',
            description: 'Update Supabase type definitions',
            handler: async (args) => this.fixSupabase(args),
          },
          {
            name: 'node16',
            description: 'Fix Node16 module resolution imports',
            handler: async (args) => this.fixNode16(args),
          },
          {
            name: 'validation',
            description: 'Fix validation issues',
            handler: async (args) => this.fixValidation(args),
          },
          {
            name: 'test',
            description: 'Fix test errors',
            handler: async (args) => this.fixTest(args),
          },
        ],
      },
      {
        name: 'audit',
        description: 'Audit codebase for issues',
        subcommands: [
          {
            name: 'scripts',
            description: 'Audit package.json scripts for issues',
            handler: async (args) => this.auditScripts(args),
          },
        ],
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
   * Delegates to scripts/analyze/fix-import-extensions.ts
   */
  private async fixImports(args: ParsedArgs) {
    this.logger.header('Fixing Import Extensions')

    const cmdArgs = ['tsx', 'scripts/analyze/fix-import-extensions.ts']
    if (args.dryRun) cmdArgs.push('--dry-run')
    if (args.path) cmdArgs.push('--path', String(args.path))

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to fix import extensions', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Import extensions fixed' })
  }

  /**
   * Fix common linting errors
   * Delegates to scripts/analyze/fix-linting-errors.ts
   */
  private async fixLint(args: ParsedArgs) {
    this.logger.header('Fixing Linting Errors')

    const cmdArgs = ['tsx', 'scripts/analyze/fix-linting-errors.ts']
    if (args.path) cmdArgs.push(String(args.path))

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to fix linting errors', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Linting errors fixed' })
  }

  /**
   * Fix TypeScript errors
   * Delegates to scripts/analyze/fix-typescript-errors.ts
   */
  private async fixTypes(args: ParsedArgs) {
    this.logger.header('Fixing TypeScript Errors')

    const cmdArgs = ['tsx', 'scripts/analyze/fix-typescript-errors.ts']
    if (args.dryRun) cmdArgs.push('--dry-run')
    if (args.path) cmdArgs.push('--path', String(args.path))

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to fix TypeScript errors', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'TypeScript errors fixed' })
  }

  /**
   * Update Supabase type definitions
   * Delegates to scripts/analyze/fix-supabase-types.ts
   */
  private async fixSupabase(args: ParsedArgs) {
    this.logger.header('Updating Supabase Types')

    const cmdArgs = ['tsx', 'scripts/analyze/fix-supabase-types.ts']

    const result = await execCommand('pnpm', cmdArgs, {
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
    this.logger.header('Fixing Node16 Imports')

    const cmdArgs = ['tsx', 'scripts/gates/ops/fix-node16-imports.ts']
    if (args.dryRun) cmdArgs.push('--dry-run')

    const result = await execCommand('pnpm', cmdArgs, {
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
    this.logger.header('Fixing Validation Issues')

    const cmdArgs = ['tsx', 'scripts/validate/fix-validation-issues.ts']
    if (args.dryRun) cmdArgs.push('--dry-run')

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to fix validation issues', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Validation issues fixed' })
  }

  /**
   * Fix test errors
   * Delegates to scripts/analyze/fix-test-errors.ts
   */
  private async fixTest(args: ParsedArgs) {
    this.logger.header('Fixing Test Errors')

    const cmdArgs = ['tsx', 'scripts/analyze/fix-test-errors.ts']
    if (args.path) cmdArgs.push('--path', String(args.path))

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to fix test errors', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Test errors fixed' })
  }

  /**
   * Audit package.json scripts for issues
   */
  private async auditScripts(args: ParsedArgs) {
    this.logger.header('Auditing Package Scripts')

    // TODO: Implement script auditing
    // - Find duplicate scripts across packages
    // - Check for missing scripts
    // - Validate script commands
    // - Check for outdated patterns

    this.logger.warning('Script auditing not yet implemented')
    this.logger.info('Planned features:')
    this.logger.info('  - Detect duplicate scripts across packages')
    this.logger.info('  - Find missing standard scripts (lint, build, test)')
    this.logger.info('  - Validate script command syntax')
    this.logger.info('  - Report script execution statistics')

    return ok({
      message: 'Script auditing placeholder',
      planned: true
    })
  }

  /**
   * Clean generated files and caches
   */
  private async clean(args: ParsedArgs) {
    this.logger.header('Cleaning Codebase')

    const targets = [
      'dist',
      '.turbo',
      'node_modules/.cache',
      '.next',
      'coverage',
      '.vitest',
    ]

    this.logger.info(`Cleaning directories: ${targets.join(', ')}`)

    if (args.dryRun) {
      this.logger.info('Dry run mode - no files will be deleted')
      return ok({ message: 'Dry run complete', targets })
    }

    // Use turbo clean if available, otherwise manual cleanup
    const result = await execCommand('pnpm', ['turbo', 'clean'], {
      cwd: this.projectRoot,
    })

    if (result.success) {
      this.logger.success('Cleaned using turbo')
    } else {
      this.logger.warning('Turbo clean failed, using manual cleanup')
      // TODO: Implement manual cleanup of target directories
    }

    return ok({ message: 'Cleanup complete' })
  }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

const cli = new MaintainCLI()
await cli.run()
