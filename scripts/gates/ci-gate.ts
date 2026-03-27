#!/usr/bin/env tsx

/**
 * CI Gate — Local CI/CD Quality Gate for RevealUI
 *
 * Replaces GitHub Actions CI pipeline with local phased checks.
 * Uses turbo caching for fast warm runs (~1-2 min).
 *
 * Usage:
 *   pnpm gate                  — run all phases
 *   pnpm gate --phase=1        — quick quality checks only
 *   pnpm gate --skip=security  — skip security audit
 *   pnpm gate --no-build       — skip build in phase 3
 *   pnpm gate --changed        — scope lint/typecheck to packages changed since HEAD~1 (pre-push fast path)
 *   pnpm gate --types          — include full type-system validation (gate:types) in phase 2
 *
 * Phases:
 *   1. Quality (parallel): lint, audits, structure validation, boundary enforcement
 *   2. Types (serial): full typecheck across all packages
 *   3. Test + Build (parallel): unit tests and production build
 *
 * @dependencies
 * - scripts/lib/exec.ts - execCommand for running checks
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/utils/base.ts - Base utilities (createLogger, getProjectRoot)
 *
 * @requires
 * - External: pnpm, turbo, biome
 */

import { ErrorCode } from '@revealui/scripts/errors.js';
import { execCommand } from '@revealui/scripts/exec.js';
import { createLogger, getProjectRoot } from '../utils/base.js';

const logger = createLogger();

// =============================================================================
// Types
// =============================================================================

interface CheckDef {
  name: string;
  command: string;
  args: string[];
  warnOnly?: boolean;
  skip?: boolean;
  timeout?: number;
}

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  durationMs: number;
}

// =============================================================================
// CLI Argument Parsing
// =============================================================================

function parseArgs(): {
  phase: number | null;
  skip: Set<string>;
  noBuild: boolean;
  changed: boolean;
  types: boolean;
} {
  const argv = process.argv.slice(2);
  let phase: number | null = null;
  const skip = new Set<string>();
  let noBuild = false;
  let changed = false;
  let types = false;

  for (const arg of argv) {
    if (arg.startsWith('--phase=')) {
      phase = Number.parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--skip=')) {
      skip.add(arg.split('=')[1]);
    } else if (arg === '--no-build') {
      noBuild = true;
    } else if (arg === '--changed') {
      changed = true;
    } else if (arg === '--types') {
      types = true;
    }
  }

  return { phase, skip, noBuild, changed, types };
}

// =============================================================================
// Check Runner
// =============================================================================

async function runCheck(check: CheckDef): Promise<CheckResult> {
  if (check.skip) {
    return { name: check.name, status: 'skip', durationMs: 0 };
  }

  const start = performance.now();
  const result = await execCommand(check.command, check.args, {
    timeout: check.timeout,
  });
  const durationMs = performance.now() - start;

  if (result.success) {
    return { name: check.name, status: 'pass', durationMs };
  }

  if (check.warnOnly) {
    return { name: check.name, status: 'warn', durationMs };
  }

  return { name: check.name, status: 'fail', durationMs };
}

async function runPhaseParallel(checks: CheckDef[]): Promise<CheckResult[]> {
  return Promise.all(checks.map(runCheck));
}

async function runPhaseSerial(checks: CheckDef[]): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    const result = await runCheck(check);
    results.push(result);
    if (result.status === 'fail') break;
  }
  return results;
}

// =============================================================================
// Summary Table
// =============================================================================

