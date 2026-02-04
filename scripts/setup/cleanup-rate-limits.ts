#!/usr/bin/env tsx

/**
 * Cleanup Rate Limits
 *
 * Removes expired rate limit entries from the database.
 * Should be run periodically (e.g., via cron).
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - @revealui/db/client - Database client
 * - @revealui/db/schema - Database schema and operators (rateLimits, lt)
 * - node:path - Path manipulation utilities
 * - dotenv - Environment variable loading
 */

import { resolve } from 'node:path'
import { getClient } from '@revealui/db/client'
import { lt, rateLimits } from '@revealui/db/schema'
import { config } from 'dotenv'
import { ErrorCode } from '../lib/errors.js'

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
      process.exit(ErrorCode.SUCCESS)
    })
    .catch(() => {
      process.exit(ErrorCode.CONFIG_ERROR)
    })
}

export { cleanupRateLimits }
