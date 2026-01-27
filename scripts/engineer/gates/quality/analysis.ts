#!/usr/bin/env tsx
/**
 * Code Quality Check Script
 *
 * Runs various quality checks: TypeScript, linting, formatting, etc.
 *
 * Usage:
 *   pnpm tsx scripts/analysis/quality.ts [--fix] [--strict] [--ci]
 */

import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { createLogger, getProjectRoot } from '../typed/shared/utils.ts'

const logger = createLogger()

interface QualityOptions {
  fix?: boolean
  strict?: boolean
  ci?: boolean
}

function parseArgs(): QualityOptions {
  const args = process.argv.slice(2)
  return {
    fix: args.includes('--fix'),
    strict: args.includes('--strict'),
    ci: args.includes('--ci'),
  }
}

async function runQualityCheck(
  command: string,
  args: string[],
  options: {
    description: string
    fixable?: boolean
    ci?: boolean
  },
): Promise<{ code: number; output?: string }> {
  return new Promise((resolve) => {
    logger.info(`${options.ci ? '🤖' : '🔍'} ${options.description}...`)

    const child = spawn(command, args, {
      stdio: options.ci ? 'pipe' : 'inherit',
      env: process.env,
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      const success = code === 0
      const _status = success ? '✅' : options.fixable ? '⚠️' : '❌'

      if (options.ci) {
        if (success) {
          logger.success(`${options.description}`)
        } else {
          logger.error(`${options.description}`)
        }
        if (!success && stderr) {
          logger.error(stderr)
        }
      }

      resolve({
        code: code || 0,
        output: stdout + stderr,
      })
    })

    child.on('error', (error) => {
      logger.error(`Failed to run ${options.description}: ${error.message}`)
      resolve({ code: 1 })
    })
  })
}

async function generateReport(results: Array<{ name: string; code: number; output?: string }>) {
  const reportPath = join(process.cwd(), 'quality-report.json')

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((r) => r.code === 0).length,
      failed: results.filter((r) => r.code !== 0).length,
    },
    results: results.map((r) => ({
      check: r.name,
      status: r.code === 0 ? 'passed' : 'failed',
      code: r.code,
    })),
  }

  const { writeFileSync } = await import('node:fs')
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  logger.success(`📊 Quality report saved to: ${reportPath}`)
}

async function runQualityChecks(options: QualityOptions) {
  logger.header('RevealUI Quality Assurance')

  const results = []

  // TypeScript type checking
  const typeCheckArgs = ['typecheck']
  const typeCheckResult = await runQualityCheck('pnpm', typeCheckArgs, {
    description: 'TypeScript type checking',
    ci: options.ci,
  })
  results.push({ name: 'TypeScript', code: typeCheckResult.code })

  if (typeCheckResult.code !== 0 && !options.ci) {
    logger.info('\n💡 Tip: Run `pnpm typecheck` to see detailed type errors\n')
  }

  // Biome checking (formatting + fast linting) - Industry Standard 2025
  const biomeArgs = ['biome', 'check', '.']
  if (options.fix) {
    biomeArgs.push('--write')
  }

  const biomeResult = await runQualityCheck('pnpm', ['dlx', ...biomeArgs], {
    description: 'Biome formatting and fast linting (30x faster than Prettier)',
    fixable: true,
    ci: options.ci,
  })
  results.push({ name: 'Biome', code: biomeResult.code })

  // ESLint checking (advanced TypeScript/React rules) - Industry Standard 2025
  const eslintArgs = ['lint:eslint']
  if (options.fix) {
    eslintArgs.push('--', '--fix')
  }

  const eslintResult = await runQualityCheck('pnpm', eslintArgs, {
    description: 'ESLint advanced TypeScript code quality checks (per-package)',
    fixable: true,
    ci: options.ci,
  })
  results.push({ name: 'ESLint', code: eslintResult.code })

  // TypeScript type checking - Industry Standard 2025
  if (!options.ci || options.strict) {
    const tscResult = await runQualityCheck('pnpm', ['dlx', 'tsc', '--noEmit'], {
      description: 'TypeScript strict type checking',
      ci: options.ci,
    })
    results.push({ name: 'TypeScript', code: tscResult.code })
  }

  if (eslintResult.code !== 0 && !options.fix && !options.ci) {
    logger.info('\n💡 Tip: Run `tsx scripts/analysis/quality.ts --fix` to auto-fix lint issues\n')
  }

  // Package audit (if in CI or strict mode)
  if (options.ci || options.strict) {
    const auditResult = await runQualityCheck('pnpm', ['audit'], {
      description: 'Dependency security audit',
      ci: options.ci,
    })
    results.push({ name: 'Security Audit', code: auditResult.code })
  }

  // Generate summary
  const passed = results.filter((r) => r.code === 0).length
  const total = results.length

  logger.header('Quality Check Summary')
  logger.info(`   Passed: ${passed}/${total}`)
  logger.info(`   Failed: ${total - passed}/${total}`)

  if (options.ci) {
    await generateReport(results)
  }

  if (passed === total) {
    logger.success('\n🎉 All quality checks passed!')
    process.exit(0)
  } else {
    logger.error('\n❌ Some quality checks failed.')
    if (!options.fix) {
      logger.info('   Run with --fix to auto-fix issues where possible.')
    }
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await getProjectRoot(import.meta.url)
    const options = parseArgs()
    await runQualityChecks(options)
  } catch (error) {
    logger.error(`Quality script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
