#!/usr/bin/env tsx

/**
 * Playwright MCP Server Launcher
 *
 * Starts the Playwright MCP server for AI-powered browser automation.
 *
 * Usage:
 *   pnpm mcp:playwright
 */

import { spawn } from 'node:child_process';
import { config } from 'dotenv';
import { checkMcpLicense } from '../index.js';
import { createLauncherLogger, ExitCode } from './_launcher-utils.js';

const logger = createLauncherLogger();

// Load environment variables
config();

async function startPlaywrightMCP() {
  try {
    logger.header('Starting Playwright MCP Server');

    // Spawn the Playwright MCP server
    // Using @executeautomation/playwright-mcp-server which is the most popular option
    const child = spawn('pnpm', ['dlx', '@executeautomation/playwright-mcp-server'], {
      stdio: 'inherit',
      env: {
        ...process.env,
      },
    });

    child.on('error', (error) => {
      logger.error(`Failed to start Playwright MCP server: ${error.message}`);
      process.exit(ExitCode.CONFIG_ERROR);
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });

    // Handle termination signals
    process.on('SIGINT', () => {
      logger.info('\n🛑 Stopping Playwright MCP Server...');
      child.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      logger.info('\n🛑 Stopping Playwright MCP Server...');
      child.kill('SIGTERM');
    });
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ExitCode.EXECUTION_ERROR);
  }
}

/**
 * Launch the Playwright MCP server.
 * Exported for programmatic use by the Hypervisor.
 */
export async function launchPlaywrightMcp(): Promise<void> {
  if (!(await checkMcpLicense())) {
    throw new Error('MCP license check failed');
  }
  await startPlaywrightMCP();
}

/**
 * Main function (CLI entrypoint)
 */
async function main() {
  try {
    await launchPlaywrightMcp();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ExitCode.EXECUTION_ERROR);
  }
}

main();
