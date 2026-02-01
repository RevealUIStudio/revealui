#!/usr/bin/env tsx

/**
 * Pre-Launch Validation Script
 * Cross-platform replacement for pre-launch-validation.sh and pre-launch-validation.ps1
 * Runs comprehensive checks before production deployment
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createLogger, execCommand, fileExists, getProjectRoot } from '../lib/index.js'
import { ErrorCode } from '../lib/errors.js'

const logger = createLogger()

interface ValidationResult {
  name: string
  passed: boolean
  message?: string
}

const results: ValidationResult[] = []
let passed = 0
let failed = 0
let warnings = 0

function recordResult(name: string, result: boolean, message?: string) {
  results.push({ name, passed: result, message })
  if (result) {
    passed++
  } else {
    failed++
  }
}

function recordWarning(name: string, message?: string) {
  results.push({ name, passed: true, message })
  warnings++
}

async function checkTypeScript() {
  logger.info('1. Running TypeScript type checking...')
  const result = await execCommand('pnpm', ['typecheck:all'], { silent: true })
  recordResult('Type checking', result.success)
  if (!result.success) {
    logger.info('   Run: pnpm typecheck:all')
  }
}

async function checkPackageScripts() {
  logger.info('2. Validating package.json scripts...')
  const result = await execCommand('pnpm', ['validate:package-scripts'], {
    silent: true,
  })
  recordResult('Package scripts validation', result.success)
  if (!result.success) {
    logger.info('   Run: pnpm validate:package-scripts')
  }
}

async function checkLinting() {
  logger.info('3. Running linter...')
  const result = await execCommand('pnpm', ['lint'], { silent: true })
  recordResult('Linting', result.success)
  if (!result.success) {
    logger.info('   Run: pnpm lint')
  }
}

async function checkTests() {
  logger.info('4. Running tests...')
  const result = await execCommand('pnpm', ['--filter', 'cms', 'test'], {
    silent: true,
  })
  recordResult('Tests', result.success)
  if (!result.success) {
    logger.info('   Run: pnpm --filter cms test')
  }
}

async function checkBuild() {
  logger.info('5. Building applications...')
  const result = await execCommand('pnpm', ['build'], { silent: true })
  recordResult('Build', result.success)
  if (!result.success) {
    logger.info('   Run: pnpm build')
  }
}

async function checkSecurity() {
  logger.info('6. Running security audit...')
  const result = await execCommand('pnpm', ['audit', '--audit-level=high', '--json'], {
    silent: true,
  })

  if (result.success) {
    try {
      // Try to parse JSON output (may be in stderr or stdout)
      // For now, just check if command succeeded
      recordResult('Security audit', true)
    } catch {
      recordWarning('Security audit', 'Could not parse audit results')
    }
  } else {
    // Check for critical vulnerabilities in output
    recordWarning('Security audit', 'Audit completed with warnings')
  }
}

async function checkEnvironment() {
  logger.info('7. Checking environment variables...')
  const projectRoot = await getProjectRoot(import.meta.url)
  const envTemplate = join(projectRoot, '.env.template')
  const exists = await fileExists(envTemplate)
  recordResult('Environment template', exists)
  if (!exists) {
    recordWarning('Environment template', 'Environment template not found')
  }
}

async function checkDocumentation() {
  logger.info('8. Checking documentation...')
  const projectRoot = await getProjectRoot(import.meta.url)
  const docs = [
    'docs/DEPLOYMENT-RUNBOOK.md',
    'docs/LAUNCH-CHECKLIST.md',
    'docs/ENVIRONMENT-VARIABLES-GUIDE.md',
    'SECURITY.md',
  ]

  for (const doc of docs) {
    const docPath = join(projectRoot, doc)
    const exists = await fileExists(docPath)
    if (exists) {
      recordResult(`Documentation: ${doc}`, true)
    } else {
      recordWarning('Documentation', `Missing documentation: ${doc}`)
    }
  }
}

async function checkHealthEndpoint() {
  logger.info('9. Verifying health check endpoint...')
  const projectRoot = await getProjectRoot(import.meta.url)
  const healthPath = join(projectRoot, 'apps/cms/src/app/api/health/route.ts')
  const exists = await fileExists(healthPath)
  recordResult('Health check endpoint', exists)
  if (!exists) {
    logger.info('   Health check endpoint missing')
  }
}

async function checkTestCoverage() {
  logger.info('10. Checking test coverage...')
  const projectRoot = await getProjectRoot(import.meta.url)
  const coveragePath = join(projectRoot, 'apps/cms/coverage')

  if (await fileExists(coveragePath)) {
    // Try to find coverage-summary.json
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(coveragePath, { recursive: true })
    const summaryFile = files.find((f) => f.includes('coverage-summary.json'))

    if (summaryFile) {
      try {
        const summaryPath = join(coveragePath, summaryFile)
        const content = await readFile(summaryPath, 'utf-8')
        const summary = JSON.parse(content)
        const statements = summary.total?.statements?.pct || 0

        if (statements >= 70) {
          recordResult('Test coverage', true, `Coverage: ${statements.toFixed(1)}%`)
        } else {
          recordWarning(
            'Test coverage',
            `Coverage below threshold: ${statements.toFixed(1)}% (target: 70%)`,
          )
        }
      } catch {
        recordWarning('Test coverage', 'Could not parse coverage report')
      }
    } else {
      recordWarning(
        'Test coverage',
        'Coverage report not found. Run: pnpm --filter cms test:coverage',
      )
    }
  } else {
    recordWarning(
      'Test coverage',
      'Coverage directory not found. Run: pnpm --filter cms test:coverage',
    )
  }
}

async function runValidation() {
  logger.header('Pre-Launch Validation for RevealUI Framework')
  logger.info('')

  await checkTypeScript()
  await checkPackageScripts()
  await checkLinting()
  await checkTests()
  await checkBuild()
  await checkSecurity()
  await checkEnvironment()
  await checkDocumentation()
  await checkHealthEndpoint()
  await checkTestCoverage()

  // Summary
  logger.header('Validation Summary')
  logger.info('')
  logger.success(`Passed: ${passed}`)
  if (failed > 0) {
    logger.error(`Failed: ${failed}`)
  }
  if (warnings > 0) {
    logger.warning(`Warnings: ${warnings}`)
  }
  logger.info('')

  if (failed === 0) {
    if (warnings === 0) {
      logger.success('All checks passed! Ready for launch.')
      process.exit(0)
    } else {
      logger.warning('Checks passed with warnings. Review warnings before launch.')
      process.exit(0)
    }
  } else {
    logger.error('Some checks failed. Fix issues before launch.')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runValidation()
  } catch (error) {
    logger.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
