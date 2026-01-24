import type Stripe from 'stripe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testUtils } from '../src/core/stripe/stripeClient.test-utils'

describe('Circuit Breaker State Transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] })
    testUtils.resetAllCircuitBreakers()
    testUtils.resetStripe() // Clear cached Stripe instance
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    testUtils.resetAllCircuitBreakers()
    testUtils.resetStripe() // Clean up
  })

  it('should open circuit after 5 consecutive failures', async () => {
    const retryConfig = testUtils.getRetryConfig()

    // Reset Stripe cache first
    testUtils.resetStripe()

    // Mock to fail with retryable error
    // Use factory pattern to inject mock Stripe instance
    const mockStripe = {
      customers: {
        create: vi.fn().mockRejectedValue(new Error('timeout')),
      },
    } as unknown as Stripe

    const testProtectedStripe = testUtils.createTestProtectedStripe(mockStripe)

    // CRITICAL FIX: Each call retries maxAttempts times before recording failure
    // Use runAllTimersAsync() to properly advance all timers and await promise settlement
    for (let i = 0; i < 5; i++) {
      const promise = testProtectedStripe.customers.create({
        email: 'test@example.com',
      })

      // Run all pending timers (handles backoff delays and timeout)
      // This properly advances timers and allows promises to settle
      await vi.runAllTimersAsync()

      // Wait for the promise to reject (after all retries exhausted)
      try {
        await promise
      } catch {
        // Expected to fail after all retries
      }
    }

    // Verify circuit is open
    const state = testUtils.getCircuitBreakerState('customers.create')
    expect(state.state).toBe('open')
    expect(state.failures).toBeGreaterThanOrEqual(5)

    // Verify underlying Stripe API was called 5 * maxAttempts times (5 failures × 3 retries each)
    expect(mockStripe.customers.create).toHaveBeenCalledTimes(5 * retryConfig.maxAttempts)

    // 6th call should throw circuit breaker error immediately (no retries)
    await expect(
      testProtectedStripe.customers.create({ email: 'test@example.com' }),
    ).rejects.toThrow('Circuit breaker is OPEN')

    // Verify 6th call was NOT made to underlying Stripe (circuit breaker short-circuited)
    expect(mockStripe.customers.create).toHaveBeenCalledTimes(5 * retryConfig.maxAttempts)
  })

  it('should transition to half-open after reset timeout', async () => {
    const breakerConfig = testUtils.getCircuitBreakerConfig()

    // CRITICAL FIX: Use fake timer's Date.now() when setting lastFailureTime
    const fakeNow = Date.now()

    // First, open the circuit with lastFailureTime in the past
    testUtils.setCircuitBreakerState('paymentIntents.create', {
      state: 'open',
      failures: 5,
      lastFailureTime: fakeNow - (breakerConfig.resetTimeout + 1000), // Set in the past
      successCount: 0,
    })

    // Advance time past reset timeout (30 seconds)
    await vi.advanceTimersByTimeAsync(breakerConfig.resetTimeout + 1000)

    // Circuit should now be half-open (allows one attempt)
    const isOpen = testUtils.isCircuitOpen('paymentIntents.create')
    expect(isOpen).toBe(false) // Should be false (half-open allows attempt)

    // Reset Stripe cache first
    testUtils.resetStripe()

    // Use factory pattern to inject mock Stripe instance
    const mockStripe = {
      paymentIntents: {
        create: vi.fn().mockResolvedValue({
          id: 'pi_test',
          object: 'payment_intent' as const,
          client_secret: 'pi_test_secret',
          amount: 1000,
          currency: 'usd',
          status: 'requires_payment_method' as const,
        }),
      },
    } as unknown as Stripe

    const testProtectedStripe = testUtils.createTestProtectedStripe(mockStripe)

    // Make a call - this should trigger state check and transition to half-open
    await testProtectedStripe.paymentIntents.create({
      amount: 1000,
      currency: 'usd',
    })

    const stateAfterCall = testUtils.getCircuitBreakerState('paymentIntents.create')
    expect(stateAfterCall.state).toBe('half-open')

    // After one success in half-open, successCount should be 1
    const stateAfter = testUtils.getCircuitBreakerState('paymentIntents.create')
    expect(stateAfter.successCount).toBe(1)
    expect(stateAfter.state).toBe('half-open') // Still half-open (needs 2 successes)
  })

  it('should close circuit after successThreshold successes in half-open', async () => {
    const breakerConfig = testUtils.getCircuitBreakerConfig()

    // CRITICAL FIX: Use fake timer's Date.now() when setting lastFailureTime
    const fakeNow = Date.now()

    // Set circuit to half-open with 1 success already
    testUtils.setCircuitBreakerState('customers.create', {
      state: 'half-open',
      failures: 0,
      lastFailureTime: fakeNow - breakerConfig.resetTimeout,
      successCount: 1, // Already has 1 success
    })

    // Reset Stripe cache first
    testUtils.resetStripe()

    // Use factory pattern to inject mock Stripe instance
    const mockStripe = {
      customers: {
        create: vi.fn().mockResolvedValue({
          id: 'cus_test',
          object: 'customer' as const,
          email: 'test@example.com',
        }),
      },
    } as unknown as Stripe

    const testProtectedStripe = testUtils.createTestProtectedStripe(mockStripe)

    await testProtectedStripe.customers.create({ email: 'test@example.com' })

    // Circuit should now be closed (2 successes = successThreshold)
    const state = testUtils.getCircuitBreakerState('customers.create')
    expect(state.state).toBe('closed')
    expect(state.successCount).toBe(0) // Reset after closing
    expect(state.failures).toBe(0)
  })

  it('should isolate circuit breakers per operation', async () => {
    // CRITICAL FIX: Use fake timer's Date.now() when setting lastFailureTime
    const fakeNow = Date.now()

    // Open circuit for customers.create
    testUtils.setCircuitBreakerState('customers.create', {
      state: 'open',
      failures: 5,
      lastFailureTime: fakeNow,
      successCount: 0,
    })

    // Reset Stripe cache first
    testUtils.resetStripe()

    // Use factory pattern to inject mock Stripe instance
    const mockStripe = {
      paymentIntents: {
        create: vi.fn().mockResolvedValue({
          id: 'pi_test',
          object: 'payment_intent' as const,
          client_secret: 'pi_test_secret',
          amount: 1000,
          currency: 'usd',
          status: 'requires_payment_method' as const,
        }),
      },
    } as unknown as Stripe

    const testProtectedStripe = testUtils.createTestProtectedStripe(mockStripe)

    const result = await testProtectedStripe.paymentIntents.create({
      amount: 1000,
      currency: 'usd',
    })

    expect(result).toBeDefined()

    // Verify customers.create is still open
    const customersState = testUtils.getCircuitBreakerState('customers.create')
    expect(customersState.state).toBe('open')

    // Verify paymentIntents.create is closed (not affected)
    const paymentIntentsState = testUtils.getCircuitBreakerState('paymentIntents.create')
    expect(paymentIntentsState.state).toBe('closed')
  })
})
