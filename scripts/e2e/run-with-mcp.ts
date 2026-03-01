#!/usr/bin/env tsx

/**
 * Run E2E Tests with MCP Servers
 *
 * Starts all necessary MCP servers before running E2E tests,
 * then cleans up afterwards.
 *
 * Usage:
 *   pnpm tsx scripts/e2e/run-with-mcp.ts
 *   pnpm tsx scripts/e2e/run-with-mcp.ts --headed
 *   pnpm tsx scripts/e2e/run-with-mcp.ts --ui
 *   pnpm tsx scripts/e2e/run-with-mcp.ts --debug
 *
 * @dependencies
 * - node:child_process - Process spawning for MCP servers
 * - @revealui/scripts-lib - Logger utilities
 *
 * @requires
 * - Scripts: pnpm playwright test
 */

import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { createLogger } from '@revealui/scripts-lib'

const logger = createLogger()

interface ServerProcess {
  name: string
  process: ChildProcess
  port?: number
}

const servers: ServerProcess[] = []

/**
 * Start an MCP server
 */
async function startMcpServer(
  name: string,
  command: string,
  args: string[],
  port?: number,
): Promise<ServerProcess> {
  logger.info(`Starting ${name}...`)

  const childProcess = spawn(command, args, {
    stdio: 'pipe',
    env: {
      ...process.env,
    },
  })

  childProcess.stdout?.on('data', (data) => {
    logger.debug(`[${name}] ${data.toString().trim()}`)
  })

  childProcess.stderr?.on('data', (data) => {
    logger.debug(`[${name}] ${data.toString().trim()}`)
  })

  childProcess.on('error', (error) => {
    logger.error(`[${name}] Error: ${error.message}`)
  })

  // Wait a bit for server to start
  await new Promise((resolve) => setTimeout(resolve, 2000))

  const serverProcess: ServerProcess = { name, process: childProcess, port }
  servers.push(serverProcess)

  logger.success(`${name} started${port ? ` on port ${port}` : ''}`)

  return serverProcess
}

/**
 * Stop all MCP servers
 */
async function stopAllServers(): Promise<void> {
  logger.info('Stopping all MCP servers...')

  for (const server of servers) {
    try {
      server.process.kill('SIGTERM')
      logger.info(`Stopped ${server.name}`)
    } catch (error) {
      logger.error(
        `Error stopping ${server.name}: ${error instanceof Error ? error.message : 'Unknown'}`,
      )
    }
  }

  servers.length = 0
}

/**
 * Run Playwright tests
 */
async function runTests(args: string[]): Promise<number> {
  logger.header('Running E2E Tests')

  return new Promise((resolve) => {
    const testProcess = spawn('pnpm', ['playwright', 'test', ...args], {
      stdio: 'inherit',
      env: {
        ...process.env,
        // Enable MCP integration
        MCP_ENABLED: 'true',
      },
    })

    testProcess.on('exit', (code) => {
      resolve(code || 0)
    })

    testProcess.on('error', (error) => {
      logger.error(`Test execution error: ${error.message}`)
      resolve(1)
    })
  })
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  logger.header('E2E Tests with MCP Servers')
  logger.info('This script will:')
  logger.info('  1. Start all necessary MCP servers')
  logger.info('  2. Run Playwright E2E tests')
  logger.info('  3. Clean up and stop servers')
  logger.info('')

  try {
    // Start MCP servers
    logger.header('Starting MCP Servers')

    // Only start servers if credentials are available
    if (process.env.NEON_API_KEY) {
      await startMcpServer('Neon Database', 'pnpm', ['mcp:neon'])
    } else {
      logger.warn('Skipping Neon MCP (no NEON_API_KEY)')
    }

    if (process.env.STRIPE_SECRET_KEY) {
      await startMcpServer('Stripe', 'pnpm', ['mcp:stripe'])
    } else {
      logger.warn('Skipping Stripe MCP (no STRIPE_SECRET_KEY)')
    }

    // Playwright MCP doesn't need credentials
    await startMcpServer('Playwright', 'pnpm', ['mcp:playwright'])

    logger.info('')
    logger.success('All MCP servers started!')
    logger.info('')

    // Run tests
    const exitCode = await runTests(args)

    logger.info('')

    if (exitCode === 0) {
      logger.success('✅ All tests passed!')
    } else {
      logger.error(`❌ Tests failed with exit code ${exitCode}`)
    }

    // Clean up
    await stopAllServers()

    process.exit(exitCode)
  } catch (error) {
    logger.error(`Fatal error: ${error instanceof Error ? error.message : 'Unknown'}`)

    // Ensure cleanup happens
    await stopAllServers()

    process.exit(1)
  }
}

// Handle termination signals
process.on('SIGINT', async () => {
  logger.info('\n🛑 Received SIGINT, cleaning up...')
  await stopAllServers()
  process.exit(130)
})

process.on('SIGTERM', async () => {
  logger.info('\n🛑 Received SIGTERM, cleaning up...')
  await stopAllServers()
  process.exit(143)
})

main()
