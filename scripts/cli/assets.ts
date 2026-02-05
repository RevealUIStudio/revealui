#!/usr/bin/env tsx

/**
 * Assets CLI
 *
 * Consolidated CLI for asset generation and management.
 * Replaces: types.ts, schema-new.ts, build-cache.ts, docs (partial)
 *
 * Commands:
 *   types:generate    Generate TypeScript types
 *   types:copy        Copy generated types
 *   types:validate    Validate generated types
 *   schema:create     Create new schema
 *   schema:migrate    Migrate schema
 *   schema:validate   Validate schema
 *   docs:generate     Generate documentation
 *   docs:api          Generate API documentation
 *   docs:readme       Generate README files
 *   build:cache       Build and cache assets
 *   build:clean       Clean build cache
 *
 * Usage:
 *   pnpm assets <command> [options]
 *   pnpm assets types:generate --verbose
 *   pnpm assets schema:create users
 *   pnpm assets docs:generate --format markdown
 *
 * @dependencies
 * - scripts/cli/_base.ts - Base CLI classes (DispatcherCLI, runCLI)
 * - scripts/lib/args.ts - Argument parsing types (ParsedArgs)
 * - scripts/lib/audit/execution-logger.ts - Execution tracking (via base class)
 * - scripts/lib/cli/dispatch.ts - Command dispatching utilities
 * - scripts/generate/* - Type and content generation scripts
 * - scripts/schema/* - Schema management commands
 * - scripts/validate/* - Type validation commands
 * - scripts/build/* - Build and cache commands
 *
 * @requires
 * - Scripts: Individual command scripts in commandMap (dispatched at runtime)
 */

import { type CommandDefinition, DispatcherCLI, runCLI } from './_base.js'

class AssetsCLI extends DispatcherCLI {
  name = 'assets'
  description = 'Asset generation and management'
  protected enableExecutionLogging = true

  protected commandMap = {
    // Types commands (from types.ts)
    'types:generate': 'scripts/generate/generate-types.ts',
    'types:copy': 'scripts/generate/copy-generated-types.ts',
    'types:validate': 'scripts/validate/validate-types.ts',

    // Schema commands (from schema-new.ts)
    'schema:create': 'scripts/schema/create-schema.ts',
    'schema:migrate': 'scripts/schema/migrate-schema.ts',
    'schema:validate': 'scripts/schema/validate-schema.ts',

    // Docs commands
    'docs:generate': 'scripts/generate/generate-content.ts',
    'docs:api': 'scripts/generate/generate-api-docs.ts',
    'docs:readme': 'scripts/generate/generate-readme.ts',

    // Build cache commands (from build-cache.ts)
    'build:cache': 'scripts/build/build-cache.ts',
    'build:clean': 'scripts/build/clean-cache.ts',
  }

  defineGlobalArgs() {
    return [
      ...super.defineGlobalArgs(),
      {
        name: 'output',
        type: 'string' as const,
        description: 'Output directory or file',
      },
      {
        name: 'format',
        type: 'string' as const,
        description: 'Output format',
      },
    ]
  }

  defineCommands(): CommandDefinition[] {
    return [
      // Types Commands
      {
        name: 'types:generate',
        description: 'Generate TypeScript types from sources',
        args: [
          {
            name: 'source',
            type: 'string' as const,
            description: 'Source to generate from (database, schema, api)',
          },
          {
            name: 'watch',
            type: 'boolean' as const,
            description: 'Watch for changes',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('types:generate', args),
      },
      {
        name: 'types:copy',
        description: 'Copy generated types to packages',
        args: [
          {
            name: 'package',
            type: 'string' as const,
            description: 'Target package',
          },
          {
            name: 'verify',
            type: 'boolean' as const,
            description: 'Verify types after copying',
            default: true,
          },
        ],
        handler: async (args) => this.dispatchCommand('types:copy', args),
      },
      {
        name: 'types:validate',
        description: 'Validate generated types',
        args: [
          {
            name: 'strict',
            type: 'boolean' as const,
            description: 'Use strict validation',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('types:validate', args),
      },

      // Schema Commands
      {
        name: 'schema:create',
        description: 'Create a new schema',
        args: [
          {
            name: 'name',
            type: 'string' as const,
            required: true,
            description: 'Schema name',
          },
          {
            name: 'template',
            type: 'string' as const,
            description: 'Template to use (basic, advanced, custom)',
            default: 'basic',
          },
        ],
        handler: async (args) => this.dispatchCommand('schema:create', args),
      },
      {
        name: 'schema:migrate',
        description: 'Migrate schema to new version',
        args: [
          {
            name: 'name',
            type: 'string' as const,
            required: true,
            description: 'Schema name',
          },
          {
            name: 'version',
            type: 'string' as const,
            required: true,
            description: 'Target version',
          },
        ],
        confirmPrompt: 'This will modify the schema. Continue?',
        handler: async (args) => this.dispatchCommand('schema:migrate', args),
      },
      {
        name: 'schema:validate',
        description: 'Validate schema consistency',
        args: [
          {
            name: 'name',
            type: 'string' as const,
            description: 'Schema name (all if not specified)',
          },
        ],
        handler: async (args) => this.dispatchCommand('schema:validate', args),
      },

      // Documentation Commands
      {
        name: 'docs:generate',
        description: 'Generate all documentation',
        args: [
          {
            name: 'type',
            type: 'string' as const,
            description: 'Documentation type (api, readme, all)',
            default: 'all',
          },
          {
            name: 'format',
            type: 'string' as const,
            description: 'Output format (markdown, html, json)',
            default: 'markdown',
          },
        ],
        handler: async (args) => this.dispatchCommand('docs:generate', args),
      },
      {
        name: 'docs:api',
        description: 'Generate API documentation',
        args: [
          {
            name: 'package',
            type: 'string' as const,
            description: 'Package to document',
          },
          {
            name: 'include-private',
            type: 'boolean' as const,
            description: 'Include private APIs',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('docs:api', args),
      },
      {
        name: 'docs:readme',
        description: 'Generate README files for packages',
        args: [
          {
            name: 'package',
            type: 'string' as const,
            description: 'Package name',
          },
          {
            name: 'template',
            type: 'string' as const,
            description: 'README template to use',
          },
        ],
        handler: async (args) => this.dispatchCommand('docs:readme', args),
      },

      // Build Cache Commands
      {
        name: 'build:cache',
        description: 'Build and cache assets',
        args: [
          {
            name: 'target',
            type: 'string' as const,
            description: 'Build target (all, types, docs)',
            default: 'all',
          },
          {
            name: 'invalidate',
            type: 'boolean' as const,
            description: 'Invalidate existing cache',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('build:cache', args),
      },
      {
        name: 'build:clean',
        description: 'Clean build cache',
        args: [
          {
            name: 'all',
            type: 'boolean' as const,
            description: 'Clean all caches',
            default: false,
          },
        ],
        confirmPrompt: 'This will delete cached assets. Continue?',
        handler: async (args) => this.dispatchCommand('build:clean', args),
      },
    ]
  }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(AssetsCLI).catch(console.error)
}

export { AssetsCLI }
