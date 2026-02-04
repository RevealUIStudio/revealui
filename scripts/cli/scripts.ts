#!/usr/bin/env tsx

/**
 * Script Explorer CLI
 *
 * Interactive tool to explore, search, and run scripts with enhanced discovery features.
 *
 * Usage:
 *   pnpm scripts list [--category <cat>] [--dry-run]   List scripts with filters
 *   pnpm scripts search <query>                        Full-text search
 *   pnpm scripts info <name>                           Detailed script information
 *   pnpm scripts tree                                  Dependency visualization
 *   pnpm scripts run <name> <command> [args...]        Execute with validation
 *   pnpm scripts history [<name>]                      Execution history
 *
 * Examples:
 *   pnpm scripts list --category database
 *   pnpm scripts search "backup"
 *   pnpm scripts info db
 *   pnpm scripts run db status --json
 */

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getExecutionLogger } from '../lib/audit/execution-logger.js'
import { ErrorCode, ScriptError } from '../lib/errors.js'
import type { ScriptSearchCriteria } from '../lib/registry/script-metadata.js'
import { createScriptRegistry } from '../lib/registry/script-registry.js'
import { ExecutingCLI, type CommandDefinition, runCLI } from './_base.js'

// Get project root
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../..')

/**
 * Script Explorer CLI
 */
class ScriptsCLI extends ExecutingCLI {
  protected enableExecutionLogging = true
  name = 'scripts'
  description = 'Interactive script explorer and runner'

