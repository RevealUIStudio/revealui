#!/usr/bin/env tsx

/**
 * Neon MCP Server Launcher
 *
 * Starts the Neon Database MCP server for AI-powered database management.
 *
 * Usage:
 *   pnpm mcp:neon
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

async function spawnNeon(neonApiKey: string): Promise<number | null> {
  return new Promise((resolve) => {
    // Pass credentials via environment only — never as CLI arguments (visible in ps aux).
    // mcp-server-neon reads NEON_API_KEY from the environment.
    // Using pnpm exec instead of dlx so pnpm overrides apply to dependencies.
    const child = spawn('pnpm', ['exec', 'mcp-server-neon', 'start'], {
      stdio: 'inherit',
      env: { ...process.env, NEON_API_KEY: neonApiKey },
    });

    child.on('error', (error) => {
      logger.error(`Failed to start NeonDB MCP server: ${error.message}`);
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

async function startNeonMCP() {
  try {
    await getProjectRoot(import.meta.url);
    // Neon MCP uses local package @neondatabase/mcp-server-neon
    const neonApiKey = process.env.NEON_API_KEY;

    if (!neonApiKey) {
      logger.error('NEON_API_KEY environment variable is required');
      logger.info('   Get your API key from: https://console.neon.tech/app/settings/api-keys');
      process.exit(ErrorCode.CONFIG_ERROR);
    }

    const withRestart = process.argv.includes('--restart');
    logger.header('Starting NeonDB MCP Server (Local)');
    logger.info(`   API Key: ${neonApiKey.substring(0, 12)}...`);
    if (withRestart) logger.info('   Restart mode: enabled (up to 3 attempts)');

    let attempt = 0;
    while (true) {
      const code = await spawnNeon(neonApiKey);
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
 * Launch the Neon MCP server.
 * Exported for programmatic use by the Hypervisor.
 */
export async function launchNeonMcp(): Promise<void> {
  if (!(await checkMcpLicense())) {
    throw new Error('MCP license check failed');
  }
  await startNeonMCP();
}

/**
 * Main function (CLI entrypoint)
 */
async function main() {
  try {
    await launchNeonMcp();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
