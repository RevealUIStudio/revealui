#!/usr/bin/env tsx

/**
 * Database CLI
 *
 * Unified entry point for database operations with dual-mode output support.
 *
 * Usage:
 *   pnpm db:init      # Initialize database schema
 *   pnpm db:reset     # Reset database (drop all tables, re-run migrations)
 *   pnpm db:migrate   # Run pending migrations
 *   pnpm db:seed      # Seed sample data
 *   pnpm db:backup    # Create a backup
 *   pnpm db:restore   # Restore from backup
 *   pnpm db:status    # Show database status
 *
 * Add --json flag to any command for machine-readable output.
 */

import type { ParsedArgs } from '../lib/args.js'
import { getExecutionLogger } from '../lib/audit/execution-logger.js'
import { executionError } from '../lib/errors.js'
import { detectDatabaseProvider, listTables, validateDatabaseConnection } from '../lib/index.js'
import { ok, type ScriptOutput } from '../lib/output.js'
import { BaseCLI, type CommandDefinition, runCLI } from './_base.js'

// =============================================================================
// Types for JSON output
// =============================================================================

interface DatabaseStatusData {
  databases: DatabaseInfo[]
}

interface DatabaseInfo {
  name: string
  provider: string
  connected: boolean
  latencyMs?: number
  serverVersion?: string
  database?: string
  error?: string
  tables?: TableInfo[]
  tableCount?: number
}

interface TableInfo {
  name: string
  rowCount: number | null
}

// =============================================================================
// Script paths for dispatched commands
// =============================================================================

const COMMAND_SCRIPTS: Record<string, string> = {
  init: '../setup/database.ts',
  reset: '../setup/reset-database.ts',
  migrate: '../setup/migrations.ts',
  seed: '../setup/seed-sample-content.ts',
  backup: '../commands/database/backup.ts',
  restore: '../commands/database/restore.ts',
}

// =============================================================================
// Database CLI
// =============================================================================

class DatabaseCLI extends BaseCLI {
  name = 'db'
  description = 'Database management operations'
  private executionId: string | null = null

  /**
   * Override run() to add execution logging
   */
  async run(): Promise<void> {
    const logger = await getExecutionLogger()
    let success = true
    let error: string | undefined

    try {
      // Start execution logging
      this.executionId = await logger.startExecution({
        scriptName: this.name,
        command: this.argv[2] || 'status',
        args: this.argv.slice(3),
      })

      // Run the original command
      await super.run()
    } catch (err) {
      success = false
      error = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      // End execution logging
      if (this.executionId) {
        await logger.endExecution(this.executionId, {
          success,
          error,
        })
      }
    }
  }

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'status',
        description: 'Show database connection status and table info',
        args: [],
        handler: (args) => this.status(args),
      },
      {
        name: 'init',
        description: 'Initialize database schema',
        args: [],
        handler: (args) => this.dispatch('init', args),
      },
      {
        name: 'reset',
        description: 'Reset database (drop all tables, re-run migrations)',
        confirmPrompt: 'This will delete all data. Are you sure?',
        args: [{ name: 'no-backup', type: 'boolean', description: 'Skip backup before reset' }],
        handler: (args) => this.dispatch('reset', args),
      },
      {
        name: 'migrate',
        description: 'Run pending migrations',
        args: [],
        handler: (args) => this.dispatch('migrate', args),
      },
      {
        name: 'seed',
        description: 'Seed sample data',
        args: [],
        handler: (args) => this.dispatch('seed', args),
      },
      {
        name: 'backup',
        description: 'Create a database backup',
        args: [{ name: 'output', short: 'o', type: 'string', description: 'Output file path' }],
        handler: (args) => this.dispatch('backup', args),
      },
      {
        name: 'restore',
        description: 'Restore database from backup',
        confirmPrompt: 'This will overwrite current data. Are you sure?',
        args: [],
        handler: (args) => this.dispatch('restore', args),
      },
    ]
  }

  // ===========================================================================
  // Commands
  // ===========================================================================

  private async status(_args: ParsedArgs): Promise<ScriptOutput<DatabaseStatusData>> {
    const databases: DatabaseInfo[] = []

    // Check REST database
    const restUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL
    if (restUrl) {
      const info = await this.getDatabaseInfo('REST', restUrl)
      databases.push(info)
    } else {
      databases.push({
        name: 'REST',
        provider: 'unknown',
        connected: false,
        error: 'Not configured (POSTGRES_URL not set)',
      })
    }

    // Check Vector database (if different)
    const vectorUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URI
    if (vectorUrl && vectorUrl !== restUrl) {
      const info = await this.getDatabaseInfo('Vector', vectorUrl)
      databases.push(info)
    }

    // Human-mode output
    if (!this.output.isJsonMode()) {
      this.output.header('Database Status')

      for (const db of databases) {
        this.output.progress(`${db.name} Database (${db.provider})`)
        this.output.divider()

        if (!db.connected) {
          this.output.warn(`Connection failed: ${db.error}`)
          continue
        }

        this.output.progress(`Connected (${db.latencyMs}ms)`)
        this.output.progress(`Server version: ${db.serverVersion}`)
        this.output.progress(`Database: ${db.database}`)
        this.output.progress(`Tables: ${db.tableCount}`)

        if (db.tables && db.tables.length > 0) {
          this.output.divider()
          this.output.progress('Tables:')
          for (const table of db.tables.slice(0, 20)) {
            const count = table.rowCount !== null ? `${table.rowCount} rows` : '(error reading)'
            this.output.progress(`  - ${table.name}: ${count}`)
          }
          if (db.tables.length > 20) {
            this.output.progress(`  ... and ${db.tables.length - 20} more tables`)
          }
        }

        console.log() // Blank line between databases
      }
    }

    const allConnected = databases.every((db) => db.connected)
    return ok({ databases }, { allConnected })
  }

  private async getDatabaseInfo(name: string, connectionString: string): Promise<DatabaseInfo> {
    const provider = detectDatabaseProvider(connectionString)

    const connectionResult = await validateDatabaseConnection(connectionString, {})

    if (!connectionResult.connected) {
      return {
        name,
        provider,
        connected: false,
        error: connectionResult.error,
      }
    }

    const info: DatabaseInfo = {
      name,
      provider,
      connected: true,
      latencyMs: connectionResult.latencyMs,
      serverVersion: connectionResult.serverVersion,
      database: connectionResult.database,
    }

    // Get table info
    try {
      const tableNames = await listTables(connectionString)
      info.tableCount = tableNames.length

      if (tableNames.length > 0) {
        const tables: TableInfo[] = []

        // Get row counts
        const { Pool } = await import('pg')
        const pool = new Pool({
          connectionString,
          ssl: { rejectUnauthorized: false },
        })

        try {
          const client = await pool.connect()
          try {
            for (const tableName of tableNames.slice(0, 30)) {
              try {
                const result = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`)
                tables.push({
                  name: tableName,
                  rowCount: parseInt(result.rows[0]?.count || '0', 10),
                })
              } catch {
                tables.push({ name: tableName, rowCount: null })
              }
            }
          } finally {
            client.release()
          }
        } finally {
          await pool.end()
        }

        info.tables = tables
      }
    } catch (_error) {
      // Tables couldn't be listed, but connection worked
    }

    return info
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

    // For dispatched commands in JSON mode, warn that output may not be JSON
    if (this.output.isJsonMode()) {
      // Return early with dispatch info - the script will run separately
      this.output.progress(`Dispatching to ${command} script...`)
    }

    try {
      // Forward remaining positional args
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

runCLI(DatabaseCLI)
