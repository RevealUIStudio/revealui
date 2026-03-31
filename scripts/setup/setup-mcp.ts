#!/usr/bin/env tsx

/**
 * MCP Server Setup Script
 *
 * Checks and configures MCP servers for RevealUI Framework.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/logger.ts - Logger utility
 * - scripts/lib/paths.ts - Project root utilities
 * - node:fs - File system operations (existsSync)
 * - node:path - Path manipulation utilities
 * - dotenv - Environment variable loading
 *
 * @requires
 * - Environment: VERCEL_API_KEY (optional), STRIPE_SECRET_KEY (optional)
 *
 * Usage:
 *   pnpm setup:mcp
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger } from '@revealui/scripts/logger.js';
import { getProjectRoot } from '@revealui/scripts/paths.js';
import { config } from 'dotenv';

const logger = createLogger();

config();

// Check for .env.local
const envLocalPath = join(process.cwd(), '.env.local');
const _envLocalExists = existsSync(envLocalPath);

async function setupMCP() {
  try {
    await getProjectRoot(import.meta.url);
    logger.header('MCP Server Setup for RevealUI');

    logger.info('📝 Checking environment configuration...\n');

    // Check for Vercel token
    const vercelToken = process.env.VERCEL_API_KEY;
    if (!vercelToken) {
      logger.error('VERCEL_API_KEY not found');
      logger.info('   Get your token from: https://vercel.com/account/tokens');
      logger.info('   Add it to your .env file:');
      logger.info('   VERCEL_API_KEY=your_token_here\n');
    } else {
      logger.success('VERCEL_API_KEY found');
    }

    // Check for Stripe key
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      logger.error('STRIPE_SECRET_KEY not found');
      logger.info('   Get your key from: https://dashboard.stripe.com/apikeys');
      logger.info('   Add it to your .env file:');
      logger.info('   STRIPE_SECRET_KEY=sk_test_your_key_here\n');
    } else {
      logger.success('STRIPE_SECRET_KEY found');
    }

    logger.info('\n🔧 MCP Server Configuration');
    logger.info('===========================\n');

    logger.info('Available MCP servers:');
    logger.info('• Vercel MCP - vercel-mcp (free community package)');
    logger.info('  Provides tools for deployments, domains, env vars, etc.');
    logger.info('• Stripe MCP - @stripe/mcp');
    logger.info('  Official Stripe MCP server with 20+ payment & billing tools\n');

    logger.info('To prepare MCP development:');
    logger.info('• Validate credentials only: pnpm setup:mcp');
    logger.info('• Bootstrap dev environment with MCP checks: revealui dev up --include mcp\n');

    logger.info('📚 Next steps:');
    logger.info('1. Configure your AI client (Claude, Cursor, etc.) to connect to MCP servers');
    logger.info('2. Point your client to the running MCP servers');
    logger.info('3. Start using AI-powered Vercel and Stripe management!\n');

    if (!(vercelToken && stripeKey)) {
      logger.warning('⚠️  Please set up your API keys in .env before running MCP servers\n');
      process.exit(ErrorCode.CONFIG_ERROR);
    } else {
      logger.success(
        '🎉 MCP credentials are ready. Run "revealui dev up --include mcp" during local bootstrap\n',
      );
    }
  } catch (error) {
    logger.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await setupMCP();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
