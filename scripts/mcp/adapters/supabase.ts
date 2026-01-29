#!/usr/bin/env tsx
/**
 * Supabase MCP Server Launcher
 *
 * Starts the Supabase MCP server for AI-powered database management.
 *
 * Usage:
 *   pnpm mcp:supabase
 */

import {config} from 'dotenv'
import {spawn} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import { createLogger, getProjectRoot } from '../../lib/index.js'

const logger = createLogger()

// Load environment variables
config()

async function startSupabaseMCP() {
  try {
    await getProjectRoot(import.meta.url)
    // Supabase MCP uses local package supabase-mcp
    // Verified: Package expects SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY
    // Source: node_modules/supabase-mcp/dist/esm/config.js and services/supabase.js
    //
    // NEW API KEY SUPPORT (2025):
    // Supabase introduced new API keys: sb_publishable_... (replaces anon) and sb_secret_... (replaces service_role)
    // Legacy keys (anon/service_role JWT) still work but will be deprecated in Nov 2025
    // The @supabase/supabase-js client accepts any key format, so we support both
    // Reference: https://github.com/orgs/supabase/discussions/29260
    const supabaseUrl = process.env.SUPABASE_URL

    // Support both legacy and new API key formats
    // New format: SUPABASE_PUBLISHABLE_KEY (sb_publishable_...) or SUPABASE_ANON_KEY (legacy)
    // New format: SUPABASE_SECRET_KEY (sb_secret_...) or SUPABASE_SERVICE_ROLE_KEY (legacy)
    const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
    const supabaseServiceRoleKey =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl) {
      logger.error('SUPABASE_URL is required')
      logger.info('   Get your credentials from: https://supabase.com/dashboard → Settings → API')
      process.exit(1)
    }

    if (!supabaseAnonKey) {
      logger.error('SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY is required')
      logger.info('   Legacy: SUPABASE_ANON_KEY (anon JWT key)')
      logger.info('   New: SUPABASE_PUBLISHABLE_KEY (sb_publishable_... key)')
      logger.info('   Get from: https://supabase.com/dashboard → Settings → API')
      process.exit(1)
    }

    if (!supabaseServiceRoleKey) {
      logger.error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is required')
      logger.info('   Legacy: SUPABASE_SERVICE_ROLE_KEY (service_role JWT key)')
      logger.info('   New: SUPABASE_SECRET_KEY (sb_secret_... key)')
      logger.info('   Note: Required for MCP server operations (full database access)')
      logger.info('   Get from: https://supabase.com/dashboard → Settings → API')
      process.exit(1)
    }

    // MCP_API_KEY is required by supabase-mcp package for server authentication
    // This is NOT a Supabase key - it's a key you generate yourself to secure the MCP server
    let mcpApiKey = process.env.MCP_API_KEY
    if (!mcpApiKey) {
      // Auto-generate a secure random key if not provided
      mcpApiKey = randomBytes(32).toString('hex')
      logger.warning('⚠️  MCP_API_KEY not set - auto-generated a secure key')
      logger.warning('   Add this to your .env file to persist it:')
      logger.warning(`   MCP_API_KEY=${mcpApiKey}`)
      logger.warning('   (This key secures your MCP server endpoint)')
    }

    logger.header('Starting Supabase MCP Server (Local)')
    logger.info(`   Supabase URL: ${supabaseUrl}`)

    // Detect key format for logging
    const usingNewKeys = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY
    if (usingNewKeys) {
      logger.info('   Using new API key format (sb_publishable_/sb_secret_)')
    } else {
      logger.info('   Using legacy API key format (anon/service_role JWT)')
      logger.warning('   ⚠️  Consider migrating to new keys before Nov 2025')
      logger.info('   See: https://github.com/orgs/supabase/discussions/29260')
    }

    // Spawn the local Supabase MCP server
    // Package validates: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, MCP_API_KEY
    // We map new keys to legacy variable names for package compatibility
    // Service uses SUPABASE_SERVICE_ROLE_KEY for client initialization (full access)
    // The @supabase/supabase-js client accepts any key format (legacy JWT or new format)
    // MCP_API_KEY is used for authenticating requests to the MCP server endpoint
    const child = spawn('pnpm', ['dlx', 'supabase-mcp'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        // biome-ignore lint/style/useNamingConvention: standard env var
        SUPABASE_URL: supabaseUrl,
        // Map to legacy variable names that supabase-mcp expects
        // biome-ignore lint/style/useNamingConvention: standard env var
        SUPABASE_ANON_KEY: supabaseAnonKey,
        // biome-ignore lint/style/useNamingConvention: standard env var
        SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
        // MCP_API_KEY for server authentication (auto-generated if not provided)
        // biome-ignore lint/style/useNamingConvention: standard env var
        MCP_API_KEY: mcpApiKey,
        // Also pass new keys if provided (for future package updates)
        // biome-ignore lint/style/useNamingConvention: standard env var
        SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
        // biome-ignore lint/style/useNamingConvention: standard env var
        SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      },
    })

    child.on('error', (error) => {
      logger.error(`Failed to start Supabase MCP server: ${error.message}`)
      process.exit(1)
    })

    child.on('exit', (code) => {
      process.exit(code ?? 0)
    })

    // Handle termination signals
    process.on('SIGINT', () => {
      logger.info('\n🛑 Stopping Supabase MCP Server...')
      child.kill('SIGINT')
    })

    process.on('SIGTERM', () => {
      logger.info('\n🛑 Stopping Supabase MCP Server...')
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
    await startSupabaseMCP()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
