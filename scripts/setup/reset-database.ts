#!/usr/bin/env tsx

/**
 * Database Reset Script
 *
 * Resets the database by dropping all tables and recreating the schema.
 * Includes safety checks, backup functionality, and transaction support.
 *
 * Usage:
 *   pnpm db:reset                    # Interactive reset
 *   pnpm db:reset --confirm          # Skip confirmation prompt
 *   pnpm db:reset --no-backup        # Skip backup creation
 *   pnpm db:reset --seed             # Seed sample data after reset
 *   pnpm db:reset --database=rest    # Reset only REST database (Neon)
 *   pnpm db:reset --database=vector  # Reset only Vector database (Supabase)
 */

import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
import { ErrorCode } from '../lib/errors.js'
  ALL_TABLES,
  confirm,
  createLogger,
  detectDatabaseProvider,
  getProjectRoot,
  isCI,
  listTables,
  validateDatabaseConnection,
} from '../../lib/index.js'

const logger = createLogger({ prefix: 'DB Reset' })

interface ResetOptions {
  skipConfirmation: boolean
  skipBackup: boolean
  seedAfterReset: boolean
  database: 'rest' | 'vector' | 'all'
  force: boolean
}

function parseArgs(): ResetOptions {
  const args = process.argv.slice(2)
  return {
    skipConfirmation: args.includes('--confirm') || args.includes('-y'),
    skipBackup: args.includes('--no-backup'),
    seedAfterReset: args.includes('--seed'),
    database: getDbArg(args),
    force: args.includes('--force'),
  }
}

function getDbArg(args: string[]): 'rest' | 'vector' | 'all' {
  const dbArg = args.find((a) => a.startsWith('--database='))
  if (dbArg) {
    const value = dbArg.split('=')[1]
    if (value === 'rest' || value === 'vector') {
      return value
    }
  }
  return 'all'
}

/**
 * Gets the appropriate connection string based on database type.
 */
function getConnectionString(dbType: 'rest' | 'vector'): string | undefined {
  if (dbType === 'rest') {
    return process.env.POSTGRES_URL || process.env.DATABASE_URL
  }
  // Vector database uses DATABASE_URL (Supabase)
  return process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URI
}

/**
 * Creates a backup of the database tables.
 */
async function createBackup(connectionString: string, projectRoot: string): Promise<string | null> {
  const backupDir = join(projectRoot, '.revealui', 'backups')
  await mkdir(backupDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(backupDir, `db-backup-${timestamp}.json`)

  try {
    const { Pool } = await import('pg')
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })

    const backup: Record<string, unknown[]> = {}

    const client = await pool.connect()
    try {
      // Get all tables
      const tables = await listTables(connectionString)

      for (const table of tables) {
        try {
          const result = await client.query(`SELECT * FROM "${table}"`)
          backup[table] = result.rows
          logger.info(`Backed up ${result.rows.length} rows from ${table}`)
        } catch (error) {
          logger.warn(`Could not backup table ${table}: ${error}`)
        }
      }
    } finally {
      client.release()
      await pool.end()
    }

    // Write backup to file
    await writeFile(backupPath, JSON.stringify(backup, null, 2))
    logger.success(`Backup created: ${backupPath}`)

    // Clean up old backups (keep last 5)
    await cleanOldBackups(backupDir, 5)

    return backupPath
  } catch (error) {
    logger.error(`Failed to create backup: ${error}`)
    return null
  }
}

/**
 * Removes old backup files, keeping only the most recent ones.
 */
