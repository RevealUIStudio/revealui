/**
 * Circuit Breaker & Retry Logic Tests
 *
 * Tests the actual protectedStripe wrapper's resilience mechanisms:
 * - Circuit breaker state transitions (closed → open → half-open → closed)
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Non-retryable vs retryable error classification
 */

import type Stripe from 'stripe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __CIRCUIT_BREAKER_CONFIG,
  __circuitBreakers,
  __getCircuitBreaker,
  __isCircuitOpen,
  __recordFailure,
  __recordSuccess,
  createProtectedStripe,
} from '../src/stripe/stripeClient.js'

// Mock the config module
vi.mock('@revealui/config', () => ({
  default: {
    stripe: { secretKey: 'sk_test_mock' },
  },
}))

// Mock the logger
vi.mock('../src/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('Circuit Breaker', () => {
  beforeEach(() => {
    // Reset all circuit breakers between tests
    __circuitBreakers.clear()
  })

  describe('state transitions', () => {
    it('starts in closed state', () => {
      const breaker = __getCircuitBreaker('test.operation')
      expect(breaker.state).toBe('closed')
      expect(breaker.failures).toBe(0)
    })

    it('transitions to open after reaching failure threshold', () => {
      const operationName = 'test.open'
      for (let i = 0; i < __CIRCUIT_BREAKER_CONFIG.failureThreshold; i++) {
        __recordFailure(operationName)
      }
      const breaker = __getCircuitBreaker(operationName)
      expect(breaker.state).toBe('open')
    })

    it('remains closed below failure threshold', () => {
      const operationName = 'test.belowThreshold'
      for (let i = 0; i < __CIRCUIT_BREAKER_CONFIG.failureThreshold - 1; i++) {
        __recordFailure(operationName)
      }
      const breaker = __getCircuitBreaker(operationName)
      expect(breaker.state).toBe('closed')
      expect(breaker.failures).toBe(__CIRCUIT_BREAKER_CONFIG.failureThreshold - 1)
    })

    it('resets failure count on success', () => {
      const operationName = 'test.resetOnSuccess'
      __recordFailure(operationName)
      __recordFailure(operationName)
      __recordSuccess(operationName)

      const breaker = __getCircuitBreaker(operationName)
      expect(breaker.failures).toBe(0)
      expect(breaker.state).toBe('closed')
    })

    it('transitions from half-open to closed after success threshold', () => {
      const operationName = 'test.halfOpenToClose'
      const breaker = __getCircuitBreaker(operationName)

      // Manually set to half-open
      breaker.state = 'half-open'
      breaker.successCount = 0

      for (let i = 0; i < __CIRCUIT_BREAKER_CONFIG.successThreshold; i++) {
        __recordSuccess(operationName)
      }

      expect(breaker.state).toBe('closed')
      expect(breaker.successCount).toBe(0)
    })

    it('increments success count in half-open state', () => {
      const operationName = 'test.halfOpenIncrement'
      const breaker = __getCircuitBreaker(operationName)
      breaker.state = 'half-open'
      breaker.successCount = 0

      __recordSuccess(operationName)

      expect(breaker.successCount).toBe(1)
      // Not yet at threshold, should remain half-open
      expect(breaker.state).toBe('half-open')
    })
  })

  describe('isCircuitOpen', () => {
    it('returns false when circuit is closed', () => {
      expect(__isCircuitOpen('test.closed')).toBe(false)
    })

    it('returns true when circuit is open and within reset timeout', () => {
      const operationName = 'test.openBlocked'
      for (let i = 0; i < __CIRCUIT_BREAKER_CONFIG.failureThreshold; i++) {
        __recordFailure(operationName)
      }
      expect(__isCircuitOpen(operationName)).toBe(true)
    })

    it('transitions to half-open after reset timeout', () => {
      const operationName = 'test.halfOpenTimeout'
      const breaker = __getCircuitBreaker(operationName)
      breaker.state = 'open'
      breaker.lastFailureTime = Date.now() - __CIRCUIT_BREAKER_CONFIG.resetTimeout - 1

      expect(__isCircuitOpen(operationName)).toBe(false)
      expect(breaker.state).toBe('half-open')
    })

    it('returns false when circuit is half-open (allows probe)', () => {
      const operationName = 'test.halfOpenProbe'
      const breaker = __getCircuitBreaker(operationName)
      breaker.state = 'half-open'

      expect(__isCircuitOpen(operationName)).toBe(false)
    })
  })
})

