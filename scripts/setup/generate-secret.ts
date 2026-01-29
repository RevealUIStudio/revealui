#!/usr/bin/env tsx

/**
 * Generate 32-Character Secret
 *
 * Generates a cryptographically secure 32-character secret using randomBytes.
 * Useful for generating REVEALUI_SECRET or other environment variable secrets.
 *
 * Usage:
 *   pnpm generate:secret
 */

import {randomBytes} from 'node:crypto'
import {createLogger} from '../shared/utils.ts'
import { ErrorCode } from '../lib/errors.js'

const logger = createLogger()

/**
 * Generate a 32-character secret
 */
function generateSecret(): string {
  // Generate 16 random bytes = 32 hex characters
  return randomBytes(16).toString('hex')
}

/**
 * Main function
 */
async function main() {
  try {
    logger.header('Secret Generator')

    const secret = generateSecret()

    logger.success('Generated 32-character secret:')
    logger.info(`\n${secret}\n`)
    logger.info('💡 Copy this value to your .env file\n')
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
