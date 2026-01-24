#!/usr/bin/env tsx

/**
 * Vercel MCP Server - New Implementation
 *
 * Uses the unified MCP adapter pattern for cleaner, more maintainable code.
 *
 * Usage:
 *   pnpm tsx scripts/mcp/mcp-vercel-new.ts
 */

import { createLogger, requireEnv } from '../shared/utils.js'
import { createMCPAdapter, type MCPRequest } from './mcp-adapter.js'

const logger = createLogger()

async function startVercelMCP() {
  try {
    logger.header('Vercel MCP Server')

    // Get configuration from environment
    const apiKey = requireEnv('VERCEL_API_KEY', 'VERCEL_TOKEN')

    // Create adapter with configuration
    const adapter = createMCPAdapter('vercel', {
      apiKey: `Bearer ${apiKey}`,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    })

    logger.info('Vercel MCP server started')
    logger.info('Available actions: deploy, list-deployments, get-deployment, delete-deployment')

    // Example usage - in a real MCP server, this would listen for requests
    const exampleRequest: MCPRequest = {
      action: 'list-deployments',
      options: {
        timeout: 10000,
        retries: 2,
      },
    }

    logger.info('Testing connection...')
    const response = await adapter.execute(exampleRequest)

    if (response.success) {
      logger.success('Vercel MCP connection successful')
      if (response.data && !Array.isArray(response.data) && response.data.deployments) {
        logger.info(`Found ${response.data.deployments.length} deployments`)
      }
    } else {
      logger.error(`Vercel MCP connection failed: ${response.error}`)
    }
  } catch (error) {
    logger.error(`Vercel MCP server failed: ${error}`)
    process.exit(1)
  }
}

startVercelMCP()