async function cleanOldBackups(backupDir: string, keepCount: number): Promise<void> {
  try {
    const files = await readdir(backupDir)
    const backupFiles = files
      .filter((f) => f.startsWith('db-backup-') && f.endsWith('.json'))
      .sort()
      .reverse()

    const toDelete = backupFiles.slice(keepCount)
    for (const file of toDelete) {
      await unlink(join(backupDir, file))
      logger.info(`Deleted old backup: ${file}`)
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Drops all tables in the database.
 */
async function dropAllTables(connectionString: string): Promise<boolean> {
  const { Pool } = await import('pg')
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    const client = await pool.connect()
    try {
      // Start transaction
      await client.query('BEGIN')

      try {
        // Get all tables
        const tablesResult = await client.query(`
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public'
        `)

        const tables = tablesResult.rows.map((r) => r.tablename)

        if (tables.length === 0) {
          logger.info('No tables to drop')
          await client.query('COMMIT')
          return true
        }

        // Disable triggers to avoid foreign key issues
        await client.query('SET session_replication_role = replica')

        // Drop all tables
        for (const table of tables) {
          logger.info(`Dropping table: ${table}`)
          await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`)
        }

        // Re-enable triggers
        await client.query('SET session_replication_role = DEFAULT')

        // Also drop any custom types (enums)
        const enumsResult = await client.query(`
          SELECT typname FROM pg_type t
          JOIN pg_namespace n ON t.typnamespace = n.oid
          WHERE n.nspname = 'public' AND t.typtype = 'e'
        `)

        for (const row of enumsResult.rows) {
          logger.info(`Dropping type: ${row.typname}`)
          await client.query(`DROP TYPE IF EXISTS "${row.typname}" CASCADE`)
        }

        // Commit transaction
        await client.query('COMMIT')
        logger.success(`Dropped ${tables.length} tables`)
        return true
      } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK')
        throw error
      }
    } finally {
      client.release()
    }
  } catch (error) {
    logger.error(`Failed to drop tables: ${error}`)
    return false
  } finally {
    await pool.end()
  }
}

/**
 * Runs Drizzle migrations to recreate the schema.
 */
async function runMigrations(projectRoot: string): Promise<boolean> {
  try {
    const { execSync } = await import('node:child_process')

    logger.info('Running Drizzle migrations...')
    execSync('pnpm db:migrate', {
      cwd: projectRoot,
      stdio: 'inherit',
    })

    logger.success('Migrations completed')
    return true
  } catch (error) {
    logger.error(`Migration failed: ${error}`)
    return false
  }
}

/**
 * Seeds the database with sample data.
 */
async function seedDatabase(projectRoot: string): Promise<boolean> {
  try {
    const { execSync } = await import('node:child_process')

    logger.info('Seeding database...')
    execSync('pnpm db:seed', {
      cwd: projectRoot,
      stdio: 'inherit',
    })

    logger.success('Seeding completed')
    return true
  } catch (error) {
    logger.error(`Seeding failed: ${error}`)
    return false
  }
}

/**
 * Main reset function.
 */
async function resetDatabase() {
  const options = parseArgs()
  const projectRoot = await getProjectRoot(import.meta.url)

  logger.header('Database Reset')

  // Safety check for CI
  if (isCI() && !options.force) {
    logger.error('Running in CI environment. Use --force to proceed.')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  // Get connection strings
  const databases: Array<{ type: 'rest' | 'vector'; url: string | undefined }> = []

  if (options.database === 'all' || options.database === 'rest') {
    databases.push({ type: 'rest', url: getConnectionString('rest') })
  }
  if (options.database === 'all' || options.database === 'vector') {
    const vectorUrl = getConnectionString('vector')
    // Only add vector if it's different from rest
    if (vectorUrl && vectorUrl !== getConnectionString('rest')) {
      databases.push({ type: 'vector', url: vectorUrl })
    }
  }

  // Validate connection strings
  const validDatabases = databases.filter((db) => {
    if (!db.url) {
      if (options.database !== 'all') {
        logger.error(`No connection string found for ${db.type} database`)
      }
      return false
    }
    return true
  })

  if (validDatabases.length === 0) {
    logger.error('No database connection strings found!')
    logger.info('Set POSTGRES_URL or DATABASE_URL environment variable.')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  // Show what will be reset
  logger.info('Databases to reset:')
  for (const db of validDatabases) {
    const provider = detectDatabaseProvider(db.url!)
    logger.info(`  - ${db.type} (${provider})`)
  }

  // Validate connections
  logger.info('Validating database connections...')
  for (const db of validDatabases) {
    const result = await validateDatabaseConnection(db.url!, { logger })
    if (!result.connected) {
      logger.error(`Cannot connect to ${db.type} database: ${result.error}`)
      process.exit(ErrorCode.CONFIG_ERROR)
    }
  }

  // Safety confirmation
  if (!options.skipConfirmation) {
    logger.divider()
    logger.warn('WARNING: This will DROP ALL TABLES and DATA!')
    logger.warn('This action cannot be undone.')
    logger.divider()

    const confirmed = await confirm('Are you sure you want to reset the database?')
    if (!confirmed) {
      logger.info('Reset cancelled.')
      return
    }
  }

  // Process each database
  for (const db of validDatabases) {
    logger.divider()
    logger.info(`Resetting ${db.type} database...`)

    // Create backup
    if (!options.skipBackup) {
      logger.info('Creating backup...')
      const backupPath = await createBackup(db.url!, projectRoot)
      if (!backupPath) {
        const continueAnyway = await confirm('Backup failed. Continue anyway?')
        if (!continueAnyway) {
          logger.info('Reset cancelled.')
          return
        }
      }
    }

    // Drop all tables
    logger.info('Dropping all tables...')
    const dropped = await dropAllTables(db.url!)
    if (!dropped) {
      logger.error('Failed to drop tables. Aborting.')
      process.exit(ErrorCode.CONFIG_ERROR)
    }
  }

  // Run migrations (once, on primary database)
  logger.divider()
  const migrationsRun = await runMigrations(projectRoot)
  if (!migrationsRun) {
    logger.error('Migration failed. Database may be in inconsistent state.')
    logger.info('Run "pnpm db:migrate" manually to attempt recovery.')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  // Seed if requested
  if (options.seedAfterReset) {
    logger.divider()
    await seedDatabase(projectRoot)
  }

  // Final status
  logger.divider()
  logger.success('Database reset complete!')

  // Verify tables exist
  for (const db of validDatabases) {
    const tables = await listTables(db.url!)
    logger.info(`${db.type} database: ${tables.length} tables created`)
  }
}

// Run the reset
resetDatabase().catch((error) => {
  logger.error(`Reset failed: ${error.message}`)
  process.exit(ErrorCode.EXECUTION_ERROR)
})
