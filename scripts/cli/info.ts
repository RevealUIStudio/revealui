#!/usr/bin/env tsx

/**
 * Info CLI
 *
 * Consolidated CLI for information and discovery commands.
 * Replaces: explore.ts, deps.ts, version.ts, analytics.ts
 *
 * Commands:
 *   explore           Explore codebase structure
 *   explore:files     Explore files by pattern
 *   explore:functions Explore function usage
 *   explore:exports   Explore exports
 *   deps              Show dependency tree
 *   deps:graph        Generate dependency graph
 *   deps:outdated     Check for outdated dependencies
 *   deps:unused       Find unused dependencies
 *   version           Display version information
 *   version:bump      Bump version
 *   version:history   Show version history
 *   analytics         Show analytics data
 *   analytics:usage   Show usage statistics
 *   analytics:perf    Show performance metrics
 *
 * Usage:
 *   pnpm info <command> [options]
 *   pnpm info explore --path "src/**"
 *   pnpm info deps:graph --output graph.svg
 *   pnpm info version --json
 *
 * @dependencies
 * - scripts/cli/_base.ts - Base CLI classes (DispatcherCLI, runCLI)
 * - scripts/lib/args.ts - Argument parsing types (ParsedArgs)
 * - scripts/lib/audit/execution-logger.ts - Execution tracking (via base class)
 * - scripts/lib/cli/dispatch.ts - Command dispatching utilities
 * - scripts/commands/explore/* - Codebase exploration commands
 * - scripts/commands/deps/* - Dependency analysis commands
 * - scripts/commands/version/* - Version management commands
 * - scripts/commands/analytics/* - Analytics collection commands
 *
 * @requires
 * - Scripts: Individual command scripts in commandMap (dispatched at runtime)
 */

import type { ParsedArgs } from '../lib/args.js'
import { DispatcherCLI, type CommandDefinition, runCLI } from './_base.js'

class InfoCLI extends DispatcherCLI {
  name = 'info'
  description = 'Information and discovery'
  protected enableExecutionLogging = true

  protected commandMap = {
    // Explore commands (from explore.ts)
    explore: 'scripts/commands/explore/explore-codebase.ts',
    'explore:files': 'scripts/commands/explore/explore-files.ts',
    'explore:functions': 'scripts/commands/explore/explore-functions.ts',
    'explore:exports': 'scripts/commands/explore/explore-exports.ts',

    // Dependency commands (from deps.ts)
    deps: 'scripts/commands/deps/show-deps.ts',
    'deps:graph': 'scripts/commands/info/deps-graph.ts',
    'deps:outdated': 'scripts/commands/deps/check-outdated.ts',
    'deps:unused': 'scripts/commands/deps/find-unused.ts',

    // Version commands (from version.ts)
    version: 'scripts/commands/version/show-version.ts',
    'version:bump': 'scripts/commands/version/bump-version.ts',
    'version:history': 'scripts/commands/version/version-history.ts',

    // Analytics commands (from analytics.ts)
    analytics: 'scripts/commands/analytics/show-analytics.ts',
    'analytics:usage': 'scripts/commands/analytics/usage-stats.ts',
    'analytics:perf': 'scripts/commands/analytics/performance-metrics.ts',
  }

  defineGlobalArgs() {
    return [
      ...super.defineGlobalArgs(),
      {
        name: 'path',
        type: 'string' as const,
        description: 'Path or pattern to filter',
      },
      {
        name: 'limit',
        type: 'number' as const,
        description: 'Limit number of results',
      },
    ]
  }

