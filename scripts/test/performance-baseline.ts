#!/usr/bin/env tsx

/**
 * Performance Baseline Script
 *
 * Runs all performance tests and records baseline metrics
 */

import { execSync } from 'child_process'
import { resolve } from 'path'
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs'

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
    p50: number
    p95: number
    p99: number
    avg: number
    min: number
    max: number
    requestsPerSecond: number
    errorRate: number
  }
}

async function runK6Test(testFile: string): Promise<PerformanceMetrics | null> {
  logger.info(`Running ${testFile}...`)

  const jsonOutputFile = `${testFile}.json`

  try {
    // Run k6 test and output results to JSON
    execSync(`k6 run --out json=${jsonOutputFile} ${testFile}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    // Read and parse the JSON output
    const jsonContent = readFileSync(jsonOutputFile, 'utf-8')
    const k6Results = JSON.parse(jsonContent)

    // Extract relevant metrics from k6 output
    const metrics = k6Results.metrics || {}

    // Helper function to get metric value
    const getMetricValue = (metricName: string, aggregator: string = 'avg') => {
      const metric = metrics[metricName]
      if (metric && metric.values && metric.values[aggregator] !== undefined) {
        return metric.values[aggregator]
      }
      return 0
    }

    // Extract key performance metrics
    const result: PerformanceMetrics = {
      test: testFile,
      timestamp: new Date().toISOString(),
      metrics: {
        p50: getMetricValue('http_req_duration', 'p(50)'),
        p95: getMetricValue('http_req_duration', 'p(95)'),
        p99: getMetricValue('http_req_duration', 'p(99)'),
        avg: getMetricValue('http_req_duration', 'avg'),
        min: getMetricValue('http_req_duration', 'min'),
        max: getMetricValue('http_req_duration', 'max'),
        requestsPerSecond: getMetricValue('http_req_rate', 'rate'),
        errorRate: getMetricValue('http_req_failed', 'rate'),
      },
    }

    // Clean up JSON file
    try {
      execSync(`rm ${jsonOutputFile}`)
    } catch {
      // Ignore cleanup errors
    }

    logger.success(`Completed ${testFile} - p95: ${result.metrics.p95}ms, error rate: ${(result.metrics.errorRate * 100).toFixed(2)}%`)
    return result

  } catch (error) {
    logger.error(`Test failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

async function main() {
  logger.info('Running performance baseline tests...')

  const projectRoot = resolve(__dirname, '../..')
  const testsDir = resolve(projectRoot, 'packages/test/load-tests')
  const baselineFile = resolve(projectRoot, 'packages/test/load-tests/baseline.json')

  // Ensure tests directory exists
  if (!existsSync(testsDir)) {
    mkdirSync(testsDir, { recursive: true })
  }

  const testFiles = [
    resolve(testsDir, 'auth/auth-load.js'),
    resolve(testsDir, 'cms/cms-load.js'),
    resolve(testsDir, 'ai/ai-load.js'),
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

  // Also save current results for regression testing
  const currentResultsFile = resolve(projectRoot, 'packages/test/load-tests/current-results.json')
  writeFileSync(currentResultsFile, JSON.stringify(baseline, null, 2))

  logger.success(`Baseline saved to ${baselineFile}`)
  logger.success(`Current results saved to ${currentResultsFile}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
