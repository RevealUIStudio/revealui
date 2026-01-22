#!/usr/bin/env tsx

/**
 * Performance Baseline Script
 *
 * Runs all performance tests and records baseline metrics
 */

console.log('🚀 Performance baseline script starting...')

import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
// Temporarily use console.log instead of shared logger to debug
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

async function runAutocannonTest(endpointName: string, endpointConfig: any): Promise<PerformanceMetrics | null> {
  logger.info(`Running ${endpointName}...`)

  try {
    // Check if DRY_RUN environment variable is set
    if (process.env.DRY_RUN === 'true') {
      logger.info(`DRY RUN: Would test ${endpointConfig.method} ${endpointConfig.url}`)
      // Return mock data for testing
      return {
        test: endpointName,
        timestamp: new Date().toISOString(),
        metrics: {
          p50: Math.floor(Math.random() * 500) + 100,
          p95: Math.floor(Math.random() * 1000) + 500,
          p99: Math.floor(Math.random() * 1500) + 1000,
          avg: Math.floor(Math.random() * 600) + 200,
          min: Math.floor(Math.random() * 100) + 50,
          max: Math.floor(Math.random() * 2000) + 1000,
          requestsPerSecond: Math.floor(Math.random() * 50) + 10,
          errorRate: Math.random() * 0.05,
        },
      }
    }

    // Build autocannon command
    const baseUrl = process.env.BASE_URL || 'http://localhost:4000'
    const url = endpointConfig.url.replace('http://localhost:4000', baseUrl)

    let cmd = `npx autocannon --json`

    // Add method if not GET
    if (endpointConfig.method && endpointConfig.method !== 'GET') {
      cmd += ` --method ${endpointConfig.method}`
    }

    // Add headers
    if (endpointConfig.headers) {
      Object.entries(endpointConfig.headers).forEach(([key, value]: [string, any]) => {
        // Replace placeholders
        const processedValue = value.replace('{TEST_TOKEN}', process.env.TEST_TOKEN || 'test-token')
        cmd += ` --header "${key}: ${processedValue}"`
      })
    }

    // Add body for POST requests
    if (endpointConfig.body) {
      const bodyStr = JSON.stringify(endpointConfig.body)
      cmd += ` --body '${bodyStr}'`
    }

    // Add test parameters
    cmd += ` --duration ${endpointConfig.duration || 30}`
    cmd += ` --connections ${endpointConfig.connections || 10}`
    cmd += ` --pipelining ${endpointConfig.pipelining || 1}`
    cmd += ` --bailout ${endpointConfig.bailout || 5}`

    // Add URL
    cmd += ` ${url}`

    // Run autocannon
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    // Parse autocannon JSON output
    const results = JSON.parse(output)

    // Extract metrics from autocannon format
    const result: PerformanceMetrics = {
      test: endpointName,
      timestamp: new Date().toISOString(),
      metrics: {
        p50: results.latency.p50 || 0,
        p95: results.latency.p95 || 0,
        p99: results.latency.p99 || 0,
        avg: results.latency.average || 0,
        min: results.latency.min || 0,
        max: results.latency.max || 0,
        requestsPerSecond: results.requests.average || 0,
        errorRate: (results.errors || 0) / (results.requests.total || 1), // Calculate error rate
      },
    }

    logger.success(`Completed ${endpointName} - p95: ${result.metrics.p95.toFixed(0)}ms, RPS: ${result.metrics.requestsPerSecond.toFixed(1)}, errors: ${(result.metrics.errorRate * 100).toFixed(2)}%`)
    return result

  } catch (error) {
    logger.error(`Test failed for ${endpointName}: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

async function main() {
  logger.info('Running performance baseline tests...')

  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const testsDir = resolve(projectRoot, 'packages/test/load-tests')
  const baselineFile = resolve(projectRoot, 'packages/test/load-tests/baseline.json')
  const endpointsFile = resolve(testsDir, 'endpoints.json')

  // Load endpoints configuration
  if (!existsSync(endpointsFile)) {
    logger.error(`Endpoints configuration not found: ${endpointsFile}`)
    logger.info('Please ensure endpoints.json exists in packages/test/load-tests/')
    process.exit(1)
  }

  const endpointsConfig = JSON.parse(readFileSync(endpointsFile, 'utf-8'))
  logger.info(`Loaded ${Object.keys(endpointsConfig).length} endpoint configurations`)

  const results: PerformanceMetrics[] = []

  // Run tests for each endpoint
  for (const [endpointName, config] of Object.entries(endpointsConfig)) {
    const result = await runAutocannonTest(endpointName, config)
    if (result) {
      results.push(result)
    }
  }

  if (results.length === 0) {
    logger.error('No tests completed successfully')
    process.exit(1)
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

  logger.success(`Baseline saved to ${baselineFile} with ${results.length} test results`)
  logger.success(`Current results saved to ${currentResultsFile}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
