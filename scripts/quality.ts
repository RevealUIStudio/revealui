#!/usr/bin/env tsx

import { spawn } from 'child_process'
// import { readFileSync } from 'fs'
import { join } from 'path'

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
    ci: args.includes('--ci')
  }
}

async function runQualityCheck(
  command: string,
  args: string[],
  options: {
    description: string
    fixable?: boolean
    ci?: boolean
  }
): Promise<{ code: number; output?: string }> {
  return new Promise((resolve) => {
    console.log(`${options.ci ? '🤖' : '🔍'} ${options.description}...`)

    const child = spawn(command, args, {
      stdio: options.ci ? 'pipe' : 'inherit',
      env: process.env
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
      const status = success ? '✅' : (options.fixable ? '⚠️' : '❌')

      if (options.ci) {
        console.log(`${status} ${options.description}`)
        if (!success && stderr) {
          console.error(stderr)
        }
      }

      resolve({
        code: code || 0,
        output: stdout + stderr
      })
    })

    child.on('error', (error) => {
      console.error(`❌ Failed to run ${options.description}:`, error.message)
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
      passed: results.filter(r => r.code === 0).length,
      failed: results.filter(r => r.code !== 0).length
    },
    results: results.map(r => ({
      check: r.name,
      status: r.code === 0 ? 'passed' : 'failed',
      code: r.code
    }))
  }

  require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`📊 Quality report saved to: ${reportPath}`)
}

async function main() {
  const options = parseArgs()

  console.log('🛡️  RevealUI Quality Assurance')
  console.log('==============================\n')

  const results = []

  // TypeScript type checking
  const typeCheckArgs = ['typecheck']
  const typeCheckResult = await runQualityCheck('pnpm', typeCheckArgs, {
    description: 'TypeScript type checking',
    ci: options.ci
  })
  results.push({ name: 'TypeScript', code: typeCheckResult.code })

  if (typeCheckResult.code !== 0 && !options.ci) {
    console.log('\n💡 Tip: Run `pnpm typecheck` to see detailed type errors\n')
  }

  // Biome checking (formatting + fast linting) - Industry Standard 2025
  const biomeArgs = ['biome', 'check', '.']
  if (options.fix) {
    biomeArgs.push('--write')
  }

  const biomeResult = await runQualityCheck('npx', biomeArgs, {
    description: 'Biome formatting and fast linting (30x faster than Prettier)',
    fixable: true,
    ci: options.ci
  })
  results.push({ name: 'Biome', code: biomeResult.code })

  // ESLint checking (advanced TypeScript/React rules) - Industry Standard 2025
  const eslintArgs = ['eslint', '.']
  if (options.fix) {
    eslintArgs.push('--fix')
  }

  const eslintResult = await runQualityCheck('npx', eslintArgs, {
    description: 'ESLint advanced TypeScript/React code quality checks',
    fixable: true,
    ci: options.ci
  })
  results.push({ name: 'ESLint', code: eslintResult.code })

  // TypeScript type checking - Industry Standard 2025
  if (!options.ci || options.strict) {
    const tscResult = await runQualityCheck('npx', ['tsc', '--noEmit'], {
      description: 'TypeScript strict type checking',
      ci: options.ci
    })
    results.push({ name: 'TypeScript', code: tscResult.code })
  }

  if (eslintResult.code !== 0 && !options.fix && !options.ci) {
    console.log('\n💡 Tip: Run `tsx scripts/quality.ts --fix` to auto-fix lint issues\n')
  }

  // Package audit (if in CI or strict mode)
  if (options.ci || options.strict) {
    const auditResult = await runQualityCheck('pnpm', ['audit'], {
      description: 'Dependency security audit',
      ci: options.ci
    })
    results.push({ name: 'Security Audit', code: auditResult.code })
  }

  // Generate summary
  const passed = results.filter(r => r.code === 0).length
  const total = results.length

  console.log('\n📈 Quality Check Summary')
  console.log('========================')
  console.log(`   Passed: ${passed}/${total}`)
  console.log(`   Failed: ${total - passed}/${total}`)

  if (options.ci) {
    await generateReport(results)
  }

  if (passed === total) {
    console.log('\n🎉 All quality checks passed!')
    process.exit(0)
  } else {
    console.log('\n❌ Some quality checks failed.')
    if (!options.fix) {
      console.log('   Run with --fix to auto-fix issues where possible.')
    }
    process.exit(1)
  }
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Quality script failed:', error)
    process.exit(1)
  })
}
