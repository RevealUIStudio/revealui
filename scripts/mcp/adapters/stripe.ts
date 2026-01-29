#!/usr/bin/env tsx
/**
 * Stripe MCP Server Launcher
 *
 * Starts the Stripe MCP server for AI-powered payment management.
 *
 * Usage:
 *   pnpm mcp:stripe
 */

import {config} from 'dotenv'
import {spawn} from 'node:child_process'
import { createLogger, getProjectRoot } from '../../lib/index.js'

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
      process.exit(1)
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
      process.exit(1)
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
    process.exit(1)
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
    process.exit(1)
  }
}

main()
