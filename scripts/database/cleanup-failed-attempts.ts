#!/usr/bin/env tsx

/**
 * Cleanup Failed Attempts
 *
 * Removes expired failed attempt entries from the database.
 * Should be run periodically (e.g., via cron).
 */

import { resolve } from 'node:path'
import { getClient } from '@revealui/db/client'
import { failedAttempts, lt } from '@revealui/db/schema'
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

async function cleanupFailedAttempts() {
  try {
    const db = getClient()
    const now = new Date()

    logger.info('Cleaning up expired failed attempts...')

    // Delete entries where lock has expired
    const lockResult = await db.delete(failedAttempts).where(lt(failedAttempts.lockUntil, now))

    // Delete entries where window has expired (older than 24 hours)
    const windowExpiry = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const windowResult = await db
      .delete(failedAttempts)
      .where(lt(failedAttempts.windowStart, windowExpiry))

    const totalDeleted = (lockResult.rowCount || 0) + (windowResult.rowCount || 0)

    logger.success(`Cleaned up expired failed attempt entries`)
    logger.info(`Deleted ${totalDeleted} entries`)
  } catch (error) {
    logger.error(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupFailedAttempts()
    .then(() => {
      process.exit(0)
    })
    .catch(() => {
      process.exit(1)
    })
}

export { cleanupFailedAttempts }
