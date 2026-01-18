#!/usr/bin/env tsx
/**
 * Auto-Start Development Automation
 *
 * Automatically starts MCP servers and provides Ralph workflow suggestions
 * when starting the development environment.
 *
 * Usage:
 *   pnpm dev (with AUTO_START_MCP=true)
 *   Or explicitly: tsx scripts/automation/auto-start-dev.ts
 */

import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { createLogger, getProjectRoot } from '../shared/utils.js'
import { isWorkflowActive } from '../ralph/utils.js'

const logger = createLogger()

// Load environment variables
config()

interface DevOptions {
  autoStartMCP?: boolean
  autoStartRalph?: boolean
  ralphPrompt?: string
}

/**
 * Check if MCP servers should auto-start
 */
function shouldAutoStartMCP(): boolean {
  // Check environment variable first (explicit opt-in)
  if (process.env.AUTO_START_MCP === 'false') {
    return false
  }
  if (process.env.AUTO_START_MCP === 'true') {
    return true
  }

  // Check if .cursor/mcp-config.json exists (indicates MCP setup)
  const projectRoot = process.cwd()
  const mcpConfigPath = join(projectRoot, '.cursor', 'mcp-config.json')
  return existsSync(mcpConfigPath)
}

/**
 * Check for available MCP server configurations
 */
async function getAvailableMCPServers(): Promise<string[]> {
  const available: string[] = []
  const mcpConfigPath = join(process.cwd(), '.cursor', 'mcp-config.json')

  if (!existsSync(mcpConfigPath)) {
    return available
  }

  try {
    const { readFileSync } = await import('node:fs')
    const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'))
    const servers = mcpConfig.mcpServers || {}

    // Check which servers have required env vars
    if (servers.vercel && (process.env.VERCEL_API_KEY || process.env.VERCEL_TOKEN)) {
      available.push('vercel')
    }
    if (servers.stripe && process.env.STRIPE_SECRET_KEY) {
      available.push('stripe')
    }
    if (servers.neon && process.env.NEON_API_KEY) {
      available.push('neon')
    }
    if (
      servers.supabase &&
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY
    ) {
      available.push('supabase')
    }
    // Playwright and next-devtools don't require env vars
    if (servers.playwright) {
      available.push('playwright')
    }
    if (servers['next-devtools']) {
      available.push('next-devtools')
    }
  } catch (error) {
    // Silently fail - MCP config might be malformed
  }

  return available
}

/**
 * Check MCP server configuration
 * Note: We don't actually start MCP servers - Cursor IDE manages them automatically
 */
function checkMCPConfiguration(available: string[]): void {
  if (available.length === 0) {
    logger.info('No MCP servers configured or missing required environment variables')
    logger.info('   Set AUTO_START_MCP=false to disable this message')
    return
  }

  logger.header('MCP Server Configuration Check')
  logger.info(`   Found ${available.length} configured server(s)`)
  logger.info('   MCP servers are managed by Cursor IDE automatically')
  logger.info('   Cursor will start them based on .cursor/mcp-config.json when needed')
  logger.info('')
  logger.info('   Configured servers:')
  for (const server of available) {
    logger.info(`   • ${server}`)
  }
  logger.info('')
  logger.info('   To start manually: pnpm mcp:all')
  logger.info('   Set AUTO_START_MCP=false to disable this check')
  logger.info('')
}

/**
 * Check for Ralph workflow suggestions
 */
async function checkRalphWorkflow(projectRoot: string): Promise<void> {
  const active = await isWorkflowActive(projectRoot)

  if (active) {
    logger.info('📋 Ralph workflow is active')
    logger.info('   Check status: pnpm ralph:status')
    logger.info('   Continue: pnpm ralph:continue')
    logger.info('')
    return
  }

  // Suggest Ralph for complex tasks based on common patterns
  // This is a passive suggestion, not automatic
  if (process.env.AUTO_SUGGEST_RALPH !== 'false') {
    logger.info('💡 Tip: Use Ralph workflow for complex, multi-iteration tasks')
    logger.info('   Start: pnpm ralph:start "<task>" --completion-promise "DONE"')
    logger.info('   Set AUTO_SUGGEST_RALPH=false to disable this message')
    logger.info('')
  }
}

/**
 * Main automation function
 */
async function autoStartDev(options: DevOptions = {}) {
  try {
    const projectRoot = await getProjectRoot(import.meta.url)

    // Check for Ralph workflow
    await checkRalphWorkflow(projectRoot)

    // Check MCP configuration (don't auto-start - Cursor IDE manages them)
    if (options.autoStartMCP !== false && shouldAutoStartMCP()) {
      const available = await getAvailableMCPServers()
      if (available.length > 0) {
        // Just inform about MCP configuration - don't start servers
        // Cursor IDE manages MCP servers automatically via .cursor/mcp-config.json
        checkMCPConfiguration(available)
      }
    }

    return true
  } catch (error) {
    logger.warning(
      `Automation check failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    // Don't fail dev startup if automation fails
    return false
  }
}

/**
 * Wrapper for turbo dev that includes automation
 */
async function runDevWithAutomation() {
  logger.header('Starting Development Environment')

  // Run automation (non-blocking)
  await autoStartDev({
    autoStartMCP: shouldAutoStartMCP(),
  })

  // Start turbo dev (this will block)
  logger.info('Starting development servers...')
  logger.info('')

  const child = spawn('pnpm', ['turbo', 'run', 'dev', '--parallel'], {
    stdio: 'inherit',
    env: process.env,
  })

  // Handle termination
  process.on('SIGINT', () => {
    logger.info('\n🛑 Stopping development servers...')
    child.kill('SIGINT')
  })

  process.on('SIGTERM', () => {
    logger.info('\n🛑 Stopping development servers...')
    child.kill('SIGTERM')
  })

  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

/**
 * Main entry point - runs automation before dev
 */
async function main() {
  // If called as pre-hook (via package.json), just run automation checks
  // Turbo dev will be started separately via &&
  const isPreHook = process.argv.includes('--pre-hook')
  
  if (isPreHook) {
    // Run automation checks (non-blocking, doesn't fail if errors occur)
    await autoStartDev({
      autoStartMCP: shouldAutoStartMCP(),
    })
    // Always exit successfully so && chain continues to turbo dev
    process.exit(0)
  } else {
    // Called directly - run full automation + start turbo dev
    await runDevWithAutomation()
  }
}

// Run if called directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}

export { autoStartDev, shouldAutoStartMCP, getAvailableMCPServers, checkMCPConfiguration }
