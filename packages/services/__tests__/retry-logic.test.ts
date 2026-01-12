import type Stripe from 'stripe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testUtils } from '../src/core/stripe/stripeClient.test-utils'

describe('Retry Logic', () => {
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

  it('should retry on timeout errors with exponential backoff', async () => {
    const retryConfig = testUtils.getRetryConfig()

    // Reset Stripe cache first
    testUtils.resetStripe()

    // Track call times to verify backoff
    const callTimes: number[] = []
    const mockError = new Error('timeout')

    const mockStripe = {
      paymentIntents: {
        create: vi.fn().mockImplementation(() => {
          callTimes.push(Date.now())
          return Promise.reject(mockError)
        }),
      },
    } as unknown as Stripe

    const testProtectedStripe = testUtils.createTestProtectedStripe(mockStripe)

    // Trigger retryable failure
    const promise = testProtectedStripe.paymentIntents.create({
      amount: 1000,
      currency: 'usd',
    })

    // CRITICAL FIX: Use runAllTimersAsync() to properly advance all timers
    // This handles backoff delays and allows promises to settle correctly
    await vi.runAllTimersAsync()

    // Should fail after maxAttempts
    await expect(promise).rejects.toThrow()

    // CRITICAL FIX: Verify underlying Stripe API was called maxAttempts times (not just once)
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledTimes(retryConfig.maxAttempts)

    // Verify delays are non-decreasing (backoff increases)
    if (callTimes.length > 1) {
      for (let i = 1; i < callTimes.length; i++) {
        const delay = callTimes[i] - callTimes[i - 1]
        const expectedMinDelay = retryConfig.backoff[i - 1] || 0
        expect(delay).toBeGreaterThanOrEqual(expectedMinDelay)
      }
    }
  })

  it('should succeed on later retry attempt after initial failures', async () => {
    const retryConfig = testUtils.getRetryConfig()

    // Reset Stripe cache first
    testUtils.resetStripe()

    let attemptCount = 0
    const mockError = new Error('timeout')

    // Use factory pattern to inject mock Stripe instance
    const mockStripe = {
      customers: {
        create: vi.fn().mockImplementation(() => {
          attemptCount++
          // Fail first 2 attempts, succeed on 3rd
          if (attemptCount < retryConfig.maxAttempts) {
            return Promise.reject(mockError)
          }
          return Promise.resolve({
            id: 'cus_test',
            object: 'customer' as const,
            email: 'test@example.com',
          } as Stripe.Customer)
        }),
      },
    } as unknown as Stripe

    const testProtectedStripe = testUtils.createTestProtectedStripe(mockStripe)

    // Trigger operation that will retry
    const promise = testProtectedStripe.customers.create({ email: 'test@example.com' })

    // Run all timers to advance through retries
    await vi.runAllTimersAsync()

    // Should succeed after retries
    const result = await promise
    expect(result).toBeDefined()
    expect(result.id).toBe('cus_test')

    // Verify it was called maxAttempts times (failed twice, succeeded once)
    expect(mockStripe.customers.create).toHaveBeenCalledTimes(retryConfig.maxAttempts)
  })

  it('should timeout slow operations using withTimeout wrapper', async () => {
    const retryConfig = testUtils.getRetryConfig()

    // Reset Stripe cache first
    testUtils.resetStripe()

    // Use factory pattern to inject mock Stripe instance with slow operation
    const mockStripe = {
      paymentIntents: {
        create: vi.fn().mockImplementation(() => {
          // Return a promise that resolves after timeout duration
          return new Promise<Stripe.PaymentIntent>((resolve) => {
            setTimeout(() => {
              resolve({
                id: 'pi_test',
                object: 'payment_intent' as const,
                client_secret: 'pi_test_secret',
                amount: 1000,
                currency: 'usd',
                status: 'requires_payment_method' as const,
              } as Stripe.PaymentIntent)
            }, retryConfig.timeout + 1000) // Longer than timeout
          })
        }),
      },
    } as unknown as Stripe

    const testProtectedStripe = testUtils.createTestProtectedStripe(mockStripe)

    // Trigger operation that will timeout
    const promise = testProtectedStripe.paymentIntents.create({
      amount: 1000,
      currency: 'usd',
    })

    // Advance timers to trigger timeout
    await vi.advanceTimersByTimeAsync(retryConfig.timeout)

    // Should reject with timeout error
    await expect(promise).rejects.toThrow('timed out')
  })

  it('should not retry on validation errors', async () => {
    const validationError = new Error('Invalid parameter')
    // Not a timeout/network error, so should not retry

    // Reset Stripe cache first
    testUtils.resetStripe()

    // Use factory pattern to inject mock Stripe instance
    const mockStripe = {
      customers: {
        create: vi.fn().mockRejectedValue(validationError),
      },
    } as unknown as Stripe

    const testProtectedStripe = testUtils.createTestProtectedStripe(mockStripe)

    await expect(testProtectedStripe.customers.create({ email: 'invalid' })).rejects.toThrow(
      'Invalid parameter',
    )

    // Should only be called once (no retries)
    expect(mockStripe.customers.create).toHaveBeenCalledTimes(1)
  })
})
