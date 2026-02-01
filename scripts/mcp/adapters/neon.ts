#!/usr/bin/env tsx
/**
 * Neon MCP Server Launcher
 *
 * Starts the Neon Database MCP server for AI-powered database management.
 *
 * Usage:
 *   pnpm mcp:neon
 */

import { config } from 'dotenv'
import { spawn } from 'node:child_process'
import { createLogger, getProjectRoot } from '../../lib/index.js'
import { ErrorCode } from '../../lib/errors.js'

const logger = createLogger()

// Load environment variables
config()

async function startNeonMCP() {
  try {
    await getProjectRoot(import.meta.url)
    // Neon MCP uses local package @neondatabase/mcp-server-neon
    const neonApiKey = process.env.NEON_API_KEY

    if (!neonApiKey) {
      logger.error('NEON_API_KEY environment variable is required')
      logger.info('   Get your API key from: https://console.neon.tech/app/settings/api-keys')
      process.exit(ErrorCode.CONFIG_ERROR)
    }

    logger.header('Starting NeonDB MCP Server (Local)')
    logger.info(`   API Key: ${neonApiKey.substring(0, 12)}...`)

    // Spawn the local Neon MCP server using locally installed package
    // Using pnpm exec with binary name instead of dlx so pnpm overrides apply to dependencies
    const child = spawn('pnpm', ['exec', 'mcp-server-neon', 'start', neonApiKey], {
      stdio: 'inherit',
      env: {
        ...process.env,
        // biome-ignore lint/style/useNamingConvention: standard env var
        NEON_API_KEY: neonApiKey,
      },
    })

    child.on('error', (error) => {
      logger.error(`Failed to start NeonDB MCP server: ${error.message}`)
      process.exit(ErrorCode.CONFIG_ERROR)
    })

    child.on('exit', (code) => {
      process.exit(code ?? 0)
    })

    // Handle termination signals
    process.on('SIGINT', () => {
      logger.info('\n🛑 Stopping NeonDB MCP Server...')
      child.kill('SIGINT')
    })

    process.on('SIGTERM', () => {
      logger.info('\n🛑 Stopping NeonDB MCP Server...')
      child.kill('SIGTERM')
    })
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await startNeonMCP()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
