#!/usr/bin/env tsx
/**
 * Database CLI
 *
 * Unified entry point for database operations.
 *
 * Usage:
 *   pnpm db:init      # Initialize database schema
 *   pnpm db:reset     # Reset database (drop all tables, re-run migrations)
 *   pnpm db:migrate   # Run pending migrations
 *   pnpm db:seed      # Seed sample data
 *   pnpm db:backup    # Create a backup
 *   pnpm db:restore   # Restore from backup
 *   pnpm db:status    # Show database status
 */

import { createLogger } from '../lib/index.js'

const logger = createLogger({ prefix: 'DB' })

const COMMANDS = {
  init: '../engineer/setup/init-database.ts',
  reset: '../engineer/setup/reset-database.ts',
  migrate: '../engineer/setup/run-migration.ts',
  seed: '../engineer/setup/seed-sample-content.ts',
  backup: '../commands/database/backup.ts',
  restore: '../commands/database/restore.ts',
  status: '../commands/database/status.ts',
}

async function main() {
  const command = process.argv[2]

  if (!command || command === '--help' || command === '-h') {
    showHelp()
    return
  }

  const scriptPath = COMMANDS[command as keyof typeof COMMANDS]

  if (!scriptPath) {
    logger.error(`Unknown command: ${command}`)
    showHelp()
    process.exit(1)
  }

  // Forward to the appropriate script
  try {
    // Pass remaining args
    const args = process.argv.slice(3)
    process.argv = [process.argv[0], process.argv[1], ...args]

    await import(scriptPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      logger.error(`Command script not found: ${scriptPath}`)
      logger.info(`This command may not be implemented yet.`)
    } else {
      throw error
    }
  }
}

function showHelp() {
  console.log(`
Database CLI

Usage:
  pnpm db:<command> [options]

Commands:
  init      Initialize database schema
  reset     Reset database (drop all tables, re-run migrations)
  migrate   Run pending migrations
  seed      Seed sample data
  backup    Create a backup
  restore   Restore from backup
  status    Show database status

Options:
  --help, -h   Show this help message

Examples:
  pnpm db:init
  pnpm db:reset --confirm --no-backup
  pnpm db:migrate
  pnpm db:seed
  pnpm db:backup
  pnpm db:restore backup-2025-01-29.json
`)
}

main().catch((error) => {
  logger.error(error.message)
  process.exit(1)
})
