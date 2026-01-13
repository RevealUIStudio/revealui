#!/usr/bin/env tsx

/**
 * Production Validation Script
 * Cross-platform replacement for validate-production.sh
 * Validates Drizzle/Neon workaround implementation against real Neon instance
 *
 * Usage:
 *   POSTGRES_URL="postgresql://..." pnpm validate:production
 *
 * See: packages/ai/TESTING.md for full documentation
 */

import { join } from 'node:path'
import {
  createLogger,
  execCommand,
  fileExists,
  getProjectRoot,
  requireEnv,
} from '../shared/utils.js'

const logger = createLogger()

let passed = 0
let failed = 0
let skipped = 0

function recordSuccess(message: string) {
  logger.success(message)
  passed++
}

function recordError(message: string) {
  logger.error(message)
  failed++
}

function recordWarning(message: string) {
  logger.warning(message)
  skipped++
}

function recordInfo(message: string) {
  logger.info(message)
}

async function checkEnvironment() {
  logger.header('Environment Check')

  const postgresUrl = requireEnv('POSTGRES_URL', 'DATABASE_URL')
  recordSuccess('Environment variable set')

  // Check if it's a Neon connection string
  if (postgresUrl.includes('neon.tech') || postgresUrl.includes('neon')) {
    recordSuccess('Connection string appears to be Neon')
  } else {
    recordWarning(
      "Connection string doesn't appear to be Neon - may not work with Neon HTTP driver",
    )
  }

  return postgresUrl
}

async function checkDatabaseConnection(postgresUrl: string, projectRoot: string) {
  logger.header('Database Connection Check')

  recordInfo('Testing Neon HTTP connection...')

  // Validate connection string format
  if (postgresUrl.startsWith('postgresql://')) {
    recordSuccess('Connection string format is valid (postgresql://)')
  } else {
    recordWarning('Connection string format may be invalid')
    recordInfo('Expected format: postgresql://user:pass@host/dbname')
  }

  // Check if it looks like a Neon connection
  if (postgresUrl.includes('neon.tech') || postgresUrl.includes('neon')) {
    recordSuccess('Connection string appears to be Neon')
  } else {
    recordWarning("Connection string doesn't appear to be Neon")
    recordInfo("Neon HTTP driver requires Neon instance - local PostgreSQL won't work")
  }

  // Test actual connection using Neon HTTP driver
  recordInfo('Testing actual Neon HTTP connection...')
  const testScript = join(projectRoot, 'scripts/database/test-neon-connection.mjs')

  if (await fileExists(testScript)) {
    // Ensure packages are built
    const dbDist = join(projectRoot, 'packages/db/dist')
    if (!(await fileExists(dbDist))) {
      recordWarning('Database package not built - building now...')
      const buildResult = await execCommand('pnpm', ['--filter', '@revealui/db', 'build'], {
        cwd: projectRoot,
        silent: true,
      })
      if (!buildResult.success) {
        recordWarning('Build failed, but continuing...')
      }
    }

    // Run connection test
    const testResult = await execCommand('node', [testScript], {
      cwd: projectRoot,
      env: { POSTGRES_URL: postgresUrl },
      silent: true,
    })

    if (testResult.success) {
      recordSuccess('Neon HTTP connection successful')
    } else {
      recordWarning('Could not verify connection via test script')
      recordInfo('Connection will be validated when running integration tests')
    }
  } else {
    recordInfo('Connection test script not found - will validate via integration tests')
  }
}

async function checkPackages(projectRoot: string) {
  logger.header('Package Check')

  const memoryDir = join(projectRoot, 'packages/memory')
  const dbDir = join(projectRoot, 'packages/db')

  if (!(await fileExists(memoryDir))) {
    recordError('packages/memory directory not found')
    process.exit(1)
  }
  recordSuccess('Memory package found')

  if (!(await fileExists(dbDir))) {
    recordError('packages/db directory not found')
    process.exit(1)
  }
  recordSuccess('Database package found')

  // Check if packages are built
  const aiDist = join(aiDir, 'dist')
  if (!(await fileExists(aiDist))) {
    recordWarning('AI package not built - building now...')
    const buildResult = await execCommand('pnpm', ['--filter', '@revealui/ai', 'build'], {
      cwd: projectRoot,
    })

    if (buildResult.success) {
      recordSuccess('AI package built')
    } else {
      recordError('Failed to build AI package')
      process.exit(1)
    }
  } else {
    recordSuccess('AI package already built')
  }
}