const STATUS_ICON: Record<string, string> = {
  pass: '\u2713',
  fail: '\u2717',
  warn: '\u26A0',
  skip: '\u2013',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printSummary(results: CheckResult[], totalMs: number): void {
  const failed = results.some((r) => r.status === 'fail');

  logger.header('CI Gate Summary');

  for (const r of results) {
    const icon = STATUS_ICON[r.status];
    const duration = r.status === 'skip' ? '' : formatDuration(r.durationMs);
    const suffix = r.status === 'warn' ? '  (warning)' : '';
    const pad = ' '.repeat(Math.max(1, 28 - r.name.length));
    console.log(`  ${icon} ${r.name}${pad}${duration}${suffix}`);
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
  await getProjectRoot(import.meta.url);

  const { phase, skip, noBuild, changed, types } = parseArgs();

  logger.header('RevealUI CI Gate');

  if (phase !== null) {
    logger.info(`Running phase ${phase} only`);
  }
  if (skip.size > 0) {
    logger.info(`Skipping: ${[...skip].join(', ')}`);
  }
  if (noBuild) {
    logger.info('Build step disabled');
  }
  if (changed) {
    logger.info('Changed-only mode: scoping lint/typecheck to packages changed since HEAD~1');
  }
  if (types) {
    logger.info('Types mode: full type-system validation included in phase 2');
  }
  console.log('');

  const allResults: CheckResult[] = [];
  const totalStart = performance.now();

  // --- Phase 1: Quality (parallel) ---
  if (phase === null || phase === 1) {
    logger.info('Phase 1 \u2014 Quality checks (parallel)');

    // In changed-only mode: lint only files changed since HEAD~1
    const biomeCheck: CheckDef = changed
      ? {
          name: 'Biome lint (changed)',
          command: 'bash',
          args: [
            '-c',
            'FILES=$(git diff --name-only --diff-filter=ACMR HEAD~1 -- "*.ts" "*.tsx" "*.js" "*.jsx" 2>/dev/null); [ -z "$FILES" ] && exit 0; echo "$FILES" | xargs node_modules/.bin/biome check',
          ],
          timeout: 600000,
        }
      : { name: 'Biome lint', command: 'pnpm', args: ['lint:biome'], timeout: 600000 };

    const phase1Checks: CheckDef[] = [
      biomeCheck,
      { name: 'Any type audit', command: 'pnpm', args: ['audit:any'], warnOnly: true },
      { name: 'Console audit', command: 'pnpm', args: ['audit:console'], warnOnly: true },
      {
        name: 'Structure validation',
        command: 'pnpm',
        args: ['validate:structure'],
        warnOnly: true,
      },
      {
        name: 'Boundary validation',
        command: 'pnpm',
        args: ['validate:boundary'],
      },
      {
        name: 'Version policy',
        command: 'pnpm',
        args: ['validate:versions'],
      },
      {
        name: 'Security audit',
        command: 'pnpm',
        args: ['gate:security'],
        warnOnly: true,
        skip: skip.has('security'),
      },
      {
        name: 'Coverage check',
        command: 'pnpm',
        args: changed ? ['coverage:check', '--changed'] : ['coverage:check'],
        warnOnly: true,
        // Skip if no coverage reports exist yet (gate:quick shouldn't require a test run)
        skip: skip.has('coverage'),
      },
    ];

    const results = await runPhaseParallel(phase1Checks);
    allResults.push(...results);

    if (results.some((r) => r.status === 'fail')) {
      logger.error('Phase 1 failed\n');
      printSummary(allResults, performance.now() - totalStart);
      process.exit(ErrorCode.VALIDATION_ERROR);
    }

    logger.success('Phase 1 passed\n');
  }

  // --- Phase 2: Types (serial) ---
  if (phase === null || phase === 2) {
    logger.info('Phase 2 \u2014 Type checking (serial)');

    // In changed-only mode: only typecheck packages changed since HEAD~1 (and their dependents)
    const typecheckArgs = changed
      ? ['turbo', 'run', 'typecheck', '--filter=...[HEAD~1]']
      : ['typecheck:all'];

    const phase2Checks: CheckDef[] = [
      { name: 'Type checking', command: 'pnpm', args: typecheckArgs, timeout: 300000 },
      {
        name: 'Type system validation',
        command: 'pnpm',
        args: ['gate:types', '--check-only'],
        warnOnly: true,
        // Only run full type-system gate when --types flag is passed
        skip: !types,
        timeout: 300000,
      },
    ];

    const results = await runPhaseSerial(phase2Checks);
    allResults.push(...results);

    if (results.some((r) => r.status === 'fail')) {
      logger.error('Phase 2 failed\n');
      printSummary(allResults, performance.now() - totalStart);
      process.exit(ErrorCode.VALIDATION_ERROR);
    }

    logger.success('Phase 2 passed\n');
  }

  // --- Phase 3: Test + Build (serial: tests first) ---
  if (phase === null || phase === 3) {
    logger.info('Phase 3 \u2014 Test + Build (serial: tests first)');

    const testArgs = changed
      ? ['turbo', 'run', 'test', '--filter=...[HEAD~1]', '--concurrency=4']
      : ['turbo', 'run', 'test', '--concurrency=4'];

    const buildCheck: CheckDef[] = noBuild
      ? []
      : changed
        ? [
            {
              name: 'Build (changed)',
              command: 'pnpm',
              args: ['turbo', 'run', 'build', '--filter=...[HEAD~1]'],
              timeout: 600000,
            },
          ]
        : [{ name: 'Build', command: 'pnpm', args: ['build'], timeout: 900000 }];

    const phase3Checks: CheckDef[] = [
      { name: 'Tests', command: 'pnpm', args: testArgs, timeout: 300000 },
      ...buildCheck,
    ];

    const results = await runPhaseSerial(phase3Checks);
    allResults.push(...results);

    if (results.some((r) => r.status === 'fail')) {
      logger.error('Phase 3 failed\n');
      printSummary(allResults, performance.now() - totalStart);
      process.exit(ErrorCode.EXECUTION_ERROR);
    }

    logger.success('Phase 3 passed\n');
  }

  // --- Done ---
  printSummary(allResults, performance.now() - totalStart);
}

// =============================================================================
// Entry Point
// =============================================================================

async function main(): Promise<void> {
  try {
    await gate();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
