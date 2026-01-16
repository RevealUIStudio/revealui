/**
 * Authentication Performance Analysis Script
 *
 * Analyzes performance metrics and identifies bottlenecks.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface PerformanceMetrics {
  endpoint: string
  p50: number
  p95: number
  p99: number
  avg: number
  min: number
  max: number
  throughput: number
  errorRate: number
  totalRequests: number
}

interface PerformanceReport {
  timestamp: string
  tests: {
    signIn?: PerformanceMetrics
    signUp?: PerformanceMetrics
    sessionValidation?: PerformanceMetrics
    rateLimiting?: PerformanceMetrics
    stress?: PerformanceMetrics
  }
  bottlenecks: string[]
  recommendations: string[]
  overallScore: number
}

/**
 * Parse k6 JSON output and extract metrics
 */
function parseK6Output(jsonOutput: any): PerformanceMetrics | null {
  try {
    const metrics = jsonOutput.metrics
    const httpReqDuration = metrics.http_req_duration?.values || {}
    const httpReqs = metrics.http_reqs?.values || {}
    const httpReqFailed = metrics.http_req_failed?.values || {}

    return {
      endpoint: jsonOutput.name || 'unknown',
      p50: httpReqDuration['med'] || 0,
      p95: httpReqDuration['p(95)'] || 0,
      p99: httpReqDuration['p(99)'] || 0,
      avg: httpReqDuration['avg'] || 0,
      min: httpReqDuration['min'] || 0,
      max: httpReqDuration['max'] || 0,
      throughput: httpReqs['rate'] || 0,
      errorRate: httpReqFailed['rate'] || 0,
      totalRequests: httpReqs['count'] || 0,
    }
  } catch (error) {
    console.error('Error parsing k6 output:', error)
    return null
  }
}

/**
 * Analyze performance and identify bottlenecks
 */
function analyzePerformance(metrics: PerformanceMetrics[]): {
  bottlenecks: string[]
  recommendations: string[]
  overallScore: number
} {
  const bottlenecks: string[] = []
  const recommendations: string[] = []
  let score = 100

  // Performance targets
  const targets = {
    signIn: { p95: 1500, p99: 3000, throughput: 10 },
    signUp: { p95: 2000, p99: 4000, throughput: 5 },
    sessionValidation: { p95: 500, p99: 1000, throughput: 50 },
  }

  for (const metric of metrics) {
    const endpoint = metric.endpoint.toLowerCase()

    // Check response times
    if (metric.p95 > 2000) {
      bottlenecks.push(`${endpoint}: p95 response time (${metric.p95}ms) exceeds 2s`)
      score -= 10
      recommendations.push(`Optimize ${endpoint} endpoint - consider database query optimization or caching`)
    }

    if (metric.p99 > 5000) {
      bottlenecks.push(`${endpoint}: p99 response time (${metric.p99}ms) exceeds 5s`)
      score -= 15
      recommendations.push(`Critical: ${endpoint} has very slow tail latency - investigate database or network issues`)
    }

    // Check error rate
    if (metric.errorRate > 0.01) {
      bottlenecks.push(`${endpoint}: error rate (${(metric.errorRate * 100).toFixed(2)}%) exceeds 1%`)
      score -= 20
      recommendations.push(`Fix errors in ${endpoint} - check logs for root cause`)
    }

    // Check throughput
    if (endpoint.includes('signin') && metric.throughput < targets.signIn.throughput) {
      bottlenecks.push(`${endpoint}: throughput (${metric.throughput.toFixed(2)} req/s) below target (${targets.signIn.throughput} req/s)`)
      score -= 5
      recommendations.push(`Improve ${endpoint} throughput - consider connection pooling or async processing`)
    }
  }

  return {
    bottlenecks,
    recommendations,
    overallScore: Math.max(0, score),
  }
}

/**
 * Generate performance report
 */
export function generatePerformanceReport(
  testResults: Array<{ name: string; output: any }>
): PerformanceReport {
  const metrics: PerformanceMetrics[] = []
  const tests: PerformanceReport['tests'] = {}

  for (const result of testResults) {
    const metric = parseK6Output(result.output)
    if (metric) {
      metrics.push(metric)
      
      if (result.name.includes('sign-in')) {
        tests.signIn = metric
      } else if (result.name.includes('sign-up')) {
        tests.signUp = metric
      } else if (result.name.includes('session')) {
        tests.sessionValidation = metric
      } else if (result.name.includes('rate')) {
        tests.rateLimiting = metric
      } else if (result.name.includes('stress')) {
        tests.stress = metric
      }
    }
  }

  const analysis = analyzePerformance(metrics)

  return {
    timestamp: new Date().toISOString(),
    tests,
    ...analysis,
  }
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Analyzing authentication performance...\n')

  // This would typically read from k6 JSON output files
  // For now, this is a template for future use
  console.log('📊 Performance analysis script ready')
  console.log('   Run k6 tests with --out json=results.json')
  console.log('   Then run: tsx scripts/performance/analyze-auth-performance.ts')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
