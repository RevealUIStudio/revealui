#!/usr/bin/env tsx

/**
 * Deploy All — Multi-App Vercel Deployment for RevealUI
 *
 * Orchestrates Vercel deployment for all 7 apps, replacing the
 * deploy.yml GitHub Actions workflow. Runs concurrent deployments
 * with optional smoke testing.
 *
 * Usage:
 *   pnpm deploy:all                    — deploy all apps to production
 *   pnpm deploy:all --env=preview      — deploy as preview
 *   pnpm deploy:all --app=cms          — deploy single app
 *   pnpm deploy:all --skip-build       — skip build step
 *   pnpm deploy:all --skip-smoke       — skip smoke tests
 *
 * @dependencies
 * - scripts/lib/exec.ts - execCommand for running commands
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/utils/base.ts - Base utilities (createLogger, getProjectRoot)
 * - dotenv - Environment variable loading
 *
 * @requires
 * - Environment: VERCEL_TOKEN or VERCEL_API_TOKEN
 * - External: vercel, pnpm
 */

import { ErrorCode } from '@revealui/scripts/errors.js';
import { execCommand } from '@revealui/scripts/exec.js';
import { config } from 'dotenv';
import { createLogger, getProjectRoot } from '../../utils/base.ts';

const logger = createLogger();

// Load environment variables
config();

// =============================================================================
// Constants
// =============================================================================

const ALL_APPS = ['api', 'cms', 'dashboard', 'docs', 'landing', 'web'] as const;
const CONCURRENCY = 3;

// =============================================================================
// Types
// =============================================================================

interface DeployResult {
  app: string;
  status: 'success' | 'fail' | 'skip';
  url?: string;
  durationMs: number;
}

// =============================================================================
// CLI Argument Parsing
// =============================================================================

function parseArgs(): {
  env: 'production' | 'preview';
  app: string | null;
  skipBuild: boolean;
  skipSmoke: boolean;
} {
  const argv = process.argv.slice(2);
  let env: 'production' | 'preview' = 'production';
  let app: string | null = null;
  let skipBuild = false;
  let skipSmoke = false;

  for (const arg of argv) {
    if (arg.startsWith('--env=')) {
      const val = arg.split('=')[1];
      if (val === 'preview') env = 'preview';
    } else if (arg.startsWith('--app=')) {
      app = arg.split('=')[1];
    } else if (arg === '--skip-build') {
      skipBuild = true;
    } else if (arg === '--skip-smoke') {
      skipSmoke = true;
    }
  }

  return { env, app, skipBuild, skipSmoke };
}

// =============================================================================
// Deployment
// =============================================================================

async function deployApp(
  app: string,
  env: 'production' | 'preview',
  projectRoot: string,
  token: string,
): Promise<DeployResult> {
  const start = performance.now();
  const cwd = `${projectRoot}/apps/${app}`;
  const execOpts = {
    cwd,
    env: {
      VERCEL_TOKEN: token,
    },
    timeout: 300000, // 5 min per step
  };

  logger.info(`Deploying ${app} (${env})...`);

  // Step 1: vercel pull
  const pull = await execCommand('vercel', ['pull', '--yes', `--environment=${env}`], execOpts);
  if (!pull.success) {
    logger.error(`${app}: vercel pull failed`);
    return { app, status: 'fail', durationMs: performance.now() - start };
  }

  // Step 2: vercel build
  const buildArgs = ['build', ...(env === 'production' ? ['--prod'] : [])];
  const build = await execCommand('vercel', buildArgs, execOpts);
  if (!build.success) {
    logger.error(`${app}: vercel build failed`);
    return { app, status: 'fail', durationMs: performance.now() - start };
  }

  // Step 3: vercel deploy --prebuilt
  const deployArgs = ['deploy', '--prebuilt', '--yes', ...(env === 'production' ? ['--prod'] : [])];
  const deploy = await execCommand('vercel', deployArgs, {
    ...execOpts,
    capture: true,
  });
  if (!deploy.success) {
    logger.error(`${app}: vercel deploy failed`);
    return { app, status: 'fail', durationMs: performance.now() - start };
  }

  // Extract deployment URL from output (last non-empty line)
  const url = deploy.stdout?.trim().split('\n').pop()?.trim();

  logger.success(`${app}: deployed \u2192 ${url ?? 'unknown'}`);
  return { app, status: 'success', url, durationMs: performance.now() - start };
}

