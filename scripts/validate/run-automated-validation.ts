#!/usr/bin/env tsx

/**
 * Run Automated Validation
 * Cross-platform replacement for run-automated-validation.sh
 * Automates all validation steps using test database and test server
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/index.ts - Shared utilities (commandExists, createLogger, execCommand, getProjectRoot, waitFor)
 * - node:path - Path manipulation utilities (join)
 *
 * @requires
 * - External: docker - Container runtime for test database
 * - External: psql - PostgreSQL client (optional, for verification)
 */

import { join } from 'node:path'
import { ErrorCode } from '../lib/errors.js'
import { commandExists, createLogger, execCommand, getProjectRoot, waitFor } from '../lib/index.js'

const logger = createLogger()

async function checkDocker() {
  const hasDocker = await commandExists('docker')
  if (!hasDocker) {
    logger.error('Docker is not installed. Please install Docker to run automated tests.')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

async function setupTestDatabase(projectRoot: string) {
  logger.header('Step 1: Setting up test database')
  const result = await execCommand('pnpm', ['tsx', 'scripts/dev-tools/test-database.ts'], {
    cwd: projectRoot,
  })

  if (!result.success) {
    logger.error('Failed to setup test database')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

async function verifyMigration(_projectRoot: string) {
  logger.header('Step 2: Verifying migration')
  const hasPsql = await commandExists('psql')
  const dbUrl = 'postgresql://test:test@localhost:5433/test_revealui'

  if (hasPsql) {
    const result = await execCommand(
      'psql',
      [dbUrl, '-c', 'SELECT COUNT(*) FROM node_id_mappings;'],
      { silent: true },
    )

    if (result.success) {
      logger.success('Migration verified')
    } else {
      logger.warning('Migration verification failed')
    }
  } else {
    logger.warning('psql not available, skipping verification')
  }
}

async function runIntegrationTests(projectRoot: string) {
  logger.header('Step 3: Running integration tests')
  const result = await execCommand(
    'pnpm',
    ['--filter', '@revealui/ai', 'test', '__tests__/integration/'],
    {
      cwd: projectRoot,
      env: {
        // biome-ignore lint/style/useNamingConvention: env var keys are uppercase by convention.
        POSTGRES_URL: 'postgresql://test:test@localhost:5433/test_revealui',
        // biome-ignore lint/style/useNamingConvention: env var keys are uppercase by convention.
        NODE_ENV: 'test',
      },
    },
  )

  if (!result.success) {
    logger.warning('Integration tests failed or not found')
  } else {
    logger.success('Integration tests passed')
  }
}

async function runPerformanceTests(projectRoot: string) {
  logger.header('Step 4: Running performance tests')
  const perfScript = join(projectRoot, 'scripts/analysis/measure-performance.ts')
  const { fileExists } = await import('../../../lib/index.js')

  if (await fileExists(perfScript)) {
    const result = await execCommand('pnpm', ['tsx', perfScript], {
      cwd: projectRoot,
      env: {
        // biome-ignore lint/style/useNamingConvention: env var keys are uppercase by convention.
        POSTGRES_URL: 'postgresql://test:test@localhost:5433/test_revealui',
      },
    })

    if (!result.success) {
      logger.warning('Performance tests failed')
    }
  } else {
    logger.warning('Performance test script not found, skipping')
  }
}

async function startTestServer(projectRoot: string): Promise<number | null> {
  logger.header('Step 5: Starting test server')
  const { spawn } = await import('node:child_process')

  return new Promise((resolve) => {
    const server = spawn('pnpm', ['--filter', 'cms', 'dev'], {
      cwd: projectRoot,
      stdio: 'pipe',
      env: {
        ...process.env,
        // biome-ignore lint/style/useNamingConvention: env var keys are uppercase by convention.
        POSTGRES_URL: 'postgresql://test:test@localhost:5433/test_revealui',
      },
    })

    // Wait for server to be ready
    waitFor(
      async () => {
        try {
          // Use built-in fetch (Node 18+) or node-fetch
          let fetchFn: typeof fetch
          try {
            fetchFn = globalThis.fetch
          } catch {
            const { default: fetch } = await import('node-fetch')
            fetchFn = fetch as unknown as typeof fetch
          }
          const response = await fetchFn('http://localhost:3000/api/health')
          return response.ok
        } catch {
          return false
        }
      },
      {
        timeout: 30000,
        interval: 1000,
        message: 'Server failed to start',
      },
    )
      .then((ready) => {
        if (ready) {
          logger.success('Server is ready!')
          resolve(server.pid || null)
        } else {
          logger.error('Server failed to start')
          server.kill()
          resolve(null)
        }
      })
      .catch(() => {
        server.kill()
        resolve(null)
      })
  })
}

async function testApiRoutes(projectRoot: string) {
  logger.header('Step 6: Testing API routes')
  const apiTestScript = join(projectRoot, 'scripts/legacy/test-api-routes.sh')
  const { fileExists } = await import('../../../lib/index.js')

  if (await fileExists(apiTestScript)) {
    // For now, run the shell script - could be converted later
    const result = await execCommand('bash', [apiTestScript], {
      cwd: projectRoot,
    })
    if (!result.success) {
      logger.warning('API test script failed')
    }
  } else {
    logger.warning('API test script not found, skipping')
  }
}

async function cleanup(serverPid: number | null) {
  logger.header('Step 7: Cleaning up')
  if (serverPid) {
    try {
      process.kill(serverPid)
      logger.success('Test server stopped')
    } catch {
      // Process might already be dead
    }
  }
}

async function main() {
  logger.header('Automated CRDT Validation')

  const projectRoot = await getProjectRoot(import.meta.url)

  await checkDocker()
  await setupTestDatabase(projectRoot)
  await verifyMigration(projectRoot)
  await runIntegrationTests(projectRoot)
  await runPerformanceTests(projectRoot)

  const serverPid = await startTestServer(projectRoot)
  if (serverPid) {
    await testApiRoutes(projectRoot)
    await cleanup(serverPid)
  } else {
    logger.warning('Skipping API tests due to server startup failure')
  }

  logger.header('Automated validation complete!')
  logger.info('Note: Test database is still running. To stop it:')
  logger.info('  docker compose -f infrastructure/docker-compose/services/test.yml down')
}

/**
 * Main function wrapper with error handling
 */
async function mainWrapper() {
  try {
    await main()
  } catch (error) {
    logger.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

mainWrapper()
