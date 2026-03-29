#!/usr/bin/env tsx

/**
 * Stripe MCP Server Launcher
 *
 * Starts the Stripe MCP server for AI-powered payment management.
 *
 * Usage:
 *   pnpm mcp:stripe
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

async function spawnStripe(stripeSecretKey: string): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['dlx', '@stripe/mcp', '--tools=all'], {
      stdio: 'inherit',
      env: { ...process.env, STRIPE_SECRET_KEY: stripeSecretKey },
    });

    child.on('error', (error) => {
      logger.error(`Failed to start Stripe MCP server: ${error.message}`);
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

async function startStripeMCP() {
  try {
    await getProjectRoot(import.meta.url);
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      logger.error('STRIPE_SECRET_KEY environment variable is required');
      logger.info('   Get your key from: https://dashboard.stripe.com/apikeys');
      process.exit(ErrorCode.CONFIG_ERROR);
    }

    const withRestart = process.argv.includes('--restart');
    logger.header('Starting Stripe MCP Server');
    logger.info(`   Secret Key: ${stripeSecretKey.substring(0, 12)}...`);
    if (withRestart) logger.info('   Restart mode: enabled (up to 3 attempts)');

    let attempt = 0;
    while (true) {
      const code = await spawnStripe(stripeSecretKey);
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
    await startStripeMCP();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
