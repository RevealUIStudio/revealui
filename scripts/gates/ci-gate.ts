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
 *   pnpm gate --skip=security  — skip pnpm audit
 *   pnpm gate --no-build       — skip build in phase 3
 *
 * Phases:
 *   1. Quality (parallel): lint, audits, structure validation
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

import { ErrorCode } from '../lib/errors.js'
import { execCommand } from '../lib/exec.js'
import { createLogger, getProjectRoot } from '../utils/base.ts'

const logger = createLogger()

// =============================================================================
// Types
// =============================================================================

interface CheckDef {
  name: string
  command: string
  args: string[]
  warnOnly?: boolean
  skip?: boolean
}

interface CheckResult {
  name: string
  status: 'pass' | 'fail' | 'warn' | 'skip'
  durationMs: number
}

// =============================================================================
// CLI Argument Parsing
// =============================================================================

function parseArgs(): { phase: number | null; skip: Set<string>; noBuild: boolean } {
  const argv = process.argv.slice(2)
  let phase: number | null = null
  const skip = new Set<string>()
  let noBuild = false

  for (const arg of argv) {
    if (arg.startsWith('--phase=')) {
      phase = Number.parseInt(arg.split('=')[1], 10)
    } else if (arg.startsWith('--skip=')) {
      skip.add(arg.split('=')[1])
    } else if (arg === '--no-build') {
      noBuild = true
    }
  }

  return { phase, skip, noBuild }
}

// =============================================================================
// Check Runner
// =============================================================================

async function runCheck(check: CheckDef): Promise<CheckResult> {
  if (check.skip) {
    return { name: check.name, status: 'skip', durationMs: 0 }
  }

  const start = performance.now()
  const result = await execCommand(check.command, check.args)
  const durationMs = performance.now() - start

  if (result.success) {
    return { name: check.name, status: 'pass', durationMs }
  }

  if (check.warnOnly) {
    return { name: check.name, status: 'warn', durationMs }
  }

  return { name: check.name, status: 'fail', durationMs }
}

async function runPhaseParallel(checks: CheckDef[]): Promise<CheckResult[]> {
  return Promise.all(checks.map(runCheck))
}

async function runPhaseSerial(checks: CheckDef[]): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  for (const check of checks) {
    const result = await runCheck(check)
    results.push(result)
    if (result.status === 'fail') break
  }
  return results
}

// =============================================================================
// Summary Table
// =============================================================================

const STATUS_ICON: Record<string, string> = {
  pass: '\u2713',
  fail: '\u2717',
  warn: '\u26A0',
  skip: '\u2013',
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function printSummary(results: CheckResult[], totalMs: number): void {
  const failed = results.some((r) => r.status === 'fail')

  logger.header('CI Gate Summary')

  for (const r of results) {
    const icon = STATUS_ICON[r.status]
    const duration = r.status === 'skip' ? '' : formatDuration(r.durationMs)
    const suffix = r.status === 'warn' ? '  (warning)' : ''
    const pad = ' '.repeat(Math.max(1, 28 - r.name.length))
    console.log(`  ${icon} ${r.name}${pad}${duration}${suffix}`)
  }

  console.log('='.repeat(60))
  console.log(`  Total: ${formatDuration(totalMs)}`)
  console.log(`  Result: ${failed ? 'FAIL' : 'PASS'}`)
  console.log('='.repeat(60))
}

// =============================================================================
// Gate Logic
// =============================================================================

async function gate(): Promise<void> {
  await getProjectRoot(import.meta.url)

  const { phase, skip, noBuild } = parseArgs()

  logger.header('RevealUI CI Gate')

  if (phase !== null) {
    logger.info(`Running phase ${phase} only`)
  }
  if (skip.size > 0) {
    logger.info(`Skipping: ${[...skip].join(', ')}`)
  }
  if (noBuild) {
    logger.info('Build step disabled')
  }
  console.log('')

  const allResults: CheckResult[] = []
  const totalStart = performance.now()

  // --- Phase 1: Quality (parallel) ---
  if (phase === null || phase === 1) {
    logger.info('Phase 1 \u2014 Quality checks (parallel)')

    const phase1Checks: CheckDef[] = [
      { name: 'Biome lint', command: 'pnpm', args: ['lint:biome'] },
      { name: 'ESLint', command: 'pnpm', args: ['lint:eslint'], warnOnly: true },
      { name: 'Any type audit', command: 'pnpm', args: ['audit:any'], warnOnly: true },
      { name: 'Console audit', command: 'pnpm', args: ['audit:console'], warnOnly: true },
      {
        name: 'Structure validation',
        command: 'pnpm',
        args: ['validate:structure'],
        warnOnly: true,
      },
      {
        name: 'Security audit',
        command: 'pnpm',
        args: ['audit', '--audit-level=high'],
        warnOnly: true,
        skip: skip.has('security'),
      },
    ]

    const results = await runPhaseParallel(phase1Checks)
    allResults.push(...results)

    if (results.some((r) => r.status === 'fail')) {
      logger.error('Phase 1 failed\n')
      printSummary(allResults, performance.now() - totalStart)
      process.exit(ErrorCode.VALIDATION_ERROR)
    }

    logger.success('Phase 1 passed\n')
  }

  // --- Phase 2: Types (serial) ---
  if (phase === null || phase === 2) {
    logger.info('Phase 2 \u2014 Type checking (serial)')

    const phase2Checks: CheckDef[] = [
      { name: 'Type checking', command: 'pnpm', args: ['typecheck:all'] },
    ]

    const results = await runPhaseSerial(phase2Checks)
    allResults.push(...results)

    if (results.some((r) => r.status === 'fail')) {
      logger.error('Phase 2 failed\n')
      printSummary(allResults, performance.now() - totalStart)
      process.exit(ErrorCode.VALIDATION_ERROR)
    }

    logger.success('Phase 2 passed\n')
  }

  // --- Phase 3: Test + Build (parallel) ---
  if (phase === null || phase === 3) {
    logger.info('Phase 3 \u2014 Test + Build (parallel)')

    const phase3Checks: CheckDef[] = [
      { name: 'Tests', command: 'pnpm', args: ['test'] },
      ...(noBuild ? [] : [{ name: 'Build', command: 'pnpm', args: ['build'] }]),
    ]

    const results = await runPhaseParallel(phase3Checks)
    allResults.push(...results)

    if (results.some((r) => r.status === 'fail')) {
      logger.error('Phase 3 failed\n')
      printSummary(allResults, performance.now() - totalStart)
      process.exit(ErrorCode.EXECUTION_ERROR)
    }

    logger.success('Phase 3 passed\n')
  }

  // --- Done ---
  printSummary(allResults, performance.now() - totalStart)
}

// =============================================================================
// Entry Point
// =============================================================================

async function main(): Promise<void> {
  try {
    await gate()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
