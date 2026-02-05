#!/usr/bin/env tsx

/**
 * Check CLI
 *
 * Consolidated CLI for quality checks and validation tasks.
 * Replaces: analyze.ts, validate.ts, health.ts, metrics.ts
 *
 * Commands:
 *   analyze           Analyze codebase for issues
 *   analyze:console   Analyze console usage
 *   analyze:imports   Analyze import patterns
 *   analyze:deps      Analyze dependencies
 *   validate          Validate codebase
 *   validate:env      Validate environment variables
 *   validate:deps     Validate dependencies
 *   validate:types    Validate TypeScript types
 *   health            Check system health
 *   health:db         Check database health
 *   health:services   Check service health
 *   metrics           Display project metrics
 *   metrics:coverage  Display test coverage
 *   metrics:complexity Display code complexity
 *   audit             Run security audit
 *
 * Usage:
 *   pnpm check <command> [options]
 *   pnpm check analyze --verbose
 *   pnpm check validate:env
 *   pnpm check health --json
 *
 * @dependencies
 * - scripts/cli/_base.ts - Base CLI classes (DispatcherCLI, runCLI)
 * - scripts/lib/args.ts - Argument parsing types (ParsedArgs)
 * - scripts/lib/audit/execution-logger.ts - Execution tracking (via base class)
 * - scripts/lib/cli/dispatch.ts - Command dispatching utilities
 * - scripts/analyze/* - Analysis command implementations
 * - scripts/validate/* - Validation command implementations
 * - scripts/commands/health/* - Health check commands
 * - scripts/commands/metrics/* - Metrics collection commands
 * - scripts/commands/audit/* - Security audit commands
 *
 * @requires
 * - Scripts: Individual command scripts in commandMap (dispatched at runtime)
 */

import { type CommandDefinition, DispatcherCLI, runCLI } from './_base.js'

class CheckCLI extends DispatcherCLI {
  name = 'check'
  description = 'Quality checks and validation'
  protected enableExecutionLogging = true

  protected commandMap = {
    // Analyze commands (from analyze.ts)
    analyze: 'scripts/analyze/analyze-codebase.ts',
    'analyze:console': 'scripts/analyze/console-usage.ts',
    'analyze:imports': 'scripts/analyze/import-patterns.ts',
    'analyze:deps': 'scripts/analyze/dependency-analysis.ts',

    // Validate commands (from validate.ts)
    validate: 'scripts/validate/validate-codebase.ts',
    'validate:env': 'scripts/validate/validate-env.ts',
    'validate:deps': 'scripts/commands/validate/validate-dependencies.ts',
    'validate:types': 'scripts/validate/validate-types.ts',

    // Health commands (from health.ts)
    health: 'scripts/commands/health/check-health.ts',
    'health:db': 'scripts/commands/health/check-db.ts',
    'health:services': 'scripts/commands/health/check-services.ts',

    // Metrics commands (from metrics.ts)
    metrics: 'scripts/commands/metrics/display-metrics.ts',
    'metrics:coverage': 'scripts/commands/metrics/coverage.ts',
    'metrics:complexity': 'scripts/commands/metrics/complexity.ts',

    // Audit command
    audit: 'scripts/commands/audit/security-audit.ts',
  }

  defineGlobalArgs() {
    return [
      ...super.defineGlobalArgs(),
      {
        name: 'path',
        type: 'string' as const,
        description: 'Glob pattern to filter files',
      },
      {
        name: 'fix',
        type: 'boolean' as const,
        description: 'Automatically fix issues where possible',
        default: false,
      },
    ]
  }

  defineCommands(): CommandDefinition[] {
    return [
      // Analyze Commands
      {
        name: 'analyze',
        description: 'Analyze codebase for issues',
        handler: async (args) => this.dispatchCommand('analyze', args),
      },
      {
        name: 'analyze:console',
        description: 'Analyze console usage patterns',
        args: [
          {
            name: 'threshold',
            type: 'number' as const,
            description: 'Maximum allowed console statements',
          },
        ],
        handler: async (args) => this.dispatchCommand('analyze:console', args),
      },
      {
        name: 'analyze:imports',
        description: 'Analyze import patterns',
        args: [
          {
            name: 'circular',
            type: 'boolean' as const,
            description: 'Check for circular dependencies',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('analyze:imports', args),
      },
      {
        name: 'analyze:deps',
        description: 'Analyze dependency usage and issues',
        handler: async (args) => this.dispatchCommand('analyze:deps', args),
      },

      // Validate Commands
      {
        name: 'validate',
        description: 'Run all validation checks',
        handler: async (args) => this.dispatchCommand('validate', args),
      },
      {
        name: 'validate:env',
        description: 'Validate environment variables',
        args: [
          {
            name: 'env-file',
            type: 'string' as const,
            description: 'Path to .env file (default: .env)',
          },
        ],
        handler: async (args) => this.dispatchCommand('validate:env', args),
      },
      {
        name: 'validate:deps',
        description: 'Validate dependency consistency',
        args: [
          {
            name: 'check-updates',
            type: 'boolean' as const,
            description: 'Check for available updates',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('validate:deps', args),
      },
      {
        name: 'validate:types',
        description: 'Validate TypeScript types',
        args: [
          {
            name: 'strict',
            type: 'boolean' as const,
            description: 'Use strict type checking',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('validate:types', args),
      },

      // Health Commands
      {
        name: 'health',
        description: 'Check overall system health',
        handler: async (args) => this.dispatchCommand('health', args),
      },
      {
        name: 'health:db',
        description: 'Check database connectivity and health',
        handler: async (args) => this.dispatchCommand('health:db', args),
      },
      {
        name: 'health:services',
        description: 'Check external service health',
        args: [
          {
            name: 'timeout',
            type: 'number' as const,
            description: 'Timeout in milliseconds',
            default: 5000,
          },
        ],
        handler: async (args) => this.dispatchCommand('health:services', args),
      },

      // Metrics Commands
      {
        name: 'metrics',
        description: 'Display project metrics',
        args: [
          {
            name: 'format',
            type: 'string' as const,
            description: 'Output format (table, json, markdown)',
            default: 'table',
          },
        ],
        handler: async (args) => this.dispatchCommand('metrics', args),
      },
      {
        name: 'metrics:coverage',
        description: 'Display test coverage metrics',
        args: [
          {
            name: 'threshold',
            type: 'number' as const,
            description: 'Minimum coverage threshold',
            default: 80,
          },
        ],
        handler: async (args) => this.dispatchCommand('metrics:coverage', args),
      },
      {
        name: 'metrics:complexity',
        description: 'Display code complexity metrics',
        args: [
          {
            name: 'max-complexity',
            type: 'number' as const,
            description: 'Maximum allowed complexity',
            default: 10,
          },
        ],
        handler: async (args) => this.dispatchCommand('metrics:complexity', args),
      },

      // Audit Command
      {
        name: 'audit',
        description: 'Run security and quality audit',
        args: [
          {
            name: 'level',
            type: 'string' as const,
            description: 'Audit level (low, moderate, high, critical)',
            default: 'moderate',
          },
        ],
        handler: async (args) => this.dispatchCommand('audit', args),
      },
    ]
  }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(CheckCLI).catch(console.error)
}

export { CheckCLI }
