#!/usr/bin/env tsx
/**
 * Clean Install Script
 * Cross-platform replacement for install-clean.sh
 * Suppresses Node.js deprecation warnings during installation
 */

import {createLogger,execCommand} from '../shared/utils.ts'
import { ErrorCode } from '../lib/errors.js'

const logger = createLogger()

async function main() {
  logger.header('Clean Install')
  logger.info('Running clean install with deprecation warnings suppressed...')

  const result = await execCommand('pnpm', ['install'], {
    env: {
      // biome-ignore lint/style/useNamingConvention: standard Node.js env var
      NODE_OPTIONS: '--no-deprecation',
    },
  })

  if (result.success) {
    logger.success('Installation completed successfully')
    process.exit(0)
  } else {
    logger.error('Installation failed')
    logger.error(result.message)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main().catch((error) => {
  logger.error(`Install failed: ${error.message}`)
  process.exit(ErrorCode.EXECUTION_ERROR)
})
