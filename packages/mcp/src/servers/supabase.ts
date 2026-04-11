#!/usr/bin/env tsx

/**
 * Supabase MCP Server Launcher
 *
 * Starts the Supabase MCP server for AI-powered database management.
 *
 * Usage:
 *   pnpm mcp:supabase
 */

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { checkMcpLicense } from '../index.js';
import { createLauncherLogger, ExitCode } from './_launcher-utils.js';

const logger = createLauncherLogger();

// Load environment variables
config();

async function startSupabaseMCP() {
  // Supabase MCP uses local package supabase-mcp
  // Verified: Package expects SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY
  // Source: node_modules/supabase-mcp/dist/esm/config.js and services/supabase.js
  //
  // NEW API KEY SUPPORT (2025):
  // Supabase introduced new API keys: sb_publishable_... (replaces anon) and sb_secret_... (replaces service_role)
  // Legacy keys (anon/service_role JWT) still work but will be deprecated in Nov 2025
  // The @supabase/supabase-js client accepts any key format, so we support both
  // Reference: https://github.com/orgs/supabase/discussions/29260
  const supabaseUrl = process.env.SUPABASE_URL;

  // Support both legacy and new API key formats
  // New format: SUPABASE_PUBLISHABLE_KEY (sb_publishable_...) or SUPABASE_ANON_KEY (legacy)
  // New format: SUPABASE_SECRET_KEY (sb_secret_...) or SUPABASE_SERVICE_ROLE_KEY (legacy)
  const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    logger.error('SUPABASE_URL is required');
    logger.info('   Get your credentials from: https://supabase.com/dashboard → Settings → API');
    process.exit(ExitCode.CONFIG_ERROR);
  }

  if (!supabaseAnonKey) {
    logger.error('SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY is required');
    logger.info('   Legacy: SUPABASE_ANON_KEY (anon JWT key)');
    logger.info('   New: SUPABASE_PUBLISHABLE_KEY (sb_publishable_... key)');
    logger.info('   Get from: https://supabase.com/dashboard → Settings → API');
    process.exit(ExitCode.CONFIG_ERROR);
  }

  if (!supabaseServiceRoleKey) {
    logger.error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is required');
    logger.info('   Legacy: SUPABASE_SERVICE_ROLE_KEY (service_role JWT key)');
    logger.info('   New: SUPABASE_SECRET_KEY (sb_secret_... key)');
    logger.info('   Note: Required for MCP server operations (full database access)');
    logger.info('   Get from: https://supabase.com/dashboard → Settings → API');
    process.exit(ExitCode.CONFIG_ERROR);
  }

  // MCP_API_KEY is required by supabase-mcp package for server authentication
  // This is NOT a Supabase key - it's a key you generate yourself to secure the MCP server
  let mcpApiKey = process.env.MCP_API_KEY;
  if (!mcpApiKey) {
    // Auto-generate a secure random key if not provided
    mcpApiKey = randomBytes(32).toString('hex');
    logger.warning('MCP_API_KEY not set - auto-generated a secure key');
    logger.warning('   Add this to your .env file to persist it:');
    logger.warning(`   MCP_API_KEY=${mcpApiKey}`);
    logger.warning('   (This key secures your MCP server endpoint)');
  }

  const withRestart = process.argv.includes('--restart');
  logger.header('Starting Supabase MCP Server (Local)');
  logger.info(`   Supabase URL: ${supabaseUrl}`);
  if (withRestart) logger.info('   Restart mode: enabled (up to 3 attempts)');

  // Detect key format for logging
  const usingNewKeys = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (usingNewKeys) {
    logger.info('   Using new API key format (sb_publishable_/sb_secret_)');
  } else {
    logger.info('   Using legacy API key format (anon/service_role JWT)');
    logger.warning('   Consider migrating to new keys before Nov 2025');
    logger.info('   See: https://github.com/orgs/supabase/discussions/29260');
  }

  // Build env once  -  used for all spawn attempts
  // Package validates: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, MCP_API_KEY
  // We map new keys to legacy variable names for package compatibility
  const spawnEnv = {
    ...process.env,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
    MCP_API_KEY: mcpApiKey,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  };

  const MaxRestarts = 3;
  const RestartDelaysMs = [2000, 4000, 8000];

  const spawnSupabase = (): Promise<number | null> =>
    new Promise((resolve) => {
      const child = spawn('pnpm', ['dlx', 'supabase-mcp'], { stdio: 'inherit', env: spawnEnv });
      child.on('error', (error) => {
        logger.error(`Failed to start Supabase MCP server: ${error.message}`);
        resolve(ExitCode.CONFIG_ERROR);
      });
      child.on('exit', (code) => resolve(code ?? 0));
      process.on('SIGINT', () => {
        child.kill('SIGINT');
      });
      process.on('SIGTERM', () => {
        child.kill('SIGTERM');
      });
    });

  let attempt = 0;
  while (true) {
    const code = await spawnSupabase();
    if (!withRestart || attempt >= MaxRestarts) {
      process.exit(code ?? 0);
    }
    const delay = RestartDelaysMs[attempt] ?? 8000;
    attempt++;
    logger.warning(
      `   Server exited (code ${code}). Restarting in ${delay / 1000}s (attempt ${attempt}/${MaxRestarts})...`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/**
 * Launch the Supabase MCP server.
 * Exported for programmatic use by the Hypervisor.
 */
export async function launchSupabaseMcp(): Promise<void> {
  if (!(await checkMcpLicense())) {
    throw new Error('MCP license check failed');
  }
  await startSupabaseMCP();
}

/**
 * Main function (CLI entrypoint)
 */
async function main() {
  try {
    await launchSupabaseMcp();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ExitCode.EXECUTION_ERROR);
  }
}

main();
