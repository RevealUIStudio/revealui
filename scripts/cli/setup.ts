#!/usr/bin/env tsx
/**
 * Setup CLI
 *
 * Unified entry point for setup operations.
 *
 * Usage:
 *   pnpm setup:env     # Set up environment variables
 *   pnpm setup:node    # Set up Node.js version
 *   pnpm setup:mcp     # Set up MCP servers
 */

import { createLogger } from '../lib/index.js'

const logger = createLogger({ prefix: 'Setup' })

const COMMANDS = {
  env: '../engineer/setup/setup-env.ts',
  node: '../engineer/setup/setup-node-version.ts',
  mcp: '../engineer/setup/setup-mcp.ts',
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
Setup CLI

Usage:
  pnpm setup:<command> [options]

Commands:
  env     Set up environment variables
  node    Set up Node.js version
  mcp     Set up MCP servers

Options:
  --help, -h   Show this help message

Examples:
  pnpm setup:env
  pnpm setup:env --force
  pnpm setup:node
`)
}

main().catch((error) => {
  logger.error(error.message)
  process.exit(1)
})
