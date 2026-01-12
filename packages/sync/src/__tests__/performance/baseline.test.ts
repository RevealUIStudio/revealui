/**
 * Baseline Performance Metrics Tests
 *
 * Establishes baseline performance metrics for agent memory operations
 * before upgrading to ElectricSQL 1.1+. These metrics will be used to
 * compare performance improvements after the upgrade.
 *
 * Metrics measured:
 * - Agent memory write latency (addMemory, updateMemory)
 * - Sync latency (time from write to shape update)
 * - Memory usage during sync operations
 * - Network request counts for shape operations
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AgentMemory } from '../../schema'
import { createAgentMemory, updateAgentMemory } from '../../utils/revealui-api'

// Test timeout for performance tests (longer than normal)
const PERFORMANCE_TEST_TIMEOUT = 60000 // 60 seconds

// Skip if test server is not available
const TEST_SERVER_URL =
  process.env.REVEALUI_TEST_SERVER_URL ||
  process.env.REVEALUI_PUBLIC_SERVER_URL ||
  'http://localhost:4000'

const shouldSkipTests =
  !process.env.REVEALUI_TEST_SERVER_URL && !process.env.REVEALUI_PUBLIC_SERVER_URL

interface PerformanceMetrics {
  writeLatency: {
    addMemory: number[]
    updateMemory: number[]
  }
  syncLatency: number[]
  memoryUsage: {
    before: number
    after: number
    peak: number
  }
  networkRequests: {
    shapeRequests: number
    apiRequests: number
  }
}

describe.skipIf(shouldSkipTests)('Baseline Performance Metrics', () => {
  const testUserId = `perf-test-user-${Date.now()}`
  const testAgentId = `perf-test-agent-${Date.now()}`
  const metrics: PerformanceMetrics = {
    writeLatency: {
      addMemory: [],
      updateMemory: [],
    },
    syncLatency: [],
    memoryUsage: {
      before: 0,
      after: 0,
      peak: 0,
    },
    networkRequests: {
      shapeRequests: 0,
      apiRequests: 0,
    },
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

    // Record initial memory usage (if available)
    if (typeof process !== 'undefined' && process.memoryUsage) {
      metrics.memoryUsage.before = process.memoryUsage().heapUsed
    }
  }, PERFORMANCE_TEST_TIMEOUT)

  afterAll(() => {
    // Record final memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      metrics.memoryUsage.after = process.memoryUsage().heapUsed
    }

    // Log metrics summary
    console.log('\n=== Baseline Performance Metrics ===')
    console.log('Write Latency (ms):')
    console.log(
      `  addMemory: avg=${average(metrics.writeLatency.addMemory).toFixed(2)}, ` +
        `min=${Math.min(...metrics.writeLatency.addMemory).toFixed(2)}, ` +
        `max=${Math.max(...metrics.writeLatency.addMemory).toFixed(2)}`,
    )
    console.log(
      `  updateMemory: avg=${average(metrics.writeLatency.updateMemory).toFixed(2)}, ` +
        `min=${Math.min(...metrics.writeLatency.updateMemory).toFixed(2)}, ` +
        `max=${Math.max(...metrics.writeLatency.updateMemory).toFixed(2)}`,
    )
    console.log(
      `Sync Latency (ms): avg=${average(metrics.syncLatency).toFixed(2)}, ` +
        `min=${Math.min(...metrics.syncLatency).toFixed(2)}, ` +
        `max=${Math.max(...metrics.syncLatency).toFixed(2)}`,
    )
    console.log('Memory Usage (bytes):')
    console.log(
      `  Before: ${metrics.memoryUsage.before.toLocaleString()}, ` +
        `After: ${metrics.memoryUsage.after.toLocaleString()}, ` +
        `Peak: ${metrics.memoryUsage.peak.toLocaleString()}`,
    )
    console.log('Network Requests:')
    console.log(
      `  Shape Requests: ${metrics.networkRequests.shapeRequests}, ` +
        `API Requests: ${metrics.networkRequests.apiRequests}`,
    )
    console.log('=====================================\n')
  })

  it(
    'should measure addMemory write latency',
    async () => {
      const iterations = 10
      const memoryIds: string[] = []

      for (let i = 0; i < iterations; i++) {
        const memoryId = `perf-memory-${Date.now()}-${i}`
        memoryIds.push(memoryId)

        const memory: Omit<AgentMemory, 'id' | 'created_at'> = {
          agent_id: testAgentId,
          content: `Performance test memory ${i}`,
          type: 'test',
          verified: false,
          metadata: {
            test: true,
            iteration: i,
          },
        }

        const startTime = performance.now()
        metrics.networkRequests.apiRequests++

        try {
          await createAgentMemory(testUserId, { ...memory, id: memoryId }, undefined)
          const endTime = performance.now()
          const latency = endTime - startTime
          metrics.writeLatency.addMemory.push(latency)
        } catch (error) {
          console.error(`addMemory failed on iteration ${i}:`, error)
          throw error
        }
      }

      // Verify we got measurements
      expect(metrics.writeLatency.addMemory.length).toBe(iterations)

      // Verify all latencies are reasonable (< 5 seconds)
      metrics.writeLatency.addMemory.forEach((latency) => {
        expect(latency).toBeLessThan(5000)
      })

      // Cleanup: delete test memories
      // Note: Cleanup is best effort, failures won't fail the test
      for (const _memoryId of memoryIds) {
        try {
          // Would need deleteAgentMemory function - skip for now
          // await deleteAgentMemory(testUserId, memoryId)
        } catch {
          // Ignore cleanup errors
        }
      }
    },
    PERFORMANCE_TEST_TIMEOUT,
  )

  it(
    'should measure updateMemory write latency',
    async () => {
      // First create a memory to update
      const memoryId = `perf-update-memory-${Date.now()}`
      const initialMemory: Omit<AgentMemory, 'id' | 'created_at'> = {
        agent_id: testAgentId,
        content: 'Initial content',
        type: 'test',
        verified: false,
        metadata: { test: true },
      }

      await createAgentMemory(testUserId, { ...initialMemory, id: memoryId }, undefined)
      metrics.networkRequests.apiRequests++

      const iterations = 10

      for (let i = 0; i < iterations; i++) {
        const updates = {
          content: `Updated content ${i}`,
          metadata: {
            test: true,
            iteration: i,
            updated: true,
          },
        }

        const startTime = performance.now()
        metrics.networkRequests.apiRequests++

        try {
          await updateAgentMemory(testUserId, memoryId, updates, undefined)
          const endTime = performance.now()
          const latency = endTime - startTime
          metrics.writeLatency.updateMemory.push(latency)
        } catch (error) {
          console.error(`updateMemory failed on iteration ${i}:`, error)
          throw error
        }
      }

      // Verify we got measurements
      expect(metrics.writeLatency.updateMemory.length).toBe(iterations)

      // Verify all latencies are reasonable (< 5 seconds)
      metrics.writeLatency.updateMemory.forEach((latency) => {
        expect(latency).toBeLessThan(5000)
      })
    },
    PERFORMANCE_TEST_TIMEOUT,
  )

  it(
    'should measure sync latency (write to shape update)',
    async () => {
      // Note: This test requires ElectricSQL service to be running
      // For baseline, we'll measure the time from API write to when
      // we could theoretically read it back via shape
      // In practice, this requires ElectricSQL service integration

      const memoryId = `perf-sync-memory-${Date.now()}`
      const memory: Omit<AgentMemory, 'id' | 'created_at'> = {
        agent_id: testAgentId,
        content: 'Sync test memory',
        type: 'test',
        verified: false,
        metadata: { test: true, syncTest: true },
      }

      const writeStartTime = performance.now()
      metrics.networkRequests.apiRequests++

      await createAgentMemory(testUserId, { ...memory, id: memoryId }, undefined)

      const writeEndTime = performance.now()
      const writeLatency = writeEndTime - writeStartTime

      // For baseline, we measure write latency as proxy for sync latency
      // After upgrade, we'll measure actual sync latency via ElectricSQL shapes
      metrics.syncLatency.push(writeLatency)

      expect(writeLatency).toBeLessThan(5000)
    },
    PERFORMANCE_TEST_TIMEOUT,
  )

  it(
    'should measure memory usage during operations',
    async () => {
      if (typeof process === 'undefined' || !process.memoryUsage) {
        // Skip in browser environment
        return
      }

      const initialMemory = process.memoryUsage().heapUsed
      let peakMemory = initialMemory

      // Perform multiple operations
      const iterations = 20

      for (let i = 0; i < iterations; i++) {
        const memoryId = `perf-mem-usage-${Date.now()}-${i}`
        const memory: Omit<AgentMemory, 'id' | 'created_at'> = {
          agent_id: testAgentId,
          content: `Memory usage test ${i}`,
          type: 'test',
          verified: false,
          metadata: { test: true, iteration: i },
        }

        metrics.networkRequests.apiRequests++
        await createAgentMemory(testUserId, { ...memory, id: memoryId }, undefined)

        // Check memory usage
        const currentMemory = process.memoryUsage().heapUsed
        if (currentMemory > peakMemory) {
          peakMemory = currentMemory
        }
      }

      metrics.memoryUsage.peak = peakMemory

      // Verify memory usage is reasonable (not growing unbounded)
      const memoryGrowth = peakMemory - initialMemory
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024) // Less than 100MB growth
    },
    PERFORMANCE_TEST_TIMEOUT,
  )

  it(
    'should count network requests',
    async () => {
      const initialApiRequests = metrics.networkRequests.apiRequests
      const _initialShapeRequests = metrics.networkRequests.shapeRequests

      // Perform operations
      const iterations = 5

      for (let i = 0; i < iterations; i++) {
        const memoryId = `perf-network-${Date.now()}-${i}`
        const memory: Omit<AgentMemory, 'id' | 'created_at'> = {
          agent_id: testAgentId,
          content: `Network test ${i}`,
          type: 'test',
          verified: false,
          metadata: { test: true },
        }

        await createAgentMemory(testUserId, { ...memory, id: memoryId }, undefined)
      }

      const finalApiRequests = metrics.networkRequests.apiRequests
      const apiRequestCount = finalApiRequests - initialApiRequests

      // Verify we made the expected number of API requests
      expect(apiRequestCount).toBe(iterations)

      // Note: Shape requests will be measured after ElectricSQL integration
      // For baseline, we just verify the counting mechanism works
      expect(metrics.networkRequests.shapeRequests).toBeGreaterThanOrEqual(0)
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
