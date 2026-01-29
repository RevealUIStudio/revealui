#!/usr/bin/env tsx
/**
 * Validation CLI
 *
 * Unified entry point for validation operations.
 *
 * Usage:
 *   pnpm validate:env         # Validate environment variables
 *   pnpm validate:console     # Check for console statements
 *   pnpm validate:packages    # Validate package scripts
 *   pnpm validate:pre-launch  # Run pre-launch validation
 */

import { createLogger } from '../lib/index.js'

const logger = createLogger({ prefix: 'Validate' })

const COMMANDS = {
  env: '../engineer/setup/validate-env.ts',
  console: '../engineer/gates/validation/check-console-statements.ts',
  packages: '../engineer/gates/validation/validate-package-scripts.ts',
  'pre-launch': '../engineer/gates/validation/pre-launch-validation.ts',
}

async function main() {
  const command = process.argv[2]

  if (!command || command === '--help' || command === '-h') {
    showHelp()
    return
  }

  const scriptPath = COMMANDS[command as keyof typeof COMMANDS]

  if (!scriptPath) {
    logger.error(`Unknown command: ${command}`)
    showHelp()
    process.exit(1)
  }

  try {
    const args = process.argv.slice(3)
    process.argv = [process.argv[0], process.argv[1], ...args]

    await import(scriptPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      logger.error(`Command script not found: ${scriptPath}`)
    } else {
      throw error
    }
  }
}

function showHelp() {
  console.log(`
Validation CLI

Usage:
  pnpm validate:<command> [options]

Commands:
  env          Validate environment variables
  console      Check for console statements
  packages     Validate package scripts
  pre-launch   Run pre-launch validation

Options:
  --help, -h   Show this help message

Examples:
  pnpm validate:env
  pnpm validate:console
  pnpm validate:pre-launch
`)
}

main().catch((error) => {
  logger.error(error.message)
  process.exit(1)
})
