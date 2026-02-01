#!/usr/bin/env tsx

/**
 * Setup Test Database
 * Cross-platform replacement for setup-test-db.sh
 * Starts PostgreSQL test database and runs migrations
 */

import {join} from 'node:path'
import {
import { ErrorCode } from '../lib/errors.js'
  commandExists,
  createLogger,
  execCommand,
  fileExists,
  getProjectRoot,
  waitFor,
} from '../lib/index.js'

const logger = createLogger()

async function checkDocker() {
  const hasDocker = await commandExists('docker')
  if (!hasDocker) {
    logger.error('Docker is not installed. Please install Docker to run automated tests.')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  // Check for docker compose (newer) or docker-compose (older)
  const hasDockerCompose = await commandExists('docker-compose')
  const hasDockerComposeV2 = (await commandExists('docker'))
    ? (await execCommand('docker', ['compose', 'version'], { silent: true })).success
    : false

  if (!(hasDockerCompose || hasDockerComposeV2)) {
    logger.error('docker-compose is not available. Please install docker-compose.')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  return hasDockerComposeV2 ? 'docker compose' : 'docker-compose'
}

async function waitForDatabase(composeCmd: string, projectRoot: string) {
  logger.info('Waiting for database to be ready...')
  const _maxRetries = 30

  const isReady = await waitFor(
    async () => {
      const result = await execCommand(
        composeCmd.split(' ')[0],
        [
          ...(composeCmd.includes('compose') ? ['compose'] : []),
          '-f',
          'infrastructure/docker-compose/services/test.yml',
          'exec',
          '-T',
          'postgres-test',
          'pg_isready',
          '-U',
          'test',
        ],
        { cwd: projectRoot, silent: true },
      )
      return result.success
    },
    {
      timeout: 30000,
      interval: 1000,
      message: 'Database failed to start',
    },
  )

  if (!isReady) {
    logger.error('Database failed to start after 30 retries')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  logger.success('Database is ready!')
}

async function applyMigrations(composeCmd: string, projectRoot: string) {
  logger.info('Running migrations...')

  const migrationFile = join(projectRoot, 'packages/db/src/orm/drizzle/0000_misty_pepper_potts.sql')

  if (await fileExists(migrationFile)) {
    logger.info('Applying migration SQL directly...')
    const { readFile } = await import('node:fs/promises')
    const sql = await readFile(migrationFile, 'utf-8')

    const [cmd, ...args] = composeCmd.split(' ')
    const result = await execCommand(
      cmd,
      [
        ...args,
        '-f',
        'infrastructure/docker-compose/services/test.yml',
        'exec',
        '-T',
        'postgres-test',
        'psql',
        '-U',
        'test',
        '-d',
        'test_revealui',
      ],
      {
        cwd: projectRoot,
        stdin: sql,
        silent: true,
      },
    )

    if (result.success) {
      logger.success('Migration applied')
    } else {
      logger.warning(`Migration had issues: ${result.message}`)
      // Continue anyway - might be non-critical errors
    }
  } else {
    logger.warning('Migration SQL file not found, attempting drizzle-kit push...')
    const result = await execCommand('pnpm', ['--filter', '@revealui/db', 'db:push'], {
      cwd: projectRoot,
      env: {
        // biome-ignore lint/style/useNamingConvention: Env var key.
        POSTGRES_URL: 'postgresql://test:test@localhost:5433/test_revealui',
      },
    })

    if (!result.success) {
      logger.warning('Migration failed, but continuing...')
    }
  }
}

async function enablePgVector(composeCmd: string, projectRoot: string) {
  logger.info('Enabling pgvector extension...')
  const [cmd, ...args] = composeCmd.split(' ')
  const result = await execCommand(
    cmd,
    [
      ...args,
      '-f',
      'infrastructure/docker-compose/services/test.yml',
      'exec',
      '-T',
      'postgres-test',
      'psql',
      '-U',
      'test',
      '-d',
      'test_revealui',
      '-c',
      'CREATE EXTENSION IF NOT EXISTS vector;',
    ],
    { cwd: projectRoot, silent: true },
  )

  if (result.success) {
    logger.success('pgvector extension enabled')
  } else {
    logger.warning('Failed to enable pgvector extension')
  }
}

async function runSetup() {
  logger.header('Setting up test database')

  const projectRoot = await getProjectRoot(import.meta.url)
  const composeCmd = await checkDocker()

  logger.info('Starting test database...')
  const [cmd, ...args] = composeCmd.split(' ')
  const startResult = await execCommand(
    cmd,
    [...args, '-f', 'infrastructure/docker-compose/services/test.yml', 'up', '-d'],
    { cwd: projectRoot },
  )

  if (!startResult.success) {
    logger.error('Failed to start test database')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  await waitForDatabase(composeCmd, projectRoot)

  // Set test database URL
  process.env.POSTGRES_URL = 'postgresql://test:test@localhost:5433/test_revealui'

  await applyMigrations(composeCmd, projectRoot)
  await enablePgVector(composeCmd, projectRoot)

  logger.header('Test database setup complete!')
  logger.info(`Database URL: ${process.env.POSTGRES_URL}`)
  logger.info('')
  logger.info(`To stop the database:`)
  logger.info(`  ${composeCmd} -f infrastructure/docker-compose/services/test.yml down`)
  logger.info('')
}

/**
 * Main function
 */
async function main() {
  try {
    await runSetup()
  } catch (error) {
    logger.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
