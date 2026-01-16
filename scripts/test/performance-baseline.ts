#!/usr/bin/env tsx

/**
 * Performance Baseline Script
 *
 * Runs all performance tests and records baseline metrics
 */

import { execSync } from 'child_process'
import { resolve } from 'path'
import { writeFileSync, existsSync, mkdirSync } from 'fs'

const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
}

interface PerformanceMetrics {
  test: string
  timestamp: string
  metrics: {
    p50?: number
    p95?: number
    p99?: number
    avg?: number
    min?: number
    max?: number
    requestsPerSecond?: number
    errorRate?: number
  }
}

async function runK6Test(testFile: string): Promise<PerformanceMetrics | null> {
  logger.info(`Running ${testFile}...`)

  try {
    const output = execSync(`k6 run --out json=${testFile}.json ${testFile}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    // Parse k6 output (simplified - would need proper parsing)
    // For now, return basic structure
    return {
      test: testFile,
      timestamp: new Date().toISOString(),
      metrics: {
        // Would parse actual metrics from k6 output
        p95: 0,
        avg: 0,
      },
    }
  } catch (error) {
    logger.error(`Test failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

async function main() {
  logger.info('Running performance baseline tests...')

  const projectRoot = resolve(__dirname, '../..')
  const testsDir = resolve(projectRoot, 'tests/performance')
  const baselineFile = resolve(projectRoot, 'tests/performance/baseline.json')

  // Ensure tests directory exists
  if (!existsSync(testsDir)) {
    mkdirSync(testsDir, { recursive: true })
  }

  const testFiles = [
    resolve(testsDir, 'auth-load.js'),
    resolve(testsDir, 'cms-load.js'),
    resolve(testsDir, 'ai-load.js'),
  ]

  const results: PerformanceMetrics[] = []

  for (const testFile of testFiles) {
    if (!existsSync(testFile)) {
      logger.warn(`Test file not found: ${testFile}`)
      continue
    }

    const result = await runK6Test(testFile)
    if (result) {
      results.push(result)
    }
  }

  // Save baseline
  const baseline = {
    timestamp: new Date().toISOString(),
    results,
  }

  writeFileSync(baselineFile, JSON.stringify(baseline, null, 2))
  logger.success(`Baseline saved to ${baselineFile}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
