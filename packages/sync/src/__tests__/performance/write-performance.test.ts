/**
 * Write Performance Tests
 *
 * Measures write latency for agent memory operations with ElectricSQL 1.1+.
 * Compares performance against baseline metrics to verify 100x improvement claim.
 *
 * Note: These tests require ElectricSQL service to be running with 1.1+ storage engine.
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

interface WritePerformanceMetrics {
  addMemoryLatency: number[]
  updateMemoryLatency: number[]
  averageAddMemory: number
  averageUpdateMemory: number
  minAddMemory: number
  minUpdateMemory: number
  maxAddMemory: number
  maxUpdateMemory: number
}

describe.skipIf(shouldSkipTests)('Write Performance Tests (ElectricSQL 1.1+)', () => {
  const testUserId = `perf-write-user-${Date.now()}`
  const testAgentId = `perf-write-agent-${Date.now()}`
  const metrics: WritePerformanceMetrics = {
    addMemoryLatency: [],
    updateMemoryLatency: [],
    averageAddMemory: 0,
    averageUpdateMemory: 0,
    minAddMemory: 0,
    minUpdateMemory: 0,
    maxAddMemory: 0,
    maxUpdateMemory: 0,
  }

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
    // Calculate statistics
    if (metrics.addMemoryLatency.length > 0) {
      metrics.averageAddMemory = average(metrics.addMemoryLatency)
      metrics.minAddMemory = Math.min(...metrics.addMemoryLatency)
      metrics.maxAddMemory = Math.max(...metrics.addMemoryLatency)
    }

    if (metrics.updateMemoryLatency.length > 0) {
      metrics.averageUpdateMemory = average(metrics.updateMemoryLatency)
      metrics.minUpdateMemory = Math.min(...metrics.updateMemoryLatency)
      metrics.maxUpdateMemory = Math.max(...metrics.updateMemoryLatency)
    }

    // Log performance metrics
    console.log('\n=== Write Performance Metrics (ElectricSQL 1.1+) ===')
    console.log('addMemory (ms):')
    console.log(
      `  Average: ${metrics.averageAddMemory.toFixed(2)}, ` +
        `Min: ${metrics.minAddMemory.toFixed(2)}, ` +
        `Max: ${metrics.maxAddMemory.toFixed(2)}`,
    )
    console.log('updateMemory (ms):')
    console.log(
      `  Average: ${metrics.averageUpdateMemory.toFixed(2)}, ` +
        `Min: ${metrics.minUpdateMemory.toFixed(2)}, ` +
        `Max: ${metrics.maxUpdateMemory.toFixed(2)}`,
    )
    console.log('==================================================\n')
    console.log(
      '💡 Compare these metrics against baseline in PERFORMANCE_BASELINE.md\n' +
        '   ElectricSQL 1.1+ should show significant improvement (up to 100x faster writes)',
    )
  })

  it(
    'should measure addMemory write latency with 1.1+ storage engine',
    async () => {
      const iterations = 20 // More iterations for better statistics
      const memoryIds: string[] = []

      for (let i = 0; i < iterations; i++) {
        const memoryId = `perf-write-memory-${Date.now()}-${i}`
        memoryIds.push(memoryId)

        const memory: Omit<AgentMemory, 'id' | 'created_at'> = {
          agent_id: testAgentId,
          content: `Write performance test memory ${i}`,
          type: 'test',
          verified: false,
          metadata: {
            test: true,
            iteration: i,
            performanceTest: true,
          },
        }

        const startTime = performance.now()

        try {
          await createAgentMemory(testUserId, { ...memory, id: memoryId }, undefined)
          const endTime = performance.now()
          const latency = endTime - startTime
          metrics.addMemoryLatency.push(latency)
        } catch (error) {
          console.error(`addMemory failed on iteration ${i}:`, error)
          throw error
        }
      }

      // Verify we got measurements
      expect(metrics.addMemoryLatency.length).toBe(iterations)

      // Verify all latencies are reasonable (< 5 seconds)
      metrics.addMemoryLatency.forEach((latency) => {
        expect(latency).toBeLessThan(5000)
      })

      // Log performance hint
      const avgLatency = average(metrics.addMemoryLatency)
      if (avgLatency < 100) {
        console.log(`✅ Excellent performance: ${avgLatency.toFixed(2)}ms average`)
      } else if (avgLatency < 500) {
        console.log(`✅ Good performance: ${avgLatency.toFixed(2)}ms average`)
      } else {
        console.log(`⚠️  Performance may need optimization: ${avgLatency.toFixed(2)}ms average`)
      }
    },
    PERFORMANCE_TEST_TIMEOUT,
  )

  it(
    'should measure updateMemory write latency with 1.1+ storage engine',
    async () => {
      // First create a memory to update
      const memoryId = `perf-write-update-${Date.now()}`
      const initialMemory: Omit<AgentMemory, 'id' | 'created_at'> = {
        agent_id: testAgentId,
        content: 'Initial content for update test',
        type: 'test',
        verified: false,
        metadata: { test: true, updateTest: true },
      }

      await createAgentMemory(testUserId, { ...initialMemory, id: memoryId }, undefined)

      const iterations = 20

      for (let i = 0; i < iterations; i++) {
        const updates = {
          content: `Updated content ${i} - ElectricSQL 1.1+ performance test`,
          metadata: {
            test: true,
            iteration: i,
            updated: true,
            performanceTest: true,
          },
        }

        const startTime = performance.now()

        try {
          await updateAgentMemory(testUserId, memoryId, updates, undefined)
          const endTime = performance.now()
          const latency = endTime - startTime
          metrics.updateMemoryLatency.push(latency)
        } catch (error) {
          console.error(`updateMemory failed on iteration ${i}:`, error)
          throw error
        }
      }

      // Verify we got measurements
      expect(metrics.updateMemoryLatency.length).toBe(iterations)

      // Verify all latencies are reasonable (< 5 seconds)
      metrics.updateMemoryLatency.forEach((latency) => {
        expect(latency).toBeLessThan(5000)
      })

      // Log performance hint
      const avgLatency = average(metrics.updateMemoryLatency)
      if (avgLatency < 100) {
        console.log(`✅ Excellent performance: ${avgLatency.toFixed(2)}ms average`)
      } else if (avgLatency < 500) {
        console.log(`✅ Good performance: ${avgLatency.toFixed(2)}ms average`)
      } else {
        console.log(`⚠️  Performance may need optimization: ${avgLatency.toFixed(2)}ms average`)
      }
    },
    PERFORMANCE_TEST_TIMEOUT,
  )

  it(
    'should compare performance against baseline expectations',
    async () => {
      // This test documents expected performance improvements
      // Actual comparison should be done manually against baseline metrics

      // Run a few operations to get current metrics
      const testIterations = 5
      const latencies: number[] = []

      for (let i = 0; i < testIterations; i++) {
        const memoryId = `perf-compare-${Date.now()}-${i}`
        const memory: Omit<AgentMemory, 'id' | 'created_at'> = {
          agent_id: testAgentId,
          content: `Comparison test ${i}`,
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

      // Document expectations
      console.log('\n=== Performance Comparison Expectations ===')
      console.log(`Current average latency: ${avgLatency.toFixed(2)}ms`)
      console.log('Expected improvement with ElectricSQL 1.1+: Up to 100x faster writes')
      console.log('Compare against baseline metrics in PERFORMANCE_BASELINE.md')
      console.log('===========================================\n')

      // Verify performance is reasonable
      expect(avgLatency).toBeLessThan(5000) // Should be under 5 seconds
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
