#!/usr/bin/env tsx
/**
 * Next.js DevTools MCP Server Launcher
 *
 * Starts the Next.js DevTools MCP server for AI-powered Next.js development.
 *
 * Usage:
 *   pnpm mcp:next-devtools
 */

import { spawn } from 'node:child_process'
import { config } from 'dotenv'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

// Load environment variables
config()

async function startNextDevToolsMCP() {
  try {
    await getProjectRoot(import.meta.url)
    logger.header('Starting Next.js DevTools MCP Server')
    logger.info('   This server provides Next.js 16+ development tools for coding agents')
    logger.info('   Features: Runtime diagnostics, upgrade automation, Cache Components setup')

    // Spawn the next-devtools-mcp process using pnpm exec
    // next-devtools-mcp works without additional environment variables
    // It automatically discovers Next.js dev servers and connects to them
    const child = spawn('pnpm', ['exec', 'next-devtools-mcp'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        // Disable telemetry if NEXT_TELEMETRY_DISABLED is set
        NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || '0',
      },
    })

    child.on('error', (error) => {
      logger.error(`Failed to start Next.js DevTools MCP server: ${error.message}`)
      process.exit(1)
    })

    child.on('exit', (code) => {
      process.exit(code ?? 0)
    })

    // Handle termination signals
    process.on('SIGINT', () => {
      logger.info('\n🛑 Stopping Next.js DevTools MCP Server...')
      child.kill('SIGINT')
    })

    process.on('SIGTERM', () => {
      logger.info('\n🛑 Stopping Next.js DevTools MCP Server...')
      child.kill('SIGTERM')
    })
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await startNextDevToolsMCP()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
