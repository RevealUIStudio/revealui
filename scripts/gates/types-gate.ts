#!/usr/bin/env tsx

/**
 * Types Gate  -  Native Type System Validation for RevealUI
 *
 * Validates that type-critical packages build and typecheck cleanly.
 *
 * Usage:
 *   pnpm gate:types               -  run full type system validation
 *   pnpm gate:types --check-only  -  skip builds, just typecheck
 *
 * Steps (serial  -  each depends on the previous):
 *   1. Build @revealui/db
 *   2. Build @revealui/contracts
 *   3. Run contract tests
 *   4. Typecheck @revealui/db
 *   5. Typecheck @revealui/contracts
 *   6. Full workspace typecheck (pnpm typecheck:all)
 *
 * @dependencies
 * - scripts/lib/exec.ts - execCommand
 * - scripts/lib/errors.ts - ErrorCode
 * - scripts/utils/base.ts - createLogger, getProjectRoot
 */

import { ErrorCode } from '@revealui/scripts/errors.js';
import { execCommand } from '@revealui/scripts/exec.js';
import { createLogger, getProjectRoot } from '../utils/base.js';

const logger = createLogger();

// =============================================================================
// Types
// =============================================================================

interface StepResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  durationMs: number;
  detail?: string;
}

// =============================================================================
// Step Runner
// =============================================================================

async function runStep(
  name: string,
  command: string,
  args: string[],
  options: { cwd: string; capture?: boolean; timeout?: number } = { cwd: process.cwd() },
): Promise<StepResult> {
  const start = performance.now();
  const result = await execCommand(command, args, options);
  const durationMs = performance.now() - start;

  if (result.success) {
    return { name, status: 'pass', durationMs };
  }

  return {
    name,
    status: 'fail',
    durationMs,
    detail: result.stderr?.trim() || result.stdout?.trim() || 'Command failed',
  };
}

// =============================================================================
// Summary
// =============================================================================

const STATUS_ICON: Record<string, string> = {
  pass: '\u2713',
  fail: '\u2717',
  skip: '\u2013',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printSummary(results: StepResult[], totalMs: number): void {
  const failed = results.some((r) => r.status === 'fail');

  logger.header('Types Gate Summary');

  for (const r of results) {
    const icon = STATUS_ICON[r.status];
    const duration = r.status === 'skip' ? '' : formatDuration(r.durationMs);
    const pad = ' '.repeat(Math.max(1, 32 - r.name.length));
    console.log(`  ${icon} ${r.name}${pad}${duration}`);
    if (r.detail && r.status === 'fail') {
      const lines = r.detail.split('\n').slice(0, 5);
      for (const line of lines) {
        console.log(`       ${line}`);
      }
    }
  }

  console.log('='.repeat(60));
  console.log(`  Total: ${formatDuration(totalMs)}`);
  console.log(`  Result: ${failed ? 'FAIL' : 'PASS'}`);
  console.log('='.repeat(60));
}

// =============================================================================
// Gate Logic
// =============================================================================

async function gate(): Promise<void> {
  const projectRoot = await getProjectRoot(import.meta.url);
  const checkOnly = process.argv.includes('--check-only');

  logger.header('RevealUI Types Gate');
  if (checkOnly) {
    logger.info('Check-only mode: skipping builds');
  }
  console.log('');

  const results: StepResult[] = [];
  const totalStart = performance.now();

  // Helper: bail early if any step failed
  function hasFailed(): boolean {
    return results.some((r) => r.status === 'fail');
  }

  // Step 1: Build @revealui/db
  if (checkOnly) {
    results.push({ name: 'Build @revealui/db', status: 'skip', durationMs: 0 });
  } else {
    logger.info('Step 1  -  Building @revealui/db');
    const dbBuild = await runStep(
      'Build @revealui/db',
      'pnpm',
      ['--filter', '@revealui/db', 'build'],
      { cwd: projectRoot, timeout: 120000 },
    );
    results.push(dbBuild);
  }

  // Step 2: Build @revealui/contracts
  if (checkOnly) {
    results.push({ name: 'Build @revealui/contracts', status: 'skip', durationMs: 0 });
  } else {
    logger.info('Step 2  -  Building @revealui/contracts');
    const contractsBuild = await runStep(
      'Build @revealui/contracts',
      'pnpm',
      ['--filter', '@revealui/contracts', 'build'],
      { cwd: projectRoot, timeout: 120000 },
    );
    results.push(contractsBuild);
  }

  if (hasFailed()) {
    logger.error('Build failed  -  aborting\n');
    printSummary(results, performance.now() - totalStart);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }

  // Step 3: Contract tests
  logger.info('Step 3  -  Running contract tests');
  const contractTests = await runStep(
    'Contract tests',
    'pnpm',
    ['--filter', '@revealui/contracts', 'test', 'src/generated/__tests__/contracts.test.ts'],
    { cwd: projectRoot, timeout: 120000 },
  );
  results.push(contractTests);

  // Steps 4-5: Typecheck db + contracts (parallel)
  logger.info('Steps 4-5  -  Typechecking @revealui/db and @revealui/contracts');
  const [dbTypecheck, contractsTypecheck] = await Promise.all([
    runStep('Typecheck @revealui/db', 'pnpm', ['--filter', '@revealui/db', 'typecheck'], {
      cwd: projectRoot,
      timeout: 120000,
    }),
    runStep(
      'Typecheck @revealui/contracts',
      'pnpm',
      ['--filter', '@revealui/contracts', 'typecheck'],
      { cwd: projectRoot, timeout: 120000 },
    ),
  ]);
  results.push(dbTypecheck, contractsTypecheck);

  if (hasFailed()) {
    logger.error('Typecheck failed  -  aborting\n');
    printSummary(results, performance.now() - totalStart);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }

  // Step 6: Full workspace typecheck
  logger.info('Step 6  -  Full workspace typecheck');
  const fullTypecheck = await runStep('Full workspace typecheck', 'pnpm', ['typecheck:all'], {
    cwd: projectRoot,
    timeout: 300000,
  });
  results.push(fullTypecheck);

  // Done
  printSummary(results, performance.now() - totalStart);

  if (hasFailed()) {
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

// =============================================================================
// Entry Point
// =============================================================================

async function main(): Promise<void> {
  try {
    await gate();
  } catch (error) {
    logger.error(`Types gate failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