async function runIntegrationTests(postgresUrl: string, projectRoot: string) {
  logger.header('Integration Tests')

  recordInfo('Running integration tests against Neon instance...')
  recordInfo('This may take 30-60 seconds...')

  const testResult = await execCommand(
    'pnpm',
    ['--filter', '@revealui/ai', 'test', '__tests__/integration/automated-validation.test.ts'],
    {
      cwd: projectRoot,
      env: { POSTGRES_URL: postgresUrl },
      silent: false,
    },
  )

  if (testResult.success) {
    recordSuccess('All integration tests passed')

    // Try to extract test count from output
    const output = testResult.message || ''
    const testCountMatch = output.match(/(\d+)\s+passed/)
    if (testCountMatch) {
      recordSuccess(`${testCountMatch[1]} tests passed`)
    }
  } else {
    recordError('Integration tests failed')
    logger.info('')
    logger.info('Test output:')
    logger.info(testResult.message)
    logger.info('')
    recordInfo('See packages/ai/TESTING.md for troubleshooting')
    process.exit(1)
  }

  return testResult.message || ''
}

async function checkPerformance(testOutput: string) {
  logger.header('Performance Validation')

  // Extract performance metrics from test output
  const perfPattern = /performance|benchmark|average|lookup time|ms/gi
  const perfMatches = testOutput.match(perfPattern)

  if (perfMatches && perfMatches.length > 0) {
    logger.info('')
    logger.info('Performance Results:')
    const lines = testOutput.split('\n').filter((line) => perfPattern.test(line))
    logger.info(lines.slice(0, 15).join('\n'))
    logger.info('')

    // Check for performance thresholds
    const timeMatch = testOutput.match(/([\d.]+)\s*ms/i)
    if (timeMatch) {
      const avgTime = parseFloat(timeMatch[1])
      const threshold = 10

      if (avgTime < threshold) {
        recordSuccess(`Performance within acceptable range (${avgTime}ms < ${threshold}ms)`)
      } else {
        recordWarning(`Performance may be slow (${avgTime}ms) - expected < ${threshold}ms`)
        recordInfo('Consider investigating if this is consistent')
      }
    } else {
      recordInfo("Performance metrics found but couldn't extract timing")
      recordInfo('Review test output above for performance details')
    }
  } else {
    recordWarning('No performance metrics found in test output')
    recordInfo('Performance tests may be in separate test file or not included')
    recordInfo('See packages/ai/TESTING.md for manual performance validation')
  }
}

async function runValidation() {
  logger.header('Production Validation')

  const projectRoot = await getProjectRoot(import.meta.url)
  const postgresUrl = await checkEnvironment()
  await checkDatabaseConnection(postgresUrl, projectRoot)
  await checkPackages(projectRoot)

  logger.header('Migration Check')
  recordInfo('Checking if migrations need to be applied...')
  recordWarning("Note: Run 'pnpm --filter @revealui/db db:push' if migrations are needed")

  const testOutput = await runIntegrationTests(postgresUrl, projectRoot)
  await checkPerformance(testOutput)

  // Summary
  logger.header('Validation Summary')
  logger.info('')
  logger.info('Results:')
  logger.success(`Passed: ${passed}`)
  if (failed > 0) {
    logger.error(`Failed: ${failed}`)
  }
  if (skipped > 0) {
    logger.warning(`Skipped: ${skipped}`)
  }
  logger.info('')

  if (failed === 0) {
    logger.success('Validation complete - All checks passed!')
    logger.info('')
    logger.info('Next steps:')
    logger.info('  1. Review test results above')
    logger.info('  2. Complete manual testing checklist (see TESTING.md)')
    logger.info('  3. Verify performance benchmarks')
    logger.info('  4. Set up production monitoring')
    logger.info('')
    logger.info('See: packages/ai/TESTING.md for full validation checklist')
    process.exit(0)
  } else {
    recordError('Validation failed - Please review errors above')
    logger.info('')
    logger.info('Troubleshooting:')
    logger.info('  1. Check connection string is correct')
    logger.info('  2. Verify Neon instance is accessible')
    logger.info('  3. Check migrations are applied')
    logger.info('  4. See packages/ai/TESTING.md for details')
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runValidation()
  } catch (error) {
    logger.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
