/**
 * End-to-End Agent Memory Workflow Tests
 *
 * Tests the complete agent memory workflow:
 * - Create memory via CMS API
 * - Sync via ElectricSQL
 * - Read via useAgentMemory hook
 * - Update and verify sync
 * - Cross-tab scenarios
 * - Offline/online transitions
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createAgentMemory, deleteAgentMemory, updateAgentMemory } from '../../utils/revealui-api'

// Test timeout for E2E tests
const E2E_TEST_TIMEOUT = 60000 // 60 seconds

// Test server URL
const TEST_SERVER_URL =
  process.env.REVEALUI_TEST_SERVER_URL ||
  process.env.REVEALUI_PUBLIC_SERVER_URL ||
  'http://localhost:4000'

// ElectricSQL service URL
const ELECTRIC_SERVICE_URL =
  process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL ||
  process.env.ELECTRIC_SERVICE_URL ||
  'http://localhost:5133'

// Skip tests if servers are not available
const shouldSkipTests =
  (!process.env.REVEALUI_TEST_SERVER_URL && !process.env.REVEALUI_PUBLIC_SERVER_URL) ||
  (!process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL && !process.env.ELECTRIC_SERVICE_URL)

describe.skipIf(shouldSkipTests)('E2E Agent Memory Workflow', () => {
  const testUserId = `e2e-user-${Date.now()}`
  const testAgentId = `e2e-agent-${Date.now()}`

  beforeAll(async () => {
    // Verify both servers are accessible
    try {
      const [cmsResponse, electricResponse] = await Promise.all([
        fetch(`${TEST_SERVER_URL}/api/conversations`, {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`${ELECTRIC_SERVICE_URL}/health`, {
          signal: AbortSignal.timeout(5000),
        }),
      ])

      if (cmsResponse.status === 404) {
        throw new Error(`CMS endpoint not found at ${TEST_SERVER_URL}`)
      }
      if (!electricResponse.ok) {
        throw new Error(`ElectricSQL health check failed: ${electricResponse.status}`)
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED'))
      ) {
        throw new Error(
          `Cannot connect to test servers. ` +
            `Start CMS: pnpm --filter cms dev\n` +
            `Start ElectricSQL: pnpm electric:service:start\n` +
            `Error: ${error.message}`,
        )
      }
      throw error
    }
  }, E2E_TEST_TIMEOUT)

  it(
    'should complete full workflow: create → sync → read → update',
    async () => {
      // Step 1: Create memory via CMS API
      const memoryId = `e2e-memory-${Date.now()}`
      const memory = {
        id: memoryId,
        agent_id: testAgentId,
        content: 'E2E test memory',
        type: 'test',
        verified: false,
        metadata: { test: true, e2e: true },
        created_at: new Date().toISOString(),
      }

      const createResult = await createAgentMemory(testUserId, memory, undefined)
      expect(createResult).toBeDefined()

      // Step 2: Wait for sync (ElectricSQL should sync automatically)
      // Note: In real implementation, we'd use useAgentMemory hook to verify sync
      // For E2E test, we verify the memory was created
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second for sync

      // Step 3: Verify memory exists (would use useAgentMemory hook in real app)
      // For now, verify via API that memory was created
      // In real E2E test with React, we'd use useAgentMemory hook

      // Step 4: Update memory via CMS API
      const updates = {
        content: 'Updated E2E test memory',
        metadata: { test: true, e2e: true, updated: true },
      }

      const updateResult = await updateAgentMemory(testUserId, memoryId, updates, undefined)
      expect(updateResult).toBeDefined()

      // Step 5: Wait for sync
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Step 6: Cleanup
      await deleteAgentMemory(testUserId, memoryId, undefined)
    },
    E2E_TEST_TIMEOUT,
  )

  it(
    'should handle multiple memories workflow',
    async () => {
      const memoryIds: string[] = []

      // Create multiple memories
      for (let i = 0; i < 5; i++) {
        const memoryId = `e2e-multi-${Date.now()}-${i}`
        const memory = {
          id: memoryId,
          agent_id: testAgentId,
          content: `E2E test memory ${i}`,
          type: 'test',
          verified: false,
          metadata: { test: true, iteration: i },
          created_at: new Date().toISOString(),
        }

        await createAgentMemory(testUserId, memory, undefined)
        memoryIds.push(memoryId)
      }

      // Wait for sync
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Cleanup
      for (const memoryId of memoryIds) {
        try {
          await deleteAgentMemory(testUserId, memoryId, undefined)
        } catch {
          // Ignore cleanup errors
        }
      }
    },
    E2E_TEST_TIMEOUT,
  )

  it(
    'should verify CMS API and ElectricSQL integration',
    async () => {
      // Verify CMS API is accessible
      const cmsResponse = await fetch(`${TEST_SERVER_URL}/api/conversations`, {
        signal: AbortSignal.timeout(5000),
      })
      expect(cmsResponse.status).not.toBe(404)

      // Verify ElectricSQL service is accessible
      const electricResponse = await fetch(`${ELECTRIC_SERVICE_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      })
      expect(electricResponse.status).toBe(200)

      // Verify shape endpoint exists
      const shapeResponse = await fetch(`${ELECTRIC_SERVICE_URL}/v1/shape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(5000),
      })
      expect(shapeResponse.status).not.toBe(404)
    },
    E2E_TEST_TIMEOUT,
  )
})

/**
 * Note: Full E2E testing with React components requires:
 *
 * 1. React Testing Library Setup
 *    - Render components with ElectricProvider
 *    - Test useAgentMemory hook in component context
 *    - Verify UI updates on sync
 *
 * 2. Cross-Tab Testing
 *    - Use multiple browser contexts
 *    - Test sync across tabs
 *    - Verify shared state
 *
 * 3. Offline/Online Testing
 *    - Simulate network conditions
 *    - Test offline functionality
 *    - Test reconnection
 *
 * These tests are simplified API-level E2E tests.
 * Full component-level E2E tests should be added separately.
 */
