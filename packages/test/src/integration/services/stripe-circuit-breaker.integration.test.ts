/**
 * Stripe Circuit Breaker Integration Tests
 *
 * PURPOSE: Verify circuit breaker state transitions, retry logic, and resilience patterns
 *
 * CONTEXT: Circuit breaker protects against cascading failures when Stripe API is degraded.
 * These tests verify:
 * - State transitions (closed → open → half-open → closed)
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Recovery after service degradation
 *
 * NOTE: Uses mocks to avoid requiring Stripe test keys for CI/CD
 */

import { createProtectedStripe } from '@revealui/services/stripe/stripeClient'
import type Stripe from 'stripe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  advanceCircuitBreakerTime,
  createCircuitBreakerScenario,
  getCircuitBreakerConfig,
  getCircuitBreakerState,
  getRetryConfig,
  resetAllCircuitBreakers,
  setCircuitBreakerState,
  simulateFailures,
} from '../../utils/circuit-breaker-test-helpers.js'

// Mock Stripe SDK
const mockStripeCustomers = {
  create: vi.fn(),
  retrieve: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
  list: vi.fn(),
}

const mockStripePaymentIntents = {
  create: vi.fn(),
  retrieve: vi.fn(),
  update: vi.fn(),
}

const mockStripe = {
  customers: mockStripeCustomers,
  paymentIntents: mockStripePaymentIntents,
} as unknown as Stripe

