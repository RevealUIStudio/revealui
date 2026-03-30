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
import { createLogger, getProjectRoot } from '@revealui/scripts';
import { ErrorCode } from '@revealui/scripts/errors';
import { config } from 'dotenv';
import { checkMcpLicense } from '../index.js';

const logger = createLogger();

// Load environment variables
config();

async function startPlaywrightMCP() {
  try {
    await getProjectRoot(import.meta.url);
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
      process.exit(ErrorCode.CONFIG_ERROR);
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
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    if (!(await checkMcpLicense())) {
      process.exit(ErrorCode.CONFIG_ERROR);
    }
    await startPlaywrightMCP();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
