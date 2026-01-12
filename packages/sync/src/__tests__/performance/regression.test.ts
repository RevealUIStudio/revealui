/**
 * Performance Regression Tests
 *
 * Compares performance against baseline metrics to verify improvements
 * and detect regressions after upgrading to ElectricSQL 1.1+.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AgentMemory } from '../../schema'
import { createAgentMemory, updateAgentMemory } from '../../utils/revealui-api'

// Test timeout for performance tests
const PERFORMANCE_TEST_TIMEOUT = 60000 // 60 seconds

// Skip if test server is not available
const TEST_SERVER_URL =
  process.env.REVEALUI_TEST_SERVER_URL ||
  process.env.REVEALUI_PUBLIC_SERVER_URL ||
  'http://localhost:4000'

const shouldSkipTests =
  !process.env.REVEALUI_TEST_SERVER_URL && !process.env.REVEALUI_PUBLIC_SERVER_URL

// Baseline metrics (from PERFORMANCE_BASELINE.md)
// These should be updated after running baseline tests
interface BaselineMetrics {
  addMemory: {
    average: number
    min: number
    max: number
  }
  updateMemory: {
    average: number
    min: number
    max: number
  }
}

// Placeholder baseline - should be updated from actual baseline test results
const BASELINE_METRICS: BaselineMetrics = {
  addMemory: {
    average: 500, // Placeholder - update from baseline
    min: 100, // Placeholder - update from baseline
    max: 2000, // Placeholder - update from baseline
  },
  updateMemory: {
    average: 400, // Placeholder - update from baseline
    min: 80, // Placeholder - update from baseline
    max: 1500, // Placeholder - update from baseline
  },
}

describe.skipIf(shouldSkipTests)('Performance Regression Tests', () => {
  const testUserId = `perf-regression-user-${Date.now()}`
  const testAgentId = `perf-regression-agent-${Date.now()}`

  beforeAll(async () => {
    // Verify server is accessible
    try {
      const response = await fetch(`${TEST_SERVER_URL}/api/conversations`, {
        signal: AbortSignal.timeout(5000),
      })
      if (response.status === 404) {
        throw new Error(`Endpoint not found at ${TEST_SERVER_URL}`)
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED'))
      ) {
        throw new Error(
          `Cannot connect to test server at ${TEST_SERVER_URL}. ` +
            `Start the CMS server with: pnpm --filter cms dev\n` +
            `Or unset REVEALUI_TEST_SERVER_URL to skip these tests.\n` +
            `Error: ${error.message}`,
        )
      }
      throw error
    }
  }, PERFORMANCE_TEST_TIMEOUT)

  afterAll(() => {
    console.log('\n=== Performance Regression Analysis ===')
    console.log('Compare current metrics against baseline in PERFORMANCE_BASELINE.md')
    console.log('Expected improvement with ElectricSQL 1.1+: Up to 100x faster writes')
    console.log('========================================\n')
  })

  it(
    'should not regress from baseline addMemory performance',
    async () => {
      const iterations = 10
      const latencies: number[] = []

      for (let i = 0; i < iterations; i++) {
        const memoryId = `perf-regression-add-${Date.now()}-${i}`
        const memory: Omit<AgentMemory, 'id' | 'created_at'> = {
          agent_id: testAgentId,
          content: `Regression test memory ${i}`,
          type: 'test',
          verified: false,
          metadata: { test: true, regression: true },
        }

        const startTime = performance.now()
        await createAgentMemory(testUserId, { ...memory, id: memoryId }, undefined)
        const endTime = performance.now()
        latencies.push(endTime - startTime)
      }

      const averageLatency = average(latencies)
      const maxLatency = Math.max(...latencies)

      // Verify performance is reasonable (not worse than baseline * 2)
      // With 1.1+ improvements, should be better than baseline
      const threshold = BASELINE_METRICS.addMemory.average * 2

      expect(averageLatency).toBeLessThan(threshold)
      expect(maxLatency).toBeLessThan(BASELINE_METRICS.addMemory.max * 2)

      // Log comparison
      console.log(
        `addMemory: Current avg=${averageLatency.toFixed(2)}ms, ` +
          `Baseline avg=${BASELINE_METRICS.addMemory.average}ms, ` +
          `Improvement=${((BASELINE_METRICS.addMemory.average / averageLatency) * 100).toFixed(1)}%`,
      )
    },
    PERFORMANCE_TEST_TIMEOUT,
  )

  it(
    'should not regress from baseline updateMemory performance',
    async () => {
      // Create a memory to update
      const memoryId = `perf-regression-update-${Date.now()}`
      const initialMemory: Omit<AgentMemory, 'id' | 'created_at'> = {
        agent_id: testAgentId,
        content: 'Initial content for regression test',
        type: 'test',
        verified: false,
        metadata: { test: true },
      }

      await createAgentMemory(testUserId, { ...initialMemory, id: memoryId }, undefined)

      const iterations = 10
      const latencies: number[] = []

      for (let i = 0; i < iterations; i++) {
        const updates = {
          content: `Updated content ${i}`,
          metadata: { test: true, iteration: i },
        }

        const startTime = performance.now()
        await updateAgentMemory(testUserId, memoryId, updates, undefined)
        const endTime = performance.now()
        latencies.push(endTime - startTime)
      }

      const averageLatency = average(latencies)
      const maxLatency = Math.max(...latencies)

      // Verify performance is reasonable
      const threshold = BASELINE_METRICS.updateMemory.average * 2

      expect(averageLatency).toBeLessThan(threshold)
      expect(maxLatency).toBeLessThan(BASELINE_METRICS.updateMemory.max * 2)

      // Log comparison
      console.log(
        `updateMemory: Current avg=${averageLatency.toFixed(2)}ms, ` +
          `Baseline avg=${BASELINE_METRICS.updateMemory.average}ms, ` +
          `Improvement=${((BASELINE_METRICS.updateMemory.average / averageLatency) * 100).toFixed(1)}%`,
      )
    },
    PERFORMANCE_TEST_TIMEOUT,
  )

  it(
    'should document performance improvements',
    async () => {
      // Run a quick performance test
      const iterations = 5
      const latencies: number[] = []

      for (let i = 0; i < iterations; i++) {
        const memoryId = `perf-doc-${Date.now()}-${i}`
        const memory: Omit<AgentMemory, 'id' | 'created_at'> = {
          agent_id: testAgentId,
          content: `Documentation test ${i}`,
          type: 'test',
          verified: false,
          metadata: { test: true },
        }

        const startTime = performance.now()
        await createAgentMemory(testUserId, { ...memory, id: memoryId }, undefined)
        const endTime = performance.now()
        latencies.push(endTime - startTime)
      }

      const avgLatency = average(latencies)

      // Document performance
      console.log('\n=== Performance Documentation ===')
      console.log(`Current average latency: ${avgLatency.toFixed(2)}ms`)
      console.log(`Baseline average latency: ${BASELINE_METRICS.addMemory.average}ms`)
      console.log(
        `Improvement: ${((BASELINE_METRICS.addMemory.average / avgLatency) * 100).toFixed(1)}%`,
      )
      console.log('Expected with ElectricSQL 1.1+: Up to 100x faster')
      console.log('==================================\n')

      // Verify performance is reasonable
      expect(avgLatency).toBeLessThan(5000)
    },
    PERFORMANCE_TEST_TIMEOUT,
  )
})

/**
 * Helper function to calculate average
 */
function average(numbers: number[]): number {
  if (numbers.length === 0) return 0
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length
}

/**
 * Note: Update BASELINE_METRICS after running baseline tests.
 * These metrics should be updated from actual PERFORMANCE_BASELINE.md results.
 */
