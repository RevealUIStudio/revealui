#!/usr/bin/env tsx
/**
 * Vercel MCP Server Launcher
 *
 * Starts the Vercel MCP server for AI-powered Vercel management.
 *
 * Usage:
 *   pnpm mcp:vercel
 */

import {config} from 'dotenv'
import {spawn} from 'node:child_process'
import {createLogger,getProjectRoot} from '../../../packages/core/src/.scripts/utils.ts'

const logger = createLogger()

// Load environment variables
config()

async function startVercelMCP() {
  try {
    await getProjectRoot(import.meta.url)
    const vercelApiKey = process.env.VERCEL_API_KEY ?? process.env.VERCEL_TOKEN

    if (!vercelApiKey) {
      logger.error('VERCEL_API_KEY environment variable is required')
      logger.info('   Get your token from: https://vercel.com/account/tokens')
      process.exit(1)
    }

    logger.header('Starting Vercel MCP Server')
    logger.info(`   API Key: ${vercelApiKey.substring(0, 8)}...`)

    // Spawn the vercel-mcp process using pnpm exec (better module resolution)
    // vercel-mcp expects VERCEL_API_KEY as a command-line argument (not just env var)
    const child = spawn('pnpm', ['exec', 'vercel-mcp', `VERCEL_API_KEY=${vercelApiKey}`], {
      stdio: 'inherit',
      env: {
        ...process.env,
        // biome-ignore lint/style/useNamingConvention: standard env var
        VERCEL_API_KEY: vercelApiKey, // Also set in env as fallback
      },
    })

    child.on('error', (error) => {
      logger.error(`Failed to start Vercel MCP server: ${error.message}`)
      process.exit(1)
    })

    child.on('exit', (code) => {
      process.exit(code ?? 0)
    })

    // Handle termination signals
    process.on('SIGINT', () => {
      logger.info('\n🛑 Stopping Vercel MCP Server...')
      child.kill('SIGINT')
    })

    process.on('SIGTERM', () => {
      logger.info('\n🛑 Stopping Vercel MCP Server...')
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
    await startVercelMCP()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
