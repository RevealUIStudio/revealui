#!/usr/bin/env tsx
/**
 * Analysis CLI
 *
 * Unified CLI for codebase analysis tasks including code quality metrics,
 * type analysis, console usage detection, and documentation audits.
 *
 * Commands:
 *   quality           Analyze code quality metrics
 *   types             Analyze TypeScript type usage
 *   console           Find console.log statements
 *   docs              Analyze documentation completeness
 *   performance       Measure build and runtime performance
 *   components        Inventory React components
 *   audit-any         Find usage of 'any' type
 *   audit-docs        Audit documentation for issues
 *
 * Usage:
 *   pnpm analyze <command> [options]
 *   pnpm analyze quality --json
 *   pnpm analyze console --path "apps/cms/**"
 *   pnpm analyze types --verbose
 */

import { BaseCLI, type CommandDefinition } from './_base.js'
import type { ParsedArgs } from '../lib/args.js'
import { ok, fail } from '../lib/output.js'
import { ErrorCode } from '../lib/errors.js'
import { execCommand } from '../lib/index.js'

class AnalyzeCLI extends BaseCLI {
  name = 'analyze'
  description = 'Codebase analysis and metrics'

  defineGlobalArgs() {
    return [
      {
        name: 'path',
        type: 'string' as const,
        description: 'Glob pattern to filter files',
      },
      {
        name: 'output',
        short: 'o',
        type: 'string' as const,
        description: 'Output file path for results',
      },
      {
        name: 'threshold',
        type: 'number' as const,
        description: 'Threshold for warnings/errors',
      },
    ]
  }

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'quality',
        description: 'Analyze code quality metrics (complexity, duplication, etc.)',
        handler: async (args) => this.runQuality(args),
      },
      {
        name: 'types',
        description: 'Analyze TypeScript type usage and coverage',
        handler: async (args) => this.runTypes(args),
      },
      {
        name: 'console',
        description: 'Find console.log and other console statements',
        handler: async (args) => this.runConsole(args),
      },
      {
        name: 'docs',
        description: 'Analyze documentation completeness',
        handler: async (args) => this.runDocs(args),
      },
      {
        name: 'performance',
        description: 'Measure build and runtime performance',
        handler: async (args) => this.runPerformance(args),
      },
      {
        name: 'components',
        description: 'Inventory React components and their usage',
        handler: async (args) => this.runComponents(args),
      },
      {
        name: 'audit-any',
        description: "Find usage of 'any' type in TypeScript",
        handler: async (args) => this.runAuditAny(args),
      },
      {
        name: 'audit-docs',
        description: 'Audit documentation for broken links and issues',
        handler: async (args) => this.runAuditDocs(args),
      },
      {
        name: 'dependencies',
        description: 'Analyze package dependencies',
        options: [
          {
            name: 'no-unused',
            type: 'boolean',
            description: 'Skip unused dependency check',
          },
          {
            name: 'no-outdated',
            type: 'boolean',
            description: 'Skip outdated dependency check',
          },
          {
            name: 'no-circular',
            type: 'boolean',
            description: 'Skip circular dependency check',
          },
          {
            name: 'no-duplicates',
            type: 'boolean',
            description: 'Skip duplicate dependency check',
          },
          {
            name: 'no-security',
            type: 'boolean',
            description: 'Skip security vulnerability check',
          },
        ],
        handler: async (args) => this.runDependencies(args),
      },
    ]
  }

  /**
   * Analyze code quality
   * Delegates to scripts/analyze/code-quality.ts
   */
  private async runQuality(args: ParsedArgs) {
    const cmdArgs = ['tsx', 'scripts/analyze/code-quality.ts']
    if (args.path) cmdArgs.push('--path', String(args.path))

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Code quality analysis failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Code quality analysis complete' })
  }

  /**
   * Analyze TypeScript types
   * Delegates to scripts/analyze/types.ts
   */
  private async runTypes(args: ParsedArgs) {
    const cmdArgs = ['tsx', 'scripts/analyze/types.ts']
    if (args.path) cmdArgs.push('--path', String(args.path))

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Type analysis failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Type analysis complete' })
  }

  /**
   * Find console statements
   * Delegates to scripts/analyze/console-usage.ts
   */
  private async runConsole(args: ParsedArgs) {
    const cmdArgs = ['tsx', 'scripts/analyze/console-usage.ts']
    if (args.path) cmdArgs.push('--path', String(args.path))

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Console usage analysis failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Console usage analysis complete' })
  }

  /**
   * Analyze documentation
   * Delegates to scripts/analyze/docs.ts
   */
  private async runDocs(args: ParsedArgs) {
    const cmdArgs = ['tsx', 'scripts/analyze/docs.ts']
    if (args.output) cmdArgs.push('--output', String(args.output))

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Documentation analysis failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Documentation analysis complete' })
  }

  /**
   * Measure performance
   * Delegates to scripts/analyze/measure-performance.ts
   */
  private async runPerformance(args: ParsedArgs) {
    const cmdArgs = ['tsx', 'scripts/analyze/measure-performance.ts']

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Performance measurement failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Performance measurement complete' })
  }

  /**
   * Inventory components
   * Delegates to scripts/analyze/component-inventory.ts
   */
  private async runComponents(args: ParsedArgs) {
    const cmdArgs = ['tsx', 'scripts/analyze/component-inventory.ts']
    if (args.path) cmdArgs.push('--path', String(args.path))

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Component inventory failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Component inventory complete' })
  }

  /**
   * Audit for 'any' type usage
   * Delegates to scripts/analyze/audit-any-types.ts
   */
  private async runAuditAny(args: ParsedArgs) {
    const cmdArgs = ['tsx', 'scripts/analyze/audit-any-types.ts']
    if (args.threshold) cmdArgs.push('--threshold', String(args.threshold))

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Any type audit failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Any type audit complete' })
  }

  /**
   * Audit documentation
   * Delegates to scripts/analyze/audit-docs.ts
   */
  private async runAuditDocs(args: ParsedArgs) {
    const cmdArgs = ['tsx', 'scripts/analyze/audit-docs.ts']

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Documentation audit failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Documentation audit complete' })
  }

  /**
   * Analyze dependencies
   * Delegates to scripts/commands/analyze/dependencies.ts
   */
  private async runDependencies(args: ParsedArgs) {
    const cmdArgs = ['tsx', 'scripts/commands/analyze/dependencies.ts']
    if (args['no-unused']) cmdArgs.push('--no-unused')
    if (args['no-outdated']) cmdArgs.push('--no-outdated')
    if (args['no-circular']) cmdArgs.push('--no-circular')
    if (args['no-duplicates']) cmdArgs.push('--no-duplicates')
    if (args['no-security']) cmdArgs.push('--no-security')
    if (args.json) cmdArgs.push('--json')

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Dependency analysis failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Dependency analysis complete' })
  }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

const cli = new AnalyzeCLI()
await cli.run()
