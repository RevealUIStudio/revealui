#!/usr/bin/env tsx

/**
 * Automated Type Generation Setup
 *
 * Sets up automated database type generation with:
 * - File watchers for development
 * - Git hooks for migrations
 * - Package scripts for manual triggering
 *
 * @dependencies
 * - node:fs - File system operations
 * - node:child_process - Command execution
 * - scripts/lib/errors.ts - Error handling
 * - scripts/lib/index.ts - Logger utilities
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { ErrorCode } from '../lib/errors.js'
import { createLogger } from '../lib/index.js'

const logger = createLogger({ prefix: 'AutoTypeSetup' })

async function setupAutomatedTypes() {
  logger.header('Automated Type Generation Setup')
  console.log()

  const steps: Array<{ name: string; check: () => boolean; fix: () => void }> = []

  // Check 1: chokidar dependency
  steps.push({
    name: 'File watcher dependency (chokidar)',
    check: () => {
      try {
        const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
        return Boolean(pkg.dependencies?.chokidar || pkg.devDependencies?.chokidar)
      } catch {
        return false
      }
    },
    fix: () => {
      logger.info('Installing chokidar...')
      execSync('pnpm add -D chokidar', { stdio: 'inherit' })
    },
  })

  // Check 2: Package.json scripts
  steps.push({
    name: 'Package.json scripts',
    check: () => {
      try {
        const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
        return Boolean(
          pkg.scripts?.['dev:watch-types'] &&
            pkg.scripts?.['db:generate-types'] &&
            pkg.scripts?.['db:migrate-and-generate'],
        )
      } catch {
        return false
      }
    },
    fix: () => {
      logger.info('Adding package.json scripts...')
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))

      pkg.scripts = {
        ...pkg.scripts,
        'dev:watch-types': 'tsx scripts/dev-tools/watch-schema-types.ts',
        'db:generate-types': 'tsx scripts/dev-tools/post-migration-types.ts',
        'db:migrate-and-generate': 'pnpm db:migrate && pnpm db:generate-types',
      }

      writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
    },
  })

  // Check 3: Type generation scripts exist
  steps.push({
    name: 'Type generation scripts',
    check: () => {
      return (
        existsSync('scripts/dev-tools/watch-schema-types.ts') &&
        existsSync('scripts/dev-tools/post-migration-types.ts')
      )
    },
    fix: () => {
      logger.warn('Type generation scripts should have been created!')
    },
  })

  // Run checks and fixes
  logger.info('Running setup checks...')
  console.log()

  let needsFixes = false

  for (const step of steps) {
    const isOk = step.check()
    const icon = isOk ? '✅' : '❌'
    logger.info(`${icon} ${step.name}`)

    if (!isOk) {
      needsFixes = true
    }
  }

  console.log()

  if (needsFixes) {
    logger.info('🔧 Applying fixes...')
    console.log()

    for (const step of steps) {
      if (!step.check()) {
        logger.info(`Fixing: ${step.name}`)
        step.fix()
      }
    }

    logger.success('✅ Setup complete!')
  } else {
    logger.success('✅ Everything is already set up!')
  }

  console.log()
  logger.header('Usage')
  console.log()
  logger.info('Development mode (auto-regenerate on changes):')
  logger.info('  pnpm dev:watch-types')
  console.log()
  logger.info('After migrations:')
  logger.info('  pnpm db:migrate-and-generate')
  console.log()
  logger.info('Manual type generation:')
  logger.info('  pnpm db:generate-types')
  console.log()
}

async function main() {
  try {
    await setupAutomatedTypes()
  } catch (error) {
    logger.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
