#!/usr/bin/env tsx
/**
 * Script Registry CLI
 *
 * Manage the centralized script registry - generate, query, and analyze script metadata.
 *
 * Usage:
 *   pnpm registry generate        Generate/update script registry
 *   pnpm registry stats           Show registry statistics
 *   pnpm registry list            List all scripts
 *   pnpm registry verify          Verify registry is up-to-date
 *
 * Examples:
 *   pnpm registry generate --verbose
 *   pnpm registry stats --json
 *   pnpm registry list --category database
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BaseCLI, runCLI, type CommandDefinition } from './_base.js'
import { createScriptRegistry } from '../lib/registry/script-registry.js'
import { ErrorCode, ScriptError } from '../lib/errors.js'

// Get project root
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../..')

/**
 * Script Registry CLI
 */
class RegistryCLI extends BaseCLI {
  name = 'registry'
  description = 'Manage the centralized script registry'

  private registry = createScriptRegistry(PROJECT_ROOT)

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'generate',
        description: 'Generate or update the script registry',
        handler: async () => this.generate(),
        args: [
          {
            name: 'force',
            short: 'f',
            type: 'boolean',
            description: 'Force regeneration even if registry is fresh',
          },
        ],
      },
      {
        name: 'stats',
        description: 'Show registry statistics',
        handler: async () => this.stats(),
      },
      {
        name: 'list',
        description: 'List all scripts',
        handler: async () => this.list(),
        args: [
          {
            name: 'category',
            short: 'c',
            type: 'string',
            description: 'Filter by category',
          },
          {
            name: 'dry-run',
            short: 'd',
            type: 'boolean',
            description: 'Show only scripts with dry-run support',
          },
        ],
      },
      {
        name: 'verify',
        description: 'Verify registry is up-to-date',
        handler: async () => this.verify(),
      },
    ]
  }

  /**
   * Generate script registry
   */
  private async generate() {
    const force = this.getFlag('force', false)
    const verbose = this.isVerbose()

    this.output.progress('Generating script registry...')

    const result = await this.registry.generate({ verbose, force })

    return this.output.success({
      message: 'Script registry generated successfully',
      totalScripts: result.totalScripts,
      totalCommands: result.stats.totalCommands,
      categories: Object.keys(result.byCategory).length,
      stats: result.stats,
    })
  }

  /**
   * Show registry statistics
   */
  private async stats() {
    const stats = await this.registry.getStats()
    const categories = await this.registry.getCategories()

    // Get script counts by category
    const categoryStats: Record<string, number> = {}
    for (const category of categories) {
      const scripts = await this.registry.getByCategory(category)
      categoryStats[category] = scripts.length
    }

    return this.output.success({
      ...stats,
      categories: categoryStats,
    })
  }

  /**
   * List all scripts
   */
  private async list() {
    const category = this.getFlag<string>('category', '')
    const dryRun = this.getFlag('dry-run', false)

    let scripts = category
      ? await this.registry.getByCategory(category)
      : (await this.registry.load()).scripts

    // Filter by dry-run support
    if (dryRun) {
      scripts = scripts.filter(s => s.supportsDryRun)
    }

    // Sort by category then name
    scripts.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category)
      }
      return a.name.localeCompare(b.name)
    })

    if (this.args.flags.json) {
      return this.output.success({ scripts })
    }

    // Human-readable output
    const grouped = scripts.reduce((acc, script) => {
      if (!acc[script.category]) {
        acc[script.category] = []
      }
      acc[script.category].push(script)
      return acc
    }, {} as Record<string, typeof scripts>)

    console.log(`\nFound ${scripts.length} script${scripts.length === 1 ? '' : 's'}\n`)

    for (const [cat, catScripts] of Object.entries(grouped)) {
      console.log(`\n${cat.toUpperCase()}`)
      console.log('─'.repeat(60))

      for (const script of catScripts) {
        const flags = []
        if (script.supportsDryRun) flags.push('dry-run')
        if (script.requiresConfirmation) flags.push('confirm')
        if (script.deprecated) flags.push('deprecated')

        const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : ''

        console.log(`  ${script.name}${flagStr}`)
        console.log(`    ${script.description}`)
        if (script.commands.length > 0) {
          console.log(`    Commands: ${script.commands.join(', ')}`)
        }
        console.log()
      }
    }

    return this.output.success({ total: scripts.length })
  }

  /**
   * Verify registry is up-to-date
   */
  private async verify() {
    try {
      const existing = await this.registry.load()

      // Generate fresh registry without saving
      const fresh = await this.registry.generate({ force: true, verbose: false })

      // Compare
      const changes = {
        added: fresh.scripts.filter(
          fs => !existing.scripts.some(es => es.name === fs.name)
        ),
        removed: existing.scripts.filter(
          es => !fresh.scripts.some(fs => fs.name === es.name)
        ),
        modified: fresh.scripts.filter(fs => {
          const es = existing.scripts.find(s => s.name === fs.name)
          return es && es.lastModified !== fs.lastModified
        }),
      }

      const isUpToDate =
        changes.added.length === 0 &&
        changes.removed.length === 0 &&
        changes.modified.length === 0

      if (isUpToDate) {
        return this.output.success({
          upToDate: true,
          message: 'Registry is up-to-date',
        })
      }

      return this.output.warn({
        upToDate: false,
        message: 'Registry is out of date',
        changes: {
          added: changes.added.map(s => s.name),
          removed: changes.removed.map(s => s.name),
          modified: changes.modified.map(s => s.name),
        },
      })
    } catch (error) {
      throw new ScriptError(
        'Registry verification failed',
        ErrorCode.VALIDATION_ERROR,
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }
}

// Run CLI
runCLI(RegistryCLI)