describe('protectedStripe resilience', () => {
  let mockStripeInstance: Stripe

  beforeEach(() => {
    __circuitBreakers.clear()

    mockStripeInstance = {
      customers: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
        del: vi.fn(),
        list: vi.fn(),
      },
      products: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
        list: vi.fn(),
      },
      prices: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
        list: vi.fn(),
      },
      paymentIntents: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
      },
      checkout: {
        sessions: {
          create: vi.fn(),
          retrieve: vi.fn(),
        },
      },
      billingPortal: {
        sessions: {
          create: vi.fn(),
        },
      },
      subscriptions: {
        retrieve: vi.fn(),
        update: vi.fn(),
        cancel: vi.fn(),
      },
      webhooks: {} as Stripe['webhooks'],
      balance: {} as Stripe['balance'],
    } as unknown as Stripe
  })

  it('passes through successful calls', async () => {
    const mockCustomer = { id: 'cus_123', email: 'test@test.com' } as Stripe.Customer
    ;(mockStripeInstance.customers.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockCustomer,
    )

    const client = createProtectedStripe(mockStripeInstance)
    const result = await client.customers.create({ email: 'test@test.com' })

    expect(result.id).toBe('cus_123')
    expect(mockStripeInstance.customers.create).toHaveBeenCalledOnce()
  })

  it('throws immediately for non-retryable errors', async () => {
    const stripeError = new Error('No such customer: cus_invalid')
    ;(mockStripeInstance.customers.retrieve as ReturnType<typeof vi.fn>).mockRejectedValue(
      stripeError,
    )

    const client = createProtectedStripe(mockStripeInstance)

    await expect(client.customers.retrieve('cus_invalid')).rejects.toThrow('No such customer')
    // Should only attempt once for non-retryable errors
    expect(mockStripeInstance.customers.retrieve).toHaveBeenCalledOnce()
  })

  it('blocks calls when circuit breaker is open', async () => {
    const client = createProtectedStripe(mockStripeInstance)

    // Force circuit open by recording enough failures
    for (let i = 0; i < __CIRCUIT_BREAKER_CONFIG.failureThreshold; i++) {
      __recordFailure('customers.create')
    }

    await expect(client.customers.create({ email: 'test@test.com' })).rejects.toThrow(
      'Circuit breaker is OPEN',
    )
    // Stripe SDK should never be called when circuit is open
    expect(mockStripeInstance.customers.create).not.toHaveBeenCalled()
  })

  it('retries on ETIMEDOUT errors', async () => {
    const timeoutError = new Error('connect ETIMEDOUT 1.2.3.4:443')
    const mockCustomer = { id: 'cus_123' } as Stripe.Customer
    ;(mockStripeInstance.customers.create as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(mockCustomer)

    const client = createProtectedStripe(mockStripeInstance)
    const result = await client.customers.create({ email: 'test@test.com' })

    expect(result.id).toBe('cus_123')
    expect(mockStripeInstance.customers.create).toHaveBeenCalledTimes(2)
  })

  it('retries on network errors', async () => {
    const networkError = new Error('ECONNREFUSED')
    const mockCustomer = { id: 'cus_123' } as Stripe.Customer
    ;(mockStripeInstance.customers.create as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(mockCustomer)

    const client = createProtectedStripe(mockStripeInstance)
    const result = await client.customers.create({ email: 'test@test.com' })

    expect(result.id).toBe('cus_123')
    expect(mockStripeInstance.customers.create).toHaveBeenCalledTimes(2)
  })

  it('gives up after max retry attempts for retryable errors', async () => {
    const networkError = new Error('connect ECONNREFUSED 127.0.0.1:443')
    ;(mockStripeInstance.customers.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      networkError,
    )

    const client = createProtectedStripe(mockStripeInstance)

    await expect(client.customers.create({ email: 'test@test.com' })).rejects.toThrow(
      'failed after 3 attempts',
    )
    expect(mockStripeInstance.customers.create).toHaveBeenCalledTimes(3)
  })
})