async function deployWithConcurrency(
  apps: string[],
  env: 'production' | 'preview',
  projectRoot: string,
  token: string,
): Promise<DeployResult[]> {
  const results: DeployResult[] = [];

  for (let i = 0; i < apps.length; i += CONCURRENCY) {
    const chunk = apps.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((app) => deployApp(app, env, projectRoot, token)),
    );
    results.push(...chunkResults);
  }

  return results;
}

// =============================================================================
// Smoke Tests
// =============================================================================

async function smokeTest(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// =============================================================================
// Summary
// =============================================================================

function printSummary(results: DeployResult[], smokeResults?: Map<string, boolean>): void {
  logger.header('Deployment Summary');

  for (const r of results) {
    const icon = r.status === 'success' ? '\u2713' : '\u2717';
    const duration = `${(r.durationMs / 1000).toFixed(1)}s`;
    const url = r.url ?? '';
    const smoke = smokeResults?.has(r.app)
      ? smokeResults.get(r.app)
        ? ' (smoke: ok)'
        : ' (smoke: FAIL)'
      : '';
    console.log(`  ${icon} ${r.app.padEnd(12)} ${duration.padEnd(8)} ${url}${smoke}`);
  }

  const failed = results.filter((r) => r.status === 'fail');
  console.log('='.repeat(60));
  if (failed.length > 0) {
    console.log(`  ${failed.length} deployment(s) failed: ${failed.map((r) => r.app).join(', ')}`);
  } else {
    console.log(`  All ${results.length} app(s) deployed successfully`);
  }
  console.log('='.repeat(60));
}

// =============================================================================
// Main
// =============================================================================

async function deployAll(): Promise<void> {
  const projectRoot = await getProjectRoot(import.meta.url);
  const { env, app, skipBuild, skipSmoke } = parseArgs();

  logger.header('RevealUI Deploy All');

  // Validate token
  const token = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN;
  if (!token) {
    logger.error('VERCEL_TOKEN or VERCEL_API_TOKEN environment variable is required');
    logger.error('   Get your token from: https://vercel.com/account/tokens');
    logger.error('   Add it to your .env file as VERCEL_TOKEN=your_token_here');
    process.exit(ErrorCode.CONFIG_ERROR);
  }

  logger.success('Token validated');
  logger.info(`Environment: ${env}`);

  // Determine which apps to deploy
  const apps = app ? [app] : [...ALL_APPS];
  logger.info(`Apps: ${apps.join(', ')}`);
  console.log('');

  // Build step
  if (!skipBuild) {
    logger.info('Building all packages (turbo cached)...');
    const buildResult = await execCommand('pnpm', ['build']);
    if (!buildResult.success) {
      logger.error('Build failed');
      process.exit(ErrorCode.EXECUTION_ERROR);
    }
    logger.success('Build completed\n');
  }

  // Deploy
  logger.info(`Deploying ${apps.length} app(s) (concurrency: ${CONCURRENCY})...\n`);
  const results = await deployWithConcurrency(apps, env, projectRoot, token);

  // Smoke tests
  let smokeResults: Map<string, boolean> | undefined;
  if (!skipSmoke) {
    const deployed = results.filter((r) => r.status === 'success' && r.url);
    if (deployed.length > 0) {
      logger.info('\nRunning smoke tests...');
      smokeResults = new Map();
      for (const r of deployed) {
        // biome-ignore lint/style/noNonNullAssertion: filtered to only entries with url
        const ok = await smokeTest(r.url!);
        smokeResults.set(r.app, ok);
        const icon = ok ? '\u2713' : '\u2717';
        console.log(`  ${icon} ${r.app}: ${r.url}`);
      }
    }
  }

  // Summary
  printSummary(results, smokeResults);

  const failed = results.some((r) => r.status === 'fail');
  if (failed) {
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

async function main(): Promise<void> {
  try {
    await deployAll();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
