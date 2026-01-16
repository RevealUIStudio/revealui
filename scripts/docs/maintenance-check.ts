#!/usr/bin/env tsx

/**
 * Documentation Maintenance Check
 *
 * Runs automated maintenance checks and provides suggestions for documentation improvements.
 *
 * Usage:
 *   pnpm docs:maintenance
 */

import { createLogger, getProjectRoot } from '../shared/utils.js'
import { execCommand } from '../shared/utils.js'

const logger = createLogger()

async function maintenanceCheck(): Promise<void> {
  const projectRoot = await getProjectRoot(import.meta.url)

  logger.header('Documentation Maintenance Check')

  logger.info('Running maintenance checks...\n')

  // Check for stale documentation
  logger.info('1. Checking for stale documentation...')
  const staleResult = await execCommand('pnpm', ['docs:check'], {
    cwd: projectRoot,
    silent: true,
  })

  if (!staleResult.success) {
    logger.warning('  ⚠️  Stale documentation detected. Run `pnpm docs:archive` to clean up.')
  } else {
    logger.success('  ✅ No stale documentation found')
  }

  // Check documentation coverage
  logger.info('\n2. Checking documentation coverage...')
  const coverageResult = await execCommand('pnpm', ['docs:coverage'], {
    cwd: projectRoot,
    silent: true,
  })

  if (coverageResult.success) {
    logger.success('  ✅ Coverage report generated')
  } else {
    logger.warning('  ⚠️  Coverage check had issues')
  }

  // Check for broken links
  logger.info('\n3. Checking for broken links...')
  const linksResult = await execCommand('pnpm', ['docs:verify:links'], {
    cwd: projectRoot,
    silent: true,
  })

  if (linksResult.success) {
    logger.success('  ✅ No broken links found')
  } else {
    logger.warning('  ⚠️  Broken links detected. Run `pnpm docs:verify:links` for details.')
  }

  logger.info('\n\nMaintenance check complete!')
  logger.info('💡 Tip: Run `pnpm docs:validate:all` for comprehensive validation')
}

async function main() {
  try {
    await maintenanceCheck()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
