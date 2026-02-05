#!/usr/bin/env tsx

/**
 * Stripe MCP Server Launcher
 *
 * Starts the Stripe MCP server for AI-powered payment management.
 *
 * Usage:
 *   pnpm mcp:stripe
 */

import { spawn } from 'node:child_process'
import { createLogger, getProjectRoot } from '@revealui/scripts-lib'
import { ErrorCode } from '@revealui/scripts-lib/errors'
import { config } from 'dotenv'

const logger = createLogger()

// Load environment variables
config()

async function startStripeMCP() {
  try {
    await getProjectRoot(import.meta.url)
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      logger.error('STRIPE_SECRET_KEY environment variable is required')
      logger.info('   Get your key from: https://dashboard.stripe.com/apikeys')
      process.exit(ErrorCode.CONFIG_ERROR)
    }

    logger.header('Starting Stripe MCP Server')
    logger.info(`   Secret Key: ${stripeSecretKey.substring(0, 12)}...`)

    // Spawn the @stripe/mcp process
    const child = spawn(
      'pnpm',
      ['dlx', '@stripe/mcp', '--tools=all', `--api-key=${stripeSecretKey}`],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          // biome-ignore lint/style/useNamingConvention: standard env var
          STRIPE_SECRET_KEY: stripeSecretKey,
        },
      },
    )

    child.on('error', (error) => {
      logger.error(`Failed to start Stripe MCP server: ${error.message}`)
      process.exit(ErrorCode.CONFIG_ERROR)
    })

    child.on('exit', (code) => {
      process.exit(code || 0)
    })

    // Handle termination signals
    process.on('SIGINT', () => {
      logger.info('\n🛑 Stopping Stripe MCP Server...')
      child.kill('SIGINT')
    })

    process.on('SIGTERM', () => {
      logger.info('\n🛑 Stopping Stripe MCP Server...')
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
    await startStripeMCP()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
