/**
 * Multi-Step Operations Integration Tests
 *
 * PURPOSE: Verify multi-step operations handle partial failures gracefully WITHOUT transactions
 *
 * CRITICAL CONTEXT: withTransaction() is NOT implemented (Neon HTTP driver limitation at
 * packages/db/src/client/index.ts:460-469). These tests verify compensating transaction patterns.
 *
 * TESTS:
 * - Compensating transaction patterns (rollback on failure)
 * - Idempotency patterns (retry-safe operations)
 * - Data consistency verification after partial failures
 * - Multi-step workflows without atomicity guarantees
 */

import type { RevealUIInstance } from '@revealui/core'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  generateUniqueTestEmail,
  getTestRevealUI,
  trackTestData,
} from '../../utils/integration-helpers.js'
import {
  clearOperationRegistry,
  executeIdempotentOperation,
  executeMultiStepOperation,
  simulateMultiStepWithFailure,
} from '../../utils/multi-step-test-helpers.js'

describe('Multi-Step Operations (Without Transactions)', () => {
  let revealui: RevealUIInstance

  beforeAll(async () => {
    revealui = await getTestRevealUI()
  })

  beforeEach(() => {
    clearOperationRegistry()
  })

  // =============================================================================
  // Compensating Transaction Pattern
  // =============================================================================

  describe('Compensating Transaction Pattern', () => {
    it('should rollback completed steps on failure', async () => {
      const _userId = `user_${Date.now()}`
      const email = generateUniqueTestEmail('multi-step-rollback')
      const _siteId = `site_${Date.now()}`

      const result = await executeMultiStepOperation([
        {
          name: 'Create User',
          execute: async () => {
            const user = await revealui.create({
              collection: 'users',
              data: {
                email,
                password: 'TestPassword123!',
              },
            })
            trackTestData('users', String(user.id))
            return user
          },
          rollback: async (user) => {
            await revealui.delete({
              collection: 'users',
              id: user.id,
            })
          },
        },
        {
          name: 'Create Site',
          execute: async () => {
            // Intentional failure (missing required field)
            throw new Error('Simulated failure - site creation failed')
          },
          rollback: async () => {
            // No rollback needed - step never completed
          },
        },
      ])

      expect(result.completedSteps).toBe(1)
      expect(result.allSucceeded).toBe(false)
      expect(result.results[1]?.success).toBe(false)

      // Verify user was rolled back (deleted)
      const userCheck = await revealui.findByID({
        collection: 'users',
        id: String(result.results[0]?.data?.id),
      })

      expect(userCheck).toBeNull()
    })

    it('should handle successful multi-step operation', async () => {
      const email = generateUniqueTestEmail('multi-step-success')

      let createdUserId: string | number | undefined

      const result = await executeMultiStepOperation([
        {
          name: 'Create User',
          execute: async () => {
            const user = await revealui.create({
              collection: 'users',
              data: {
                email,
                password: 'TestPassword123!',
              },
            })
            createdUserId = user.id
            trackTestData('users', String(user.id))
            return user
          },
          rollback: async (user) => {
            await revealui.delete({
              collection: 'users',
              id: user.id,
            })
          },
        },
        {
          name: 'Verify User Exists',
          execute: async () => {
            const user = await revealui.findByID({
              collection: 'users',
              id: createdUserId!,
            })
            expect(user).not.toBeNull()
            return user
          },
          rollback: async () => {
            // No rollback needed for read operation
          },
        },
      ])

      expect(result.completedSteps).toBe(2)
      expect(result.allSucceeded).toBe(true)
      expect(result.results.every((r) => r.success)).toBe(true)

      // Verify user still exists (no rollback occurred)
      const user = await revealui.findByID({
        collection: 'users',
        id: createdUserId!,
      })

      expect(user).not.toBeNull()
      expect(user?.email).toBe(email)
    })

    it('should rollback in reverse order (LIFO)', async () => {
      const rollbackOrder: number[] = []

      const result = await executeMultiStepOperation([
        {
          name: 'Step 1',
          execute: async () => ({ step: 1 }),
          rollback: async () => {
            rollbackOrder.push(1)
          },
        },
        {
          name: 'Step 2',
          execute: async () => ({ step: 2 }),
          rollback: async () => {
            rollbackOrder.push(2)
          },
        },
        {
          name: 'Step 3',
          execute: async () => ({ step: 3 }),
          rollback: async () => {
            rollbackOrder.push(3)
          },
        },
        {
          name: 'Step 4 - Failure',
          execute: async () => {
            throw new Error('Simulated failure at step 4')
          },
          rollback: async () => {
            rollbackOrder.push(4)
          },
        },
      ])

      expect(result.completedSteps).toBe(3)

      // Rollback should occur in reverse order: 3, 2, 1
      expect(rollbackOrder).toEqual([3, 2, 1])
    })
  })

  // =============================================================================
  // Idempotency Pattern (Retry-Safe Operations)
  // =============================================================================

  describe('Idempotency Pattern', () => {
    it('should handle retry-safe user creation', async () => {
      const operationId = `op_${Date.now()}`
      const email = generateUniqueTestEmail('idempotent-create')

      // First attempt
      const result1 = await executeIdempotentOperation(operationId, async () => {
        const user = await revealui.create({
          collection: 'users',
          data: {
            email,
            password: 'TestPassword123!',
          },
        })
        trackTestData('users', String(user.id))
        return user
      })

      expect(result1.created).toBe(true)
      expect(result1.result.email).toBe(email)

      // Retry (should return cached result)
      const result2 = await executeIdempotentOperation(operationId, async () => {
        // This should NOT execute
        throw new Error('Operation should not execute on retry')
      })

      expect(result2.created).toBe(false)
      expect((result2.result as { email: string }).email).toBe(email)
      expect((result2.result as { id: string | number }).id).toBe(
        (result1.result as { id: string | number }).id,
      )
    })

    it('should allow different operation IDs', async () => {
      const email1 = generateUniqueTestEmail('idempotent-1')
      const email2 = generateUniqueTestEmail('idempotent-2')

      const result1 = await executeIdempotentOperation('op_1', async () => {
        const user = await revealui.create({
          collection: 'users',
          data: {
            email: email1,
            password: 'TestPassword123!',
          },
        })
        trackTestData('users', String(user.id))
        return user
      })

      const result2 = await executeIdempotentOperation('op_2', async () => {
        const user = await revealui.create({
          collection: 'users',
          data: {
            email: email2,
            password: 'TestPassword123!',
          },
        })
        trackTestData('users', String(user.id))
        return user
      })

      expect(result1.created).toBe(true)
      expect(result2.created).toBe(true)
      expect((result1.result as { id: string | number }).id).not.toBe(
        (result2.result as { id: string | number }).id,
      )
    })
  })

  // =============================================================================
  // Simulated Multi-Step Failures
  // =============================================================================

  describe('Simulated Multi-Step Failures', () => {
    it('should handle failure at first step', async () => {
      const result = await simulateMultiStepWithFailure(5, 1)

      expect(result.completedSteps).toBe(0)
      expect(result.allSucceeded).toBe(false)
      expect(result.results[0]?.success).toBe(false)
    })

    it('should handle failure at middle step', async () => {
      const result = await simulateMultiStepWithFailure(5, 3)

      expect(result.completedSteps).toBe(2)
      expect(result.allSucceeded).toBe(false)
      expect(result.results[0]?.success).toBe(true)
      expect(result.results[1]?.success).toBe(true)
      expect(result.results[2]?.success).toBe(false)
    })

    it('should handle failure at last step', async () => {
      const result = await simulateMultiStepWithFailure(5, 5)

      expect(result.completedSteps).toBe(4)
      expect(result.allSucceeded).toBe(false)
      expect(result.results[4]?.success).toBe(false)
    })

    it('should complete all steps when no failure', async () => {
      const result = await simulateMultiStepWithFailure(5, 0)

      expect(result.completedSteps).toBe(5)
      expect(result.allSucceeded).toBe(true)
      expect(result.results.every((r) => r.success)).toBe(true)
    })
  })

  // =============================================================================
  // Real-World Scenario: User + Site Creation
  // =============================================================================

  describe('Real-World Scenario: User + Site Creation', () => {
    it('should create user and site successfully', async () => {
      const email = generateUniqueTestEmail('user-site-success')

      let userId: string | number | undefined

      const result = await executeMultiStepOperation([
        {
          name: 'Create User',
          execute: async () => {
            const user = await revealui.create({
              collection: 'users',
              data: {
                email,
                password: 'TestPassword123!',
              },
            })
            userId = user.id
            trackTestData('users', String(user.id))
            return user
          },
          rollback: async (user) => {
            await revealui.delete({
              collection: 'users',
              id: user.id,
            })
          },
        },
        {
          name: 'Create Site',
          execute: async () => {
            // Note: sites collection requires user to exist
            // This simulates creating a related entity
            return { id: 'site_123', userId, siteName: 'Test Site' }
          },
          rollback: async () => {
            // Site deletion would go here
          },
        },
      ])

      expect(result.completedSteps).toBe(2)
      expect(result.allSucceeded).toBe(true)

      // Verify user exists
      const user = await revealui.findByID({
        collection: 'users',
        id: userId!,
      })

      expect(user).not.toBeNull()
      expect(user?.email).toBe(email)
    })

    it('should rollback user creation when site creation fails', async () => {
      const email = generateUniqueTestEmail('user-site-failure')

      const result = await executeMultiStepOperation([
        {
          name: 'Create User',
          execute: async () => {
            const user = await revealui.create({
              collection: 'users',
              data: {
                email,
                password: 'TestPassword123!',
              },
            })
            trackTestData('users', String(user.id))
            return user
          },
          rollback: async (user) => {
            await revealui.delete({
              collection: 'users',
              id: user.id,
            })
          },
        },
        {
          name: 'Create Site - Will Fail',
          execute: async () => {
            // Simulate site creation failure
            throw new Error('Site creation failed - database constraint violation')
          },
          rollback: async () => {
            // No rollback needed - step never completed
          },
        },
      ])

      expect(result.completedSteps).toBe(1)
      expect(result.allSucceeded).toBe(false)

      // Verify user was rolled back
      const user = await revealui.findByID({
        collection: 'users',
        id: String(result.results[0]?.data?.id),
      })

      expect(user).toBeNull()
    })
  })

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle empty step array', async () => {
      const result = await executeMultiStepOperation([])

      expect(result.completedSteps).toBe(0)
      expect(result.totalSteps).toBe(0)
      expect(result.allSucceeded).toBe(true)
    })

    it('should handle rollback failure gracefully', async () => {
      const email = generateUniqueTestEmail('rollback-failure')

      const result = await executeMultiStepOperation([
        {
          name: 'Create User',
          execute: async () => {
            const user = await revealui.create({
              collection: 'users',
              data: {
                email,
                password: 'TestPassword123!',
              },
            })
            trackTestData('users', String(user.id))
            return user
          },
          rollback: async () => {
            // Simulate rollback failure
            throw new Error('Rollback failed - user already deleted')
          },
        },
        {
          name: 'Trigger Failure',
          execute: async () => {
            throw new Error('Simulated failure')
          },
          rollback: async () => {},
        },
      ])

      expect(result.completedSteps).toBe(1)
      expect(result.allSucceeded).toBe(false)

      // Even if rollback fails, operation should complete
      // (rollback errors are logged but not thrown)
    })

    it('should handle async rollback operations', async () => {
      const rollbackDelays: number[] = []

      const result = await executeMultiStepOperation([
        {
          name: 'Step 1',
          execute: async () => ({ step: 1 }),
          rollback: async () => {
            await new Promise((resolve) => setTimeout(resolve, 50))
            rollbackDelays.push(1)
          },
        },
        {
          name: 'Step 2',
          execute: async () => ({ step: 2 }),
          rollback: async () => {
            await new Promise((resolve) => setTimeout(resolve, 50))
            rollbackDelays.push(2)
          },
        },
        {
          name: 'Step 3 - Failure',
          execute: async () => {
            throw new Error('Simulated failure')
          },
          rollback: async () => {},
        },
      ])

      expect(result.completedSteps).toBe(2)

      // All async rollbacks should have completed
      expect(rollbackDelays).toEqual([2, 1])
    })
  })
})
