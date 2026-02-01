#!/usr/bin/env tsx

/**
 * Performance Baseline Analysis Script
 * Analyzes existing baseline data to recommend performance budgets
 *
 * Usage:
 *   pnpm tsx scripts/test/analyze-performance-baseline.ts
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ErrorCode } from '../../lib/errors.js'
import { createLogger, getProjectRoot } from '../../utils/base.ts'

const logger = createLogger()

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

interface BaselineData {
  timestamp: string
  results: PerformanceMetrics[]
}

type AnalysisResult = ReturnType<typeof analyzeMetrics>
type Analysis = NonNullable<AnalysisResult>

function analyzeMetrics(metrics: PerformanceMetrics[], testName: string) {
  if (metrics.length === 0) {
    logger.info(`No data available for ${testName}`)
    return null
  }

  // Extract all p95 values
  const p95Values = metrics.map((m) => m.metrics.p95).sort((a, b) => a - b)
  const errorRates = metrics.map((m) => m.metrics.errorRate).sort((a, b) => a - b)

  // Calculate statistics
  const avgP95 = p95Values.reduce((a, b) => a + b, 0) / p95Values.length
  const medianP95 = p95Values[Math.floor(p95Values.length / 2)]
  const p95Percentile = p95Values[Math.floor(p95Values.length * 0.95)] // 95th percentile of p95s

  const avgErrorRate = errorRates.reduce((a, b) => a + b, 0) / errorRates.length
  const medianErrorRate = errorRates[Math.floor(errorRates.length / 2)]
  const maxErrorRate = Math.max(...errorRates)

  // Calculate recommended budgets
  // Use 95th percentile of p95 values as baseline, add 25% buffer for regression detection
  const recommendedP95Budget = Math.ceil(p95Percentile * 1.25)
  // For error rates, use max observed + small buffer, but minimum 1%
  const recommendedErrorBudget = Math.max(maxErrorRate * 1.1, 0.01)

  return {
    testName,
    sampleSize: metrics.length,
    currentMetrics: {
      avgP95: Math.round(avgP95),
      medianP95: Math.round(medianP95),
      p95Percentile: Math.round(p95Percentile),
      avgErrorRate: `${(avgErrorRate * 100).toFixed(2)}%`,
      medianErrorRate: `${(medianErrorRate * 100).toFixed(2)}%`,
      maxErrorRate: `${(maxErrorRate * 100).toFixed(2)}%`,
    },
    recommendedBudgets: {
      p95: recommendedP95Budget,
      errorRate: recommendedErrorBudget,
    },
    dataRange: {
      minP95: Math.min(...p95Values),
      maxP95: Math.max(...p95Values),
      minErrorRate: `${(Math.min(...errorRates) * 100).toFixed(2)}%`,
      maxErrorRate: `${(maxErrorRate * 100).toFixed(2)}%`,
    },
  }
}

function generateUpdatedBudgets(analyses: Analysis[]) {
  const productionBudgets: Record<string, { p95: number; errorRate: number }> = {}
  const stagingBudgets: Record<string, { p95: number; errorRate: number }> = {}

  analyses.forEach((analysis) => {
    if (!analysis) return

    const testName = analysis.testName
    const prodP95 = analysis.recommendedBudgets.p95
    const prodError = analysis.recommendedBudgets.errorRate

    productionBudgets[testName] = {
      p95: prodP95,
      errorRate: prodError,
    }

    // Staging gets 50% more time and 2x error rate tolerance
    stagingBudgets[testName] = {
      p95: Math.ceil(prodP95 * 1.5),
      errorRate: Math.min(prodError * 2, 0.15), // Cap at 15%
    }
  })

  return { productionBudgets, stagingBudgets }
}

async function main() {
  try {
    const projectRoot = await getProjectRoot(import.meta.url)
    logger.header('Performance Baseline Analysis')

    const baselineFile = resolve(projectRoot, 'packages/test/load-tests/baseline.json')

    if (!existsSync(baselineFile)) {
      logger.error('No baseline file found. Run performance tests first to generate baseline data.')
      logger.info('Run: pnpm test:performance')
      process.exit(ErrorCode.CONFIG_ERROR)
    }

    // Load baseline data
    const baselineContent = readFileSync(baselineFile, 'utf-8')
    const baseline: BaselineData = JSON.parse(baselineContent)

    logger.info(`Analyzing baseline from ${baseline.timestamp}`)
    logger.info(`Found ${baseline.results.length} test results`)

    // Group results by endpoint (no path prefix to remove)
    const testGroups: Record<string, PerformanceMetrics[]> = {}
    baseline.results.forEach((result) => {
      const testKey = result.test
      if (!testGroups[testKey]) {
        testGroups[testKey] = []
      }
      testGroups[testKey].push(result)
    })

    logger.header('Performance Analysis Results')
    logger.info('')

    const analyses = Object.keys(testGroups)
      .map((testName) => {
        const analysis = analyzeMetrics(testGroups[testName], testName)

        if (analysis) {
          logger.info(`📊 ${testName}:`)
          logger.info(`   Sample Size: ${analysis.sampleSize} runs`)
          logger.info(
            `   Current P95: avg=${analysis.currentMetrics.avgP95}ms, median=${analysis.currentMetrics.medianP95}ms, 95th%ile=${analysis.currentMetrics.p95Percentile}ms`,
          )
          logger.info(
            `   Error Rates: avg=${analysis.currentMetrics.avgErrorRate}, median=${analysis.currentMetrics.medianErrorRate}, max=${analysis.currentMetrics.maxErrorRate}`,
          )
          logger.info(
            `   Data Range: P95 ${analysis.dataRange.minP95}ms - ${analysis.dataRange.maxP95}ms`,
          )
          logger.info(
            `   Recommended Budgets: P95 ≤${analysis.recommendedBudgets.p95}ms, Error Rate ≤${(analysis.recommendedBudgets.errorRate * 100).toFixed(1)}%`,
          )
          logger.info('')
        }

        return analysis
      })
      .filter((analysis): analysis is Analysis => analysis !== null)

    // Generate updated budget configurations
    const { productionBudgets, stagingBudgets } = generateUpdatedBudgets(analyses)

    logger.header('Recommended Budget Updates')
    logger.info('')
    logger.info('// Add these to scripts/test/performance-regression.ts')
    logger.info('')

    logger.info('Copy these into scripts/test/performance-regression.ts:')
    logger.info('')
    logger.info('PRODUCTION_BUDGETS = {')
    Object.entries(productionBudgets).forEach(([test, budget]) => {
      logger.info(
        `  '${test}': { p95: ${budget.p95}, errorRate: ${budget.errorRate.toFixed(3)} }, // ${(budget.p95 / 1000).toFixed(1)}s p95, ${(budget.errorRate * 100).toFixed(1)}% error rate`,
      )
    })
    logger.info('}')
    logger.info('')

    logger.info('STAGING_BUDGETS = {')
    Object.entries(stagingBudgets).forEach(([test, budget]) => {
      logger.info(
        `  '${test}': { p95: ${budget.p95}, errorRate: ${budget.errorRate.toFixed(3)} }, // ${(budget.p95 / 1000).toFixed(1)}s p95, ${(budget.errorRate * 100).toFixed(1)}% error rate`,
      )
    })
    logger.info('}')

    logger.success(
      'Analysis complete! Update the budgets in performance-regression.ts with the recommendations above.',
    )
  } catch (error) {
    logger.error(`Analysis failed: ${error}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  })
}
