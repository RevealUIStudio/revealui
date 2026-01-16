#!/usr/bin/env tsx

/**
 * Setup Test Database
 *
 * Automatically provisions a test database for integration tests.
 * Supports:
 * - Docker PostgreSQL (local testing)
 * - NeonDB (via API, if NEON_API_KEY is set)
 * - Existing POSTGRES_URL (use as-is)
 */

import { resolve } from 'path'
import { config } from 'dotenv'
import { execSync } from 'child_process'
import { existsSync } from 'fs'

// Load environment variables
config({ path: resolve(__dirname, '../../apps/cms/.env.local') })
config({ path: resolve(__dirname, '../../apps/cms/.env.development.local') })
config({ path: resolve(__dirname, '../../apps/cms/.env') })
config({ path: resolve(__dirname, '../../.env.local') })
config({ path: resolve(__dirname, '../../.env') })

const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
}

interface DatabaseSetup {
  connectionString: string
  type: 'docker' | 'neon' | 'existing'
  cleanup?: () => Promise<void>
}

/**
 * Check if Docker is available
 */
function hasDocker(): boolean {
  try {
    execSync('docker --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Check if docker-compose is available
 */
function hasDockerCompose(): boolean {
  try {
    execSync('docker compose version', { stdio: 'ignore' })
    return true
  } catch {
    try {
      execSync('docker-compose --version', { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
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
 * Setup Docker PostgreSQL for testing
 */
async function setupDockerDatabase(): Promise<DatabaseSetup> {
  const projectRoot = resolve(__dirname, '../..')
  const composeFile = resolve(projectRoot, 'docker-compose.test.yml')

  if (!existsSync(composeFile)) {
    throw new Error('docker-compose.test.yml not found')
  }

  if (!hasDocker()) {
    throw new Error('Docker is not installed')
  }

  if (!hasDockerCompose()) {
    throw new Error('docker-compose is not available')
  }

  const composeCmd = getDockerComposeCmd()
  const [cmd, ...args] = composeCmd.split(' ')

  logger.info('Starting Docker PostgreSQL test database...')

  // Start database
  execSync(`${composeCmd} -f docker-compose.test.yml up -d`, {
    cwd: projectRoot,
    stdio: 'inherit',
  })

  // Wait for database to be ready
  logger.info('Waiting for database to be ready...')
  let retries = 30
  while (retries > 0) {
    try {
      execSync(
        `${cmd} ${args.join(' ')} -f docker-compose.test.yml exec -T postgres-test pg_isready -U test`,
        { cwd: projectRoot, stdio: 'ignore' },
      )
      break
    } catch {
      retries--
      if (retries === 0) {
        throw new Error('Database failed to start after 30 retries')
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  // Run migrations
  logger.info('Running migrations...')
  const migrationFile = resolve(projectRoot, 'packages/db/drizzle/0000_misty_pepper_potts.sql')

  if (existsSync(migrationFile)) {
    const { readFileSync } = await import('fs')
    const sql = readFileSync(migrationFile, 'utf-8')

    execSync(
      `${cmd} ${args.join(' ')} -f docker-compose.test.yml exec -T postgres-test psql -U test -d test_revealui`,
      {
        cwd: projectRoot,
        input: sql,
        stdio: 'inherit',
      },
    )
  } else {
    // Try drizzle-kit push
    try {
      execSync('pnpm --filter @revealui/db db:push', {
        cwd: projectRoot,
        env: {
          ...process.env,
          POSTGRES_URL: 'postgresql://test:test@localhost:5433/test_revealui',
        },
        stdio: 'inherit',
      })
    } catch (error) {
      logger.warn('Migration failed, but continuing...')
    }
  }

  // Enable pgvector
  logger.info('Enabling pgvector extension...')
  try {
    execSync(
      `${cmd} ${args.join(' ')} -f docker-compose.test.yml exec -T postgres-test psql -U test -d test_revealui -c "CREATE EXTENSION IF NOT EXISTS vector;"`,
      { cwd: projectRoot, stdio: 'ignore' },
    )
  } catch {
    logger.warn('Failed to enable pgvector extension')
  }

  const connectionString = 'postgresql://test:test@localhost:5433/test_revealui'

  logger.success(`Docker database ready: ${connectionString}`)

  return {
    connectionString,
    type: 'docker',
    cleanup: async () => {
      logger.info('Stopping Docker test database...')
      execSync(`${composeCmd} -f docker-compose.test.yml down`, {
        cwd: projectRoot,
        stdio: 'inherit',
      })
    },
  }
}

/**
 * Setup NeonDB test database (if API key is available)
 */
async function setupNeonDatabase(): Promise<DatabaseSetup | null> {
  const neonApiKey = process.env.NEON_API_KEY

  if (!neonApiKey) {
    return null
  }

  logger.info('Provisioning NeonDB test database...')

  try {
    // Use Neon API to create a branch for testing
    // Note: This is a simplified version - full implementation would use Neon API
    const response = await fetch('https://console.neon.tech/api/v1/projects', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${neonApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      logger.warn('Neon API not available, falling back to Docker')
      return null
    }

    // For now, return null to fall back to Docker
    // Full Neon API integration would go here
    logger.warn('Neon API integration not fully implemented, falling back to Docker')
    return null
  } catch (error) {
    logger.warn(`Neon API error: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

/**
 * Main setup function
 */
export async function setupTestDatabase(): Promise<DatabaseSetup> {
  // Check if POSTGRES_URL is already set
  const existingUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL

  if (existingUrl) {
    logger.info(`Using existing database: ${existingUrl.replace(/:[^:@]+@/, ':****@')}`)
    return {
      connectionString: existingUrl,
      type: 'existing',
    }
  }

  // Try Neon first (if API key available)
  const neonSetup = await setupNeonDatabase()
  if (neonSetup) {
    return neonSetup
  }

  // Fall back to Docker
  return setupDockerDatabase()
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestDatabase()
    .then((setup) => {
      logger.success('Test database setup complete!')
      console.log(`\nConnection string: ${setup.connectionString}`)
      console.log(`Type: ${setup.type}`)
      console.log('\nSet this environment variable:')
      console.log(`export POSTGRES_URL="${setup.connectionString}"`)
      process.exit(0)
    })
    .catch((error) => {
      logger.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    })
}
