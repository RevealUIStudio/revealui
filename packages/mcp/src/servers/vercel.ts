#!/usr/bin/env tsx

/**
 * Vercel MCP Server Launcher
 *
 * Starts the Vercel MCP server for AI-powered Vercel management.
 *
 * Usage:
 *   pnpm mcp:vercel
 */

import { spawn } from 'node:child_process';
import { createLogger, getProjectRoot } from '@revealui/scripts';
import { ErrorCode } from '@revealui/scripts/errors';
import { config } from 'dotenv';
import { checkMcpLicense } from '../index.js';

const logger = createLogger();

// Load environment variables
config();

const MAX_RESTARTS = 3;
const RESTART_DELAYS_MS = [2000, 4000, 8000];

async function spawnVercel(vercelApiKey: string): Promise<number | null> {
  return new Promise((resolve) => {
    // Pass credentials via environment only — never as CLI arguments (visible in ps aux).
    const child = spawn('pnpm', ['exec', 'vercel-mcp'], {
      stdio: 'inherit',
      env: { ...process.env, VERCEL_API_KEY: vercelApiKey },
    });

    child.on('error', (error) => {
      logger.error(`Failed to start Vercel MCP server: ${error.message}`);
      resolve(ErrorCode.CONFIG_ERROR);
    });

    child.on('exit', (code) => resolve(code ?? 0));

    process.on('SIGINT', () => {
      child.kill('SIGINT');
    });
    process.on('SIGTERM', () => {
      child.kill('SIGTERM');
    });
  });
}

async function startVercelMCP() {
  try {
    await getProjectRoot(import.meta.url);
    const vercelApiKey = process.env.VERCEL_API_KEY ?? process.env.VERCEL_TOKEN;

    if (!vercelApiKey) {
      logger.error('VERCEL_API_KEY environment variable is required');
      logger.info('   Get your token from: https://vercel.com/account/tokens');
      process.exit(ErrorCode.CONFIG_ERROR);
    }

    const withRestart = process.argv.includes('--restart');
    logger.header('Starting Vercel MCP Server');
    logger.info(`   API Key: ${vercelApiKey.substring(0, 8)}...`);
    if (withRestart) logger.info('   Restart mode: enabled (up to 3 attempts)');

    let attempt = 0;
    while (true) {
      const code = await spawnVercel(vercelApiKey);
      if (!withRestart || attempt >= MAX_RESTARTS) {
        process.exit(code ?? 0);
      }
      const delay = RESTART_DELAYS_MS[attempt] ?? 8000;
      attempt++;
      logger.warning(
        `   Server exited (code ${code}). Restarting in ${delay / 1000}s (attempt ${attempt}/${MAX_RESTARTS})...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
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
    await startVercelMCP();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