  private registry = createScriptRegistry(PROJECT_ROOT)

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'list',
        description: 'List all scripts with optional filters',
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
          {
            name: 'tags',
            short: 't',
            type: 'string',
            description: 'Filter by tags (comma-separated)',
          },
        ],
      },
      {
        name: 'search',
        description: 'Full-text search across scripts (usage: scripts search <query>)',
        handler: async () => this.search(),
        args: [],
      },
      {
        name: 'info',
        description: 'Show detailed information about a script (usage: scripts info <name>)',
        handler: async () => this.info(),
        args: [],
      },
      {
        name: 'tree',
        description: 'Show script dependency tree (usage: scripts tree [name])',
        handler: async () => this.tree(),
        args: [],
      },
      {
        name: 'run',
        description:
          'Execute a script with validation (usage: scripts run <name> <command> [args...])',
        handler: async () => this.runScript(),
        args: [],
      },
      {
        name: 'history',
        description: 'Show execution history (usage: scripts history [name])',
        handler: async () => this.history(),
        args: [
          {
            name: 'failed',
            short: 'f',
            type: 'boolean',
            description: 'Show only failed executions',
          },
          {
            name: 'limit',
            short: 'l',
            type: 'number',
            description: 'Limit number of results',
          },
        ],
      },
    ]
  }

  /**
   * List scripts with filters
   */
  private async list() {
    const category = this.getFlag<string>('category', '')
    const dryRun = this.getFlag('dry-run', false)
    const tagsStr = this.getFlag<string>('tags', '')

    const criteria: ScriptSearchCriteria = {}

    if (category) {
      criteria.category = category
    }

    if (dryRun) {
      criteria.supportsDryRun = true
    }

    if (tagsStr) {
      criteria.tags = tagsStr.split(',').map((t) => t.trim())
    }

    const results = await this.registry.search(criteria)

    if (this.args.flags.json) {
      return this.output.success({ results })
    }

    // Human-readable output
    if (results.length === 0) {
      this.output.warn('No scripts found matching criteria')
      return this.output.success({ total: 0 })
    }

    console.log(`\nFound ${results.length} script${results.length === 1 ? '' : 's'}\n`)

    // Group by category
    const grouped = results.reduce(
      (acc, { script }) => {
        if (!acc[script.category]) {
          acc[script.category] = []
        }
        acc[script.category].push(script)
        return acc
      },
      {} as Record<string, (typeof results)[0]['script'][]>,
    )

    for (const [cat, scripts] of Object.entries(grouped)) {
      console.log(`\n${cat.toUpperCase()}`)
      console.log('─'.repeat(60))

      for (const script of scripts) {
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
        if (script.tags.length > 0) {
          console.log(`    Tags: ${script.tags.join(', ')}`)
        }
        console.log()
      }
    }

    return this.output.success({ total: results.length })
  }

  /**
   * Full-text search
   */
  private async search() {
    const query = this.getPositional(0)
    if (!query) {
      throw new ScriptError('Missing required query argument', ErrorCode.VALIDATION_ERROR, {
        usage: 'pnpm scripts search <query>',
      })
    }

    const results = await this.registry.search({ query })

    if (this.args.flags.json) {
      return this.output.success({ results })
    }

    // Human-readable output
    if (results.length === 0) {
      this.output.warn(`No scripts found matching "${query}"`)
      return this.output.success({ total: 0 })
    }

    console.log(
      `\nFound ${results.length} script${results.length === 1 ? '' : 's'} matching "${query}"\n`,
    )

    for (const { script, score, matches } of results) {
      const flags = []
      if (script.supportsDryRun) flags.push('dry-run')
      if (script.requiresConfirmation) flags.push('confirm')

      const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : ''

      console.log(`  ${script.name}${flagStr} (score: ${score.toFixed(2)})`)
      console.log(`    ${script.description}`)

      if (matches.length > 0) {
        console.log(`    Matches: ${matches.map((m) => `${m.field}:${m.value}`).join(', ')}`)
      }

      if (script.commands.length > 0) {
        console.log(`    Commands: ${script.commands.join(', ')}`)
      }

      console.log()
    }

    return this.output.success({ total: results.length })
  }

  /**
   * Show detailed script information
   */
  private async info() {
    const name = this.getPositional(0)
    if (!name) {
      throw new ScriptError('Missing required script name', ErrorCode.VALIDATION_ERROR, {
        usage: 'pnpm scripts info <name>',
      })
    }

    const script = await this.registry.getScript(name)

    if (!script) {
      throw new ScriptError(`Script not found: ${name}`, ErrorCode.NOT_FOUND, { name })
    }

    if (this.args.flags.json) {
      return this.output.success({ script })
    }

    // Human-readable output
    console.log(`\n${script.name}`)
    console.log('='.repeat(60))
    console.log(`\nDescription: ${script.description}`)
    console.log(`Category: ${script.category}`)
    console.log(`File: ${script.relativePath}`)

    if (script.version) {
      console.log(`Version: ${script.version}`)
    }

    console.log(`\nFeatures:`)
    console.log(`  Dry-run support: ${script.supportsDryRun ? 'Yes' : 'No'}`)
    console.log(`  Requires confirmation: ${script.requiresConfirmation ? 'Yes' : 'No'}`)

    if (script.deprecated) {
      console.log(`\n⚠️  DEPRECATED`)
    }

    if (script.commands.length > 0) {
      console.log(`\nCommands:`)
      for (const cmd of script.commands) {
        console.log(`  - ${cmd}`)
      }
    }

    if (script.tags.length > 0) {
      console.log(`\nTags: ${script.tags.join(', ')}`)
    }

    console.log(`\nUsage:`)
    console.log(`  pnpm ${script.name} <command> [options]`)

    if (script.commands.length > 0) {
      console.log(`\nExamples:`)
      for (const cmd of script.commands.slice(0, 3)) {
        console.log(`  pnpm ${script.name} ${cmd}`)
      }
    }

    console.log()

    return this.output.success({ script })
  }

  /**
   * Show dependency tree
   */
  private async tree() {
    const name = this.getPositional(0)

    if (name) {
      // Show tree for specific script
      const script = await this.registry.getScript(name)
      if (!script) {
        throw new ScriptError(`Script not found: ${name}`, ErrorCode.NOT_FOUND, { name })
      }

      // For now, just show a simple tree
      // A full implementation would analyze imports and build a dependency graph
      console.log(`\n${script.name}`)
      console.log('  (Dependency analysis not yet implemented)')
      console.log()

      return this.output.success({ script })
    }

    // Show all scripts grouped by category
    const categories = await this.registry.getCategories()

    console.log('\nScript Registry Tree\n')

    for (const category of categories) {
      const scripts = await this.registry.getByCategory(category)
      console.log(`${category}/`)

      for (const script of scripts) {
        const flags = []
        if (script.supportsDryRun) flags.push('dry-run')
        if (script.commands.length > 0) flags.push(`${script.commands.length} cmds`)

        const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : ''
        console.log(`  ├─ ${script.name}${flagStr}`)
      }

      console.log()
    }

    return this.output.success({ total: (await this.registry.load()).totalScripts })
  }

  /**
   * Execute a script with validation
   */
  private async runScript() {
    const name = this.getPositional(0)
    const command = this.getPositional(1)

    if (!(name && command)) {
      throw new ScriptError('Missing required arguments', ErrorCode.VALIDATION_ERROR, {
        usage: 'pnpm scripts run <name> <command> [args...]',
      })
    }

    // Verify script exists
    const script = await this.registry.getScript(name)
    if (!script) {
      throw new ScriptError(`Script not found: ${name}`, ErrorCode.NOT_FOUND, { name })
    }

    // Verify command exists
    if (script.commands.length > 0 && !script.commands.includes(command)) {
      throw new ScriptError(`Command not found: ${command}`, ErrorCode.VALIDATION_ERROR, {
        command,
        availableCommands: script.commands,
      })
    }

    // Build command arguments
    const args = [name, command, ...this.args.positional.slice(2)]

    // Add flags
    for (const [key, value] of Object.entries(this.args.flags)) {
      if (value === true) {
        args.push(`--${key}`)
      } else if (value !== false) {
        args.push(`--${key}`, String(value))
      }
    }

    this.output.progress(`Executing: pnpm ${args.join(' ')}\n`)

    // Execute using pnpm
    return new Promise<void>((resolve, reject) => {
      const child = spawn('pnpm', args, {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      })

      child.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(
            new ScriptError(
              `Script execution failed with code ${code}`,
              ErrorCode.EXECUTION_ERROR,
              { exitCode: code },
            ),
          )
        }
      })

      child.on('error', (error) => {
        reject(
          new ScriptError(`Failed to execute script: ${error.message}`, ErrorCode.EXECUTION_ERROR, {
            error: error.message,
          }),
        )
      })
    })
  }

  /**
   * Show execution history
   */
  private async history() {
    const name = this.getPositional(0)
    const failed = this.getFlag('failed', false)
    const limit = this.getFlag<number>('limit', 20)

    const logger = await getExecutionLogger(PROJECT_ROOT)

    const history = await logger.getHistory({
      scriptName: name,
      failedOnly: failed,
      limit,
    })

    if (this.args.flags.json) {
      return this.output.success({ history })
    }

    // Human-readable output
    if (history.length === 0) {
      this.output.warn('No execution history found')
      return this.output.success({ total: 0 })
    }

    console.log(`\nExecution History (${history.length} records)\n`)

    for (const record of history) {
      const status = record.success ? '✓' : '✗'
      const statusColor = record.success ? '\x1b[32m' : '\x1b[31m'
      const resetColor = '\x1b[0m'

      const duration = record.durationMs ? `${record.durationMs}ms` : 'running'
      const timestamp = record.startedAt.toLocaleString()

      console.log(`${statusColor}${status}${resetColor} ${record.scriptName} ${record.command}`)
      console.log(`  Time: ${timestamp}`)
      console.log(`  Duration: ${duration}`)
      console.log(`  User: ${record.user}@${record.hostname}`)

      if (record.error) {
        console.log(`  Error: ${record.error}`)
      }

      if (record.gitBranch) {
        console.log(
          `  Git: ${record.gitBranch}${record.gitCommit ? ` (${record.gitCommit.substring(0, 7)})` : ''}`,
        )
      }

      console.log()
    }

    return this.output.success({ total: history.length })
  }
}

// Run CLI
runCLI(ScriptsCLI)
