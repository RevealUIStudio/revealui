#!/usr/bin/env tsx

/**
 * Unified development command for RevealUI monorepo
 *
 * Starts all packages in watch mode and all apps in dev mode.
 * Handles graceful shutdown and error propagation.
 *
 * Usage:
 *   pnpm dev
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import concurrently from 'concurrently'
import { createLogger, getProjectRoot } from '../../utils/base.ts'
import { ErrorCode } from '../../lib/errors.js'

const logger = createLogger()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

async function runDev() {
  try {
    await getProjectRoot(import.meta.url)
    const commands = [
      {
        name: 'packages',
        command: 'pnpm -r --filter "./packages/*" --parallel dev',
        prefixColor: 'blue',
        cwd: rootDir,
      },
      {
        name: 'apps',
        command: 'turbo run dev --parallel',
        prefixColor: 'green',
        cwd: rootDir,
      },
    ]

    logger.header('Starting RevealUI Development Environment')

    await concurrently(commands, {
      killOthers: ['failure', 'success'],
      restartTries: 3,
      restartDelay: 1000,
      prefix: '[{name}]',
      timestampFormat: 'HH:mm:ss',
    })
  } catch (error) {
    logger.error('Development environment failed to start')
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runDev()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
