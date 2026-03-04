#!/usr/bin/env tsx

/**
 * Types Gate — Native Type System Validation for RevealUI
 *
 * Replaces GitHub Actions validate-types.yml workflow.
 * Validates that generated types are in sync with schemas and all type checks pass.
 *
 * Usage:
 *   pnpm gate:types              — run full type system validation
 *   pnpm gate:types --check-only — skip generation, just validate existing types
 *
 * Steps (serial — each depends on the previous):
 *   1. Generate types (pnpm generate:all)
 *   2. Check generated files are not dirty (git status)
 *   3. Validate types (pnpm validate:types)
 *   4. Enhanced type validation (pnpm validate:types:enhanced)
 *   5. Type coverage analysis (pnpm types:coverage)
 *   6. Type consistency check (pnpm types:check)
 *   7. Build @revealui/db
 *   8. Build @revealui/contracts
 *   9. Run contract tests (32 tests)
 *  10. Typecheck @revealui/db
 *  11. Typecheck @revealui/contracts
 *
 * @dependencies
 * - scripts/lib/exec.ts - execCommand
 * - scripts/lib/errors.ts - ErrorCode
 * - scripts/utils/base.ts - createLogger, getProjectRoot
 */

import { ErrorCode } from '../lib/errors.js'
import { execCommand } from '../lib/exec.js'
import { createLogger, getProjectRoot } from '../utils/base.js'

const logger = createLogger()

// =============================================================================
// Types
// =============================================================================

interface StepResult {
  name: string
  status: 'pass' | 'fail' | 'skip'
  durationMs: number
  detail?: string
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
  const start = performance.now()
  const result = await execCommand(command, args, options)
  const durationMs = performance.now() - start

  if (result.success) {
    return { name, status: 'pass', durationMs }
  }

  return {
    name,
    status: 'fail',
    durationMs,
    detail: result.stderr?.trim() || result.stdout?.trim() || 'Command failed',
  }
}

// =============================================================================
// Summary
// =============================================================================

const STATUS_ICON: Record<string, string> = {
  pass: '\u2713',
  fail: '\u2717',
  skip: '\u2013',
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function printSummary(results: StepResult[], totalMs: number): void {
  const failed = results.some((r) => r.status === 'fail')

  logger.header('Types Gate Summary')

  for (const r of results) {
    const icon = STATUS_ICON[r.status]
    const duration = r.status === 'skip' ? '' : formatDuration(r.durationMs)
    const pad = ' '.repeat(Math.max(1, 32 - r.name.length))
    console.log(`  ${icon} ${r.name}${pad}${duration}`)
    if (r.detail && r.status === 'fail') {
      const lines = r.detail.split('\n').slice(0, 5)
      for (const line of lines) {
        console.log(`       ${line}`)
      }
    }
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
  const projectRoot = await getProjectRoot(import.meta.url)
  const checkOnly = process.argv.includes('--check-only')

  logger.header('RevealUI Types Gate')
  if (checkOnly) {
    logger.info('Check-only mode: skipping type generation')
  }
  console.log('')

  const results: StepResult[] = []
  const totalStart = performance.now()

  // Helper: bail early if any step failed
  function hasFailed(): boolean {
    return results.some((r) => r.status === 'fail')
  }

  // Step 1: Generate types
  if (checkOnly) {
    results.push({ name: 'Generate types', status: 'skip', durationMs: 0 })
  } else {
    logger.info('Step 1 — Generate types')
    const step = await runStep('Generate types', 'pnpm', ['generate:all'], {
      cwd: projectRoot,
      timeout: 120000,
    })
    results.push(step)
    if (step.status === 'fail') {
      logger.error('Type generation failed — aborting\n')
      printSummary(results, performance.now() - totalStart)
      process.exit(ErrorCode.EXECUTION_ERROR)
    }
  }

  // Step 2: Check generated files are in sync
  if (!checkOnly) {
    logger.info('Step 2 — Check generated files are in sync')
    const syncResult = await execCommand(
      'git',
      ['status', '--porcelain', 'packages/contracts/src/generated/'],
      { capture: true, cwd: projectRoot },
    )

    const dirty = (syncResult.stdout ?? '').trim()
    if (dirty) {
      results.push({
        name: 'Generated files in sync',
        status: 'fail',
        durationMs: 0,
        detail: `Generated types are out of sync with schema.\nDirty files:\n${dirty}\n\nFix: pnpm generate:all && git add packages/contracts/src/generated/`,
      })
      logger.error('Generated types are out of sync — aborting\n')
      printSummary(results, performance.now() - totalStart)
      process.exit(ErrorCode.VALIDATION_ERROR)
    }
    results.push({ name: 'Generated files in sync', status: 'pass', durationMs: 0 })
  } else {
    results.push({ name: 'Generated files in sync', status: 'skip', durationMs: 0 })
  }

  // Steps 3-6: Validation scripts (serial)
  const validationSteps: Array<[string, string[]]> = [
    ['pnpm validate:types', ['validate:types']],
    ['pnpm validate:types:enhanced', ['validate:types:enhanced']],
    ['pnpm types:coverage', ['types:coverage']],
    ['pnpm types:check', ['types:check']],
  ]

  for (const [name, args] of validationSteps) {
    if (hasFailed()) break
    logger.info(`Running ${name}`)
    const step = await runStep(name, 'pnpm', args, { cwd: projectRoot, timeout: 120000 })
    results.push(step)
  }

  if (hasFailed()) {
    logger.error('Validation failed — aborting\n')
    printSummary(results, performance.now() - totalStart)
    process.exit(ErrorCode.VALIDATION_ERROR)
  }

  // Step 7: Build @revealui/db
  logger.info('Building @revealui/db')
  const dbBuild = await runStep(
    'Build @revealui/db',
    'pnpm',
    ['--filter', '@revealui/db', 'build'],
    { cwd: projectRoot, timeout: 120000 },
  )
  results.push(dbBuild)

  // Step 8: Build @revealui/contracts
  logger.info('Building @revealui/contracts')
  const contractsBuild = await runStep(
    'Build @revealui/contracts',
    'pnpm',
    ['--filter', '@revealui/contracts', 'build'],
    { cwd: projectRoot, timeout: 120000 },
  )
  results.push(contractsBuild)

  if (hasFailed()) {
    logger.error('Build failed — aborting\n')
    printSummary(results, performance.now() - totalStart)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  // Step 9: Contract tests
  logger.info('Running contract tests')
  const contractTests = await runStep(
    'Contract tests',
    'pnpm',
    ['--filter', '@revealui/contracts', 'test', 'src/generated/__tests__/contracts.test.ts'],
    { cwd: projectRoot, timeout: 120000 },
  )
  results.push(contractTests)

  // Steps 10-11: Typecheck db + contracts (parallel)
  logger.info('Typechecking @revealui/db and @revealui/contracts')
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
  ])
  results.push(dbTypecheck, contractsTypecheck)

  // Done
  printSummary(results, performance.now() - totalStart)

  if (hasFailed()) {
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

// =============================================================================
// Entry Point
// =============================================================================

async function main(): Promise<void> {
  try {
    await gate()
  } catch (error) {
    logger.error(`Types gate failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