describe('Stripe Circuit Breaker Integration Tests', () => {
  let protectedStripe: ReturnType<typeof createProtectedStripe>

  beforeEach(() => {
    vi.clearAllMocks()
    resetAllCircuitBreakers()
    protectedStripe = createProtectedStripe(mockStripe)
  })

  // =============================================================================
  // Circuit Breaker State Transitions
  // =============================================================================

  describe('Circuit Breaker State Transitions', () => {
    it('starts in CLOSED state', () => {
      const state = getCircuitBreakerState('customers.create')

      expect(state.state).toBe('closed')
      expect(state.failures).toBe(0)
      expect(state.isOpen).toBe(false)
    })

    it('transitions to OPEN after threshold failures', async () => {
      const config = getCircuitBreakerConfig()
      const operationName = 'customers.create'

      // Mock repeated failures
      mockStripeCustomers.create.mockRejectedValue(new Error('Service unavailable'))

      // Trigger failures (non-retryable errors)
      for (let i = 0; i < config.failureThreshold; i++) {
        await protectedStripe.customers.create({ email: 'test@example.com' }).catch(() => {})
      }

      const state = getCircuitBreakerState(operationName)
      expect(state.state).toBe('open')
      expect(state.failures).toBe(config.failureThreshold)
      expect(state.isOpen).toBe(true)
    })

    it('rejects requests immediately when OPEN', async () => {
      const operationName = 'customers.create'

      // Force circuit to OPEN
      simulateFailures(operationName, 5)

      // Attempt operation
      await expect(protectedStripe.customers.create({ email: 'test@example.com' })).rejects.toThrow(
        'Circuit breaker is OPEN',
      )

      // Verify underlying Stripe API was NOT called
      expect(mockStripeCustomers.create).not.toHaveBeenCalled()
    })

    it('transitions to HALF-OPEN after reset timeout', () => {
      const config = getCircuitBreakerConfig()
      const operationName = 'customers.create'

      // Force circuit to OPEN
      simulateFailures(operationName, config.failureThreshold)

      let state = getCircuitBreakerState(operationName)
      expect(state.state).toBe('open')

      // Advance time past reset timeout
      advanceCircuitBreakerTime(operationName, config.resetTimeout)

      // Check if circuit allows operation (should be half-open)
      state = getCircuitBreakerState(operationName)
      expect(state.isOpen).toBe(false) // Half-open allows operations
    })

    it('transitions from HALF-OPEN to CLOSED after successful operations', () => {
      const scenario = createCircuitBreakerScenario('customers.create')

      // CLOSED → OPEN
      scenario.transitionToOpen()
      expect(scenario.getState().state).toBe('open')

      // OPEN → HALF-OPEN
      scenario.transitionToHalfOpen()
      expect(scenario.getState().isOpen).toBe(false)

      // HALF-OPEN → CLOSED (after 2 successes)
      scenario.transitionToClosed()
      expect(scenario.getState().state).toBe('closed')
      expect(scenario.getState().failures).toBe(0)
    })

    it('transitions from HALF-OPEN back to OPEN on failure', async () => {
      const operationName = 'customers.create'

      // Force circuit to HALF-OPEN
      setCircuitBreakerState(operationName, 'half-open')

      // Mock failure
      mockStripeCustomers.create.mockRejectedValueOnce(new Error('Still unavailable'))

      await protectedStripe.customers.create({ email: 'test@example.com' }).catch(() => {})

      const state = getCircuitBreakerState(operationName)
      expect(state.state).toBe('open')
    })
  })

  // =============================================================================
  // Retry Logic with Exponential Backoff
  // =============================================================================

  describe('Retry Logic with Exponential Backoff', () => {
    it('retries retryable errors up to max attempts', async () => {
      const config = getRetryConfig()

      // Mock retryable failures (timeout) then success
      mockStripeCustomers.create
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({ id: 'cus_test123' } as Stripe.Customer)

      const result = await protectedStripe.customers.create({ email: 'test@example.com' })

      expect(result.id).toBe('cus_test123')
      expect(mockStripeCustomers.create).toHaveBeenCalledTimes(config.maxAttempts)
    })

    it('does NOT retry non-retryable errors', async () => {
      // Mock validation error (non-retryable)
      mockStripeCustomers.create.mockRejectedValueOnce(
        new Error('Invalid email address') as Stripe.errors.StripeInvalidRequestError,
      )

      await expect(protectedStripe.customers.create({ email: 'invalid' })).rejects.toThrow(
        'Invalid email address',
      )

      // Should only attempt once (no retries)
      expect(mockStripeCustomers.create).toHaveBeenCalledTimes(1)
    })

    it('respects exponential backoff delays', async () => {
      const config = getRetryConfig()
      const startTime = Date.now()

      // Mock retryable failures
      mockStripeCustomers.create
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ id: 'cus_test123' } as Stripe.Customer)

      await protectedStripe.customers.create({ email: 'test@example.com' })

      const elapsedTime = Date.now() - startTime

      // Should have waited at least backoff[0] + backoff[1] = 100 + 200 = 300ms
      const minExpectedTime = config.backoff[0]! + config.backoff[1]!
      expect(elapsedTime).toBeGreaterThanOrEqual(minExpectedTime)
    })

    it('throws after max attempts exhausted', async () => {
      const config = getRetryConfig()

      // Mock all retries as failures
      mockStripeCustomers.create.mockRejectedValue(new Error('timeout'))

      await expect(protectedStripe.customers.create({ email: 'test@example.com' })).rejects.toThrow(
        `failed after ${config.maxAttempts} attempts`,
      )

      expect(mockStripeCustomers.create).toHaveBeenCalledTimes(config.maxAttempts)
    })
  })

  // =============================================================================
  // Timeout Handling
  // =============================================================================

  describe('Timeout Handling', () => {
    it('times out slow operations', async () => {
      // Mock operation that never resolves
      mockStripeCustomers.create.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 20000) // 20 seconds (exceeds 10s timeout)
          }),
      )

      await expect(protectedStripe.customers.create({ email: 'test@example.com' })).rejects.toThrow(
        /timed out after/,
      )
    })

    it('succeeds if operation completes before timeout', async () => {
      // Mock operation that resolves quickly
      mockStripeCustomers.create.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ id: 'cus_test123' } as Stripe.Customer), 100) // 100ms
          }),
      )

      const result = await protectedStripe.customers.create({ email: 'test@example.com' })

      expect(result.id).toBe('cus_test123')
    })
  })

  // =============================================================================
  // Per-Operation Circuit Breakers
  // =============================================================================

  describe('Per-Operation Circuit Breakers', () => {
    it('maintains separate circuit breakers for different operations', async () => {
      // Fail customers.create
      mockStripeCustomers.create.mockRejectedValue(new Error('Service unavailable'))
      for (let i = 0; i < 5; i++) {
        await protectedStripe.customers.create({ email: 'test@example.com' }).catch(() => {})
      }

      // customers.create should be OPEN
      const customersState = getCircuitBreakerState('customers.create')
      expect(customersState.state).toBe('open')

      // paymentIntents.create should still be CLOSED
      const paymentsState = getCircuitBreakerState('paymentIntents.create')
      expect(paymentsState.state).toBe('closed')

      // Verify paymentIntents.create still works
      mockStripePaymentIntents.create.mockResolvedValueOnce({
        id: 'pi_test123',
      } as Stripe.PaymentIntent)

      const result = await protectedStripe.paymentIntents.create({
        amount: 1000,
        currency: 'usd',
      })

      expect(result.id).toBe('pi_test123')
    })
  })

  // =============================================================================
  // Recovery Scenarios
  // =============================================================================

  describe('Recovery Scenarios', () => {
    it('recovers from degraded service state', async () => {
      const operationName = 'customers.create'

      // Phase 1: Service degraded (failures)
      mockStripeCustomers.create.mockRejectedValue(new Error('Service unavailable'))
      for (let i = 0; i < 5; i++) {
        await protectedStripe.customers.create({ email: 'test@example.com' }).catch(() => {})
      }

      expect(getCircuitBreakerState(operationName).state).toBe('open')

      // Phase 2: Wait for reset timeout
      const config = getCircuitBreakerConfig()
      advanceCircuitBreakerTime(operationName, config.resetTimeout)

      // Phase 3: Service recovered
      mockStripeCustomers.create.mockResolvedValue({ id: 'cus_test123' } as Stripe.Customer)

      // First success (half-open → still half-open, successCount = 1)
      await protectedStripe.customers.create({ email: 'test@example.com' })
      expect(getCircuitBreakerState(operationName).state).toBe('half-open')

      // Second success (half-open → closed)
      await protectedStripe.customers.create({ email: 'test@example.com' })
      expect(getCircuitBreakerState(operationName).state).toBe('closed')

      // Verify normal operation resumed
      const result = await protectedStripe.customers.create({ email: 'test@example.com' })
      expect(result.id).toBe('cus_test123')
    })

    it('handles intermittent failures during recovery', async () => {
      const operationName = 'customers.create'

      // Force to HALF-OPEN
      setCircuitBreakerState(operationName, 'half-open')

      // One success
      mockStripeCustomers.create.mockResolvedValueOnce({ id: 'cus_1' } as Stripe.Customer)
      await protectedStripe.customers.create({ email: 'test@example.com' })
      expect(getCircuitBreakerState(operationName).successCount).toBe(1)

      // Then failure (should reopen circuit)
      mockStripeCustomers.create.mockRejectedValueOnce(new Error('Still degraded'))
      await protectedStripe.customers.create({ email: 'test@example.com' }).catch(() => {})

      expect(getCircuitBreakerState(operationName).state).toBe('open')
    })
  })

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('Edge Cases', () => {
    it('handles rapid successive failures', async () => {
      const operationName = 'customers.create'
      mockStripeCustomers.create.mockRejectedValue(new Error('Service unavailable'))

      // Trigger 10 rapid failures (only first 5 should increment)
      await Promise.allSettled(
        Array(10)
          .fill(null)
          .map(() => protectedStripe.customers.create({ email: 'test@example.com' })),
      )

      const state = getCircuitBreakerState(operationName)
      expect(state.state).toBe('open')
      // Only first 5 attempts should have been made (circuit opens after 5)
      expect(mockStripeCustomers.create).toHaveBeenCalledTimes(5)
    })

    it('resets failure count on success in CLOSED state', async () => {
      const operationName = 'customers.create'

      // Simulate 3 failures (below threshold)
      mockStripeCustomers.create.mockRejectedValue(new Error('timeout'))
      for (let i = 0; i < 3; i++) {
        await protectedStripe.customers.create({ email: 'test@example.com' }).catch(() => {})
      }

      expect(getCircuitBreakerState(operationName).failures).toBe(3)

      // Success should reset failure count
      mockStripeCustomers.create.mockResolvedValueOnce({ id: 'cus_test' } as Stripe.Customer)
      await protectedStripe.customers.create({ email: 'test@example.com' })

      expect(getCircuitBreakerState(operationName).failures).toBe(0)
    })

    it('handles null/undefined responses gracefully', async () => {
      // Mock unexpected response
      mockStripeCustomers.create.mockResolvedValueOnce(null as unknown as Stripe.Customer)

      const result = await protectedStripe.customers.create({ email: 'test@example.com' })

      // Should not crash, just return whatever Stripe returns
      expect(result).toBeNull()
    })
  })
})
