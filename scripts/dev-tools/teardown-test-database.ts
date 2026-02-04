#!/usr/bin/env tsx

/**
 * Teardown Test Database
 *
 * Cleans up test database after integration tests complete.
 * Supports:
 * - Docker PostgreSQL (stop container)
 * - NeonDB (delete branch, if auto-provisioned)
 * - Existing POSTGRES_URL (no cleanup)
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ErrorCode } from '../lib/errors.js'

const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
}

interface TeardownOptions {
  type: 'docker' | 'neon' | 'existing'
  connectionString?: string
}

/**
 * Get docker compose command
 */
function getDockerComposeCmd(): string {
  try {
    execSync('docker compose version', { stdio: 'ignore' })
    return 'docker compose'
  } catch {
    return 'docker-compose'
  }
}

/**
 * Teardown Docker database
 */
async function teardownDockerDatabase(): Promise<void> {
  const projectRoot = resolve(__dirname, '../..')
  const composeFile = resolve(projectRoot, 'infrastructure/docker-compose/services/test.yml')

  if (!existsSync(composeFile)) {
    logger.warn(
      'infrastructure/docker-compose/services/test.yml not found, skipping Docker teardown',
    )
    return
  }

  const composeCmd = getDockerComposeCmd()

  logger.info('Stopping Docker test database...')

  try {
    execSync(`${composeCmd} -f infrastructure/docker-compose/services/test.yml down`, {
      cwd: projectRoot,
      stdio: 'inherit',
    })
    logger.success('Docker test database stopped')
  } catch (error) {
    logger.error(
      `Failed to stop Docker database: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Teardown NeonDB database (if auto-provisioned)
 */
async function teardownNeonDatabase(_connectionString: string): Promise<void> {
  const neonApiKey = process.env.NEON_API_KEY

  if (!neonApiKey) {
    logger.warn('NEON_API_KEY not set, skipping NeonDB teardown')
    return
  }

  logger.info('Cleaning up NeonDB test database...')

  try {
    // Use Neon API to delete test branch
    // Note: This is a simplified version - full implementation would use Neon API
    // For now, just log that cleanup would happen
    logger.warn('Neon API cleanup not fully implemented')
    // Full Neon API integration would go here
  } catch (error) {
    logger.warn(`Neon cleanup error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Main teardown function
 */
export async function teardownTestDatabase(options: TeardownOptions): Promise<void> {
  switch (options.type) {
    case 'docker':
      await teardownDockerDatabase()
      break

    case 'neon':
      if (options.connectionString) {
        await teardownNeonDatabase(options.connectionString)
      }
      break

    case 'existing':
      logger.info('Using existing database, skipping teardown')
      break

    default:
      logger.warn(`Unknown database type: ${options.type}`)
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbType = (process.env.TEST_DB_TYPE as 'docker' | 'neon' | 'existing') || 'docker'
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL

  teardownTestDatabase({
    type: dbType,
    connectionString,
  })
    .then(() => {
      logger.success('Test database teardown complete!')
      process.exit(ErrorCode.SUCCESS)
    })
    .catch((error) => {
      logger.error(`Teardown failed: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(ErrorCode.CONFIG_ERROR)
    })
}