  defineCommands(): CommandDefinition[] {
    return [
      // Explore Commands
      {
        name: 'explore',
        description: 'Explore codebase structure and content',
        args: [
          {
            name: 'query',
            type: 'string' as const,
            description: 'Search query',
          },
          {
            name: 'type',
            type: 'string' as const,
            description: 'Type to explore (files, functions, classes, exports)',
          },
        ],
        handler: async (args) => this.dispatchCommand('explore', args),
      },
      {
        name: 'explore:files',
        description: 'Explore files by pattern',
        args: [
          {
            name: 'pattern',
            type: 'string' as const,
            required: true,
            description: 'File pattern (glob)',
          },
          {
            name: 'include-content',
            type: 'boolean' as const,
            description: 'Include file content preview',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('explore:files', args),
      },
      {
        name: 'explore:functions',
        description: 'Explore function definitions and usage',
        args: [
          {
            name: 'name',
            type: 'string' as const,
            description: 'Function name to search',
          },
          {
            name: 'show-callers',
            type: 'boolean' as const,
            description: 'Show caller locations',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('explore:functions', args),
      },
      {
        name: 'explore:exports',
        description: 'Explore exported symbols',
        args: [
          {
            name: 'package',
            type: 'string' as const,
            description: 'Package to explore',
          },
          {
            name: 'public-only',
            type: 'boolean' as const,
            description: 'Show only public exports',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('explore:exports', args),
      },

      // Dependency Commands
      {
        name: 'deps',
        description: 'Show dependency tree',
        args: [
          {
            name: 'package',
            type: 'string' as const,
            description: 'Package to analyze',
          },
          {
            name: 'depth',
            type: 'number' as const,
            description: 'Maximum depth to display',
            default: 3,
          },
        ],
        handler: async (args) => this.dispatchCommand('deps', args),
      },
      {
        name: 'deps:graph',
        description: 'Generate dependency graph visualization',
        args: [
          {
            name: 'output',
            type: 'string' as const,
            description: 'Output file path',
          },
          {
            name: 'format',
            type: 'string' as const,
            description: 'Output format (svg, png, dot, mermaid)',
            default: 'svg',
          },
        ],
        handler: async (args) => this.dispatchCommand('deps:graph', args),
      },
      {
        name: 'deps:outdated',
        description: 'Check for outdated dependencies',
        args: [
          {
            name: 'update',
            type: 'boolean' as const,
            description: 'Update outdated dependencies',
            default: false,
          },
          {
            name: 'major',
            type: 'boolean' as const,
            description: 'Include major version updates',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('deps:outdated', args),
      },
      {
        name: 'deps:unused',
        description: 'Find unused dependencies',
        args: [
          {
            name: 'remove',
            type: 'boolean' as const,
            description: 'Remove unused dependencies',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('deps:unused', args),
      },

      // Version Commands
      {
        name: 'version',
        description: 'Display version information',
        args: [
          {
            name: 'package',
            type: 'string' as const,
            description: 'Package name',
          },
        ],
        handler: async (args) => this.dispatchCommand('version', args),
      },
      {
        name: 'version:bump',
        description: 'Bump package version',
        args: [
          {
            name: 'type',
            type: 'string' as const,
            required: true,
            description: 'Bump type (major, minor, patch)',
          },
          {
            name: 'package',
            type: 'string' as const,
            description: 'Package name',
          },
          {
            name: 'commit',
            type: 'boolean' as const,
            description: 'Create commit for version bump',
            default: false,
          },
        ],
        confirmPrompt: 'This will update version numbers. Continue?',
        handler: async (args) => this.dispatchCommand('version:bump', args),
      },
      {
        name: 'version:history',
        description: 'Show version history',
        args: [
          {
            name: 'package',
            type: 'string' as const,
            description: 'Package name',
          },
          {
            name: 'limit',
            type: 'number' as const,
            description: 'Number of versions to show',
            default: 10,
          },
        ],
        handler: async (args) => this.dispatchCommand('version:history', args),
      },

      // Analytics Commands
      {
        name: 'analytics',
        description: 'Show analytics dashboard',
        args: [
          {
            name: 'period',
            type: 'string' as const,
            description: 'Time period (day, week, month)',
            default: 'week',
          },
        ],
        handler: async (args) => this.dispatchCommand('analytics', args),
      },
      {
        name: 'analytics:usage',
        description: 'Show usage statistics',
        args: [
          {
            name: 'by',
            type: 'string' as const,
            description: 'Group by (script, user, time)',
            default: 'script',
          },
          {
            name: 'top',
            type: 'number' as const,
            description: 'Show top N entries',
            default: 10,
          },
        ],
        handler: async (args) => this.dispatchCommand('analytics:usage', args),
      },
      {
        name: 'analytics:perf',
        description: 'Show performance metrics',
        args: [
          {
            name: 'metric',
            type: 'string' as const,
            description: 'Metric to display (duration, memory, cpu)',
          },
          {
            name: 'threshold',
            type: 'number' as const,
            description: 'Threshold for highlighting issues',
          },
        ],
        handler: async (args) => this.dispatchCommand('analytics:perf', args),
      },
    ]
  }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(InfoCLI).catch(console.error)
}

export { InfoCLI }
