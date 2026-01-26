#!/usr/bin/env tsx

/**
 * Real Performance Measurement
 * Measures actual node ID lookup performance against real database
 *
 * Usage:
 *   export POSTGRES_URL="postgresql://user:pass@host:port/db"
 *   pnpm test:performance
 *
 * Note: This script uses relative imports to work around tsx workspace resolution.
 * Packages must be built first (handled by npm script).
 */

import { NodeIdService } from '../../packages/ai/dist/memory/services/node-id-service.js'
// Use relative imports to work around tsx workspace resolution limitations
// Packages must be built first: pnpm --filter @revealui/db build && pnpm --filter @revealui/ai build
import { createClient } from '../../packages/db/dist/client/index.js'
import { createLogger, getProjectRoot } from '../typed/shared/utils.ts'

const logger = createLogger()

const ITERATIONS = 100
const CONCURRENT = 10

async function measurePerformance() {
  try {
    await getProjectRoot(import.meta.url)
    logger.header('Real Performance Measurement')

    // Get database connection
    const PostgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL
    if (!PostgresUrl) {
      logger.error('POSTGRES_URL or DATABASE_URL must be set')
      logger.error('')
      logger.error('Usage:')
      logger.error('  export POSTGRES_URL="postgresql://user:pass@host:port/db"')
      logger.error('  pnpm exec tsx scripts/analysis/measure-performance.ts')
      process.exit(1)
    }

    logger.info('Connecting to database...')
    const db = createClient({ connectionString: PostgresUrl })
    const service = new NodeIdService(db)

    logger.info('Warming up...')
    await service.getNodeId('session', 'warmup-1')

    // Test 1: Sequential lookups (existing)
    logger.info(`\nTest 1: Sequential lookups (${ITERATIONS} iterations)`)
    const start1 = performance.now()

    for (let i = 0; i < ITERATIONS; i++) {
      await service.getNodeId('session', `session-${i}`)
    }

    const duration1 = performance.now() - start1
    const avg1 = duration1 / ITERATIONS

    logger.info(`  Total: ${duration1.toFixed(2)}ms`)
    logger.info(`  Average: ${avg1.toFixed(2)}ms per lookup`)
    const status1 = avg1 < 10 ? '✅ PASS' : '❌ FAIL'
    logger.info(`  Status: ${status1} (< 10ms required)`)

    // Test 2: Concurrent lookups
    logger.info(`\nTest 2: Concurrent lookups (${CONCURRENT} concurrent, ${ITERATIONS} total)`)
    const start2 = performance.now()

    const promises: Promise<unknown>[] = []
    for (let i = 0; i < ITERATIONS; i++) {
      promises.push(service.getNodeId('session', `session-concurrent-${i}`))
      if (promises.length >= CONCURRENT) {
        await Promise.all(promises)
        promises.length = 0
      }
    }
    await Promise.all(promises)

    const duration2 = performance.now() - start2
    const avg2 = duration2 / ITERATIONS

    logger.info(`  Total: ${duration2.toFixed(2)}ms`)
    logger.info(`  Average: ${avg2.toFixed(2)}ms per lookup`)
    const status2 = avg2 < 10 ? '✅ PASS' : '❌ FAIL'
    logger.info(`  Status: ${status2} (< 10ms required)`)

    // Test 3: Repeated lookups (same entity)
    logger.info(`\nTest 3: Repeated lookups (same entity, ${ITERATIONS} iterations)`)
    const entityId = 'session-repeated'
    const start3 = performance.now()

    for (let i = 0; i < ITERATIONS; i++) {
      await service.getNodeId('session', entityId)
    }

    const duration3 = performance.now() - start3
    const avg3 = duration3 / ITERATIONS

    logger.info(`  Total: ${duration3.toFixed(2)}ms`)
    logger.info(`  Average: ${avg3.toFixed(2)}ms per lookup`)
    const status3 = avg3 < 5 ? '✅ PASS' : '⚠️  SLOW'
    logger.info(`  Status: ${status3} (< 5ms expected for cached)`)

    // Summary
    logger.header('Summary')
    logger.info(`Sequential (new): ${avg1.toFixed(2)}ms avg`)
    logger.info(`Concurrent: ${avg2.toFixed(2)}ms avg`)
    logger.info(`Repeated (cached): ${avg3.toFixed(2)}ms avg`)
    logger.info('')

    if (avg1 < 10 && avg2 < 10 && avg3 < 5) {
      logger.success('All performance targets met!')
      process.exit(0)
    } else {
      logger.error('Some performance targets not met')
      process.exit(1)
    }
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await measurePerformance()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
