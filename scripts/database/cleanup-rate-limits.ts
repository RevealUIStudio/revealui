#!/usr/bin/env tsx

/**
 * Cleanup Rate Limits
 *
 * Removes expired rate limit entries from the database.
 * Should be run periodically (e.g., via cron).
 */

import { getClient } from '@revealui/db/client'
import { rateLimits, lt } from '@revealui/db/core'
import { resolve } from 'path'
import { config } from 'dotenv'

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
}

async function cleanupRateLimits() {
  try {
    const db = getClient()
    const now = new Date()

    logger.info('Cleaning up expired rate limits...')

    const result = await db.delete(rateLimits).where(lt(rateLimits.resetAt, now))

    logger.success(`Cleaned up expired rate limit entries`)
    logger.info(`Deleted ${result.rowCount || 0} entries`)
  } catch (error) {
    logger.error(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupRateLimits()
    .then(() => {
      process.exit(0)
    })
    .catch(() => {
      process.exit(1)
    })
}

export { cleanupRateLimits }
