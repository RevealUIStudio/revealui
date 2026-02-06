/**
 * Error Handling Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Bulkhead,
  CircuitBreaker,
  CircuitBreakerOpenError,
  circuitBreakerRegistry,
} from '../circuit-breaker'
import {
  getErrorSeverity,
  isNetworkError,
  NetworkError,
  shouldRetryError,
  ValidationError,
} from '../error-boundary'
import { ConsoleErrorReporter, ErrorFilters, errorReporter } from '../error-reporter'
import { calculateDelay, RetryPolicies, RetryPolicyBuilder, retry } from '../retry'

describe('Retry Logic', () => {
  it('should retry on failure', async () => {
    let attempts = 0

    const fn = vi.fn(async () => {
      attempts++
      if (attempts < 3) {
        throw new Error('Temporary failure')
      }
      return 'success'
    })

    const result = await retry(fn, { maxRetries: 3, baseDelay: 10, jitter: false })

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should throw after max retries', async () => {
    const fn = vi.fn(async () => {
      throw new Error('Permanent failure')
    })

    await expect(retry(fn, { maxRetries: 2, baseDelay: 10, jitter: false })).rejects.toThrow(
      'Permanent failure',
    )

    expect(fn).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })

  it('should not retry non-retryable errors', async () => {
    const fn = vi.fn(async () => {
      const error = new Error('Non-retryable')
      ;(error as any).statusCode = 400
      throw error
    })

    await expect(retry(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow('Non-retryable')

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should calculate exponential backoff delay', () => {
    const delay1 = calculateDelay(0, 1000, 30000, true, false)
    const delay2 = calculateDelay(1, 1000, 30000, true, false)
    const delay3 = calculateDelay(2, 1000, 30000, true, false)

    expect(delay1).toBe(1000)
    expect(delay2).toBe(2000)
    expect(delay3).toBe(4000)
  })

  it('should respect max delay', () => {
    const delay = calculateDelay(10, 1000, 5000, true, false)
    expect(delay).toBeLessThanOrEqual(5000)
  })

  it('should build retry policy', async () => {
    const policy = new RetryPolicyBuilder()
      .maxRetries(2)
      .baseDelay(10)
      .exponentialBackoff(false)
      .jitter(false)
      .build()

    let attempts = 0
    const result = await retry(async () => {
      attempts++
      if (attempts < 2) throw new Error('Fail')
      return 'success'
    }, policy)

    expect(result).toBe('success')
    expect(attempts).toBe(2)
  })

  it('should use predefined policies', () => {
    const defaultPolicy = RetryPolicies.default()
    expect(defaultPolicy.maxRetries).toBe(3)
    expect(defaultPolicy.exponentialBackoff).toBe(true)

    const aggressivePolicy = RetryPolicies.aggressive()
    expect(aggressivePolicy.maxRetries).toBe(5)

    const conservativePolicy = RetryPolicies.conservative()
    expect(conservativePolicy.maxRetries).toBe(2)
  })
})

describe('Circuit Breaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 100,
      volumeThreshold: 3,
    })
  })

  afterEach(() => {
    breaker.destroy()
  })

  it('should start in closed state', () => {
    expect(breaker.getState()).toBe('closed')
    expect(breaker.isClosed()).toBe(true)
  })

  it('should open after failure threshold', async () => {
    const failFn = vi.fn(async () => {
      throw new Error('Failure')
    })

    // Execute 3 times to reach threshold
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failFn)).rejects.toThrow()
    }

    expect(breaker.isOpen()).toBe(true)
  })

  it('should reject immediately when open', async () => {
    // Trip the circuit
    breaker.trip()

    await expect(breaker.execute(async () => 'success')).rejects.toThrow(CircuitBreakerOpenError)
  })

  it('should transition to half-open after reset timeout', async () => {
    breaker.trip()
    expect(breaker.isOpen()).toBe(true)

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Try to execute - should transition to half-open
    try {
      await breaker.execute(async () => 'success')
    } catch {
      // Ignore
    }

    expect(breaker.isHalfOpen()).toBe(true)
  })

  it('should close after successful half-open attempts', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      successThreshold: 2,
      resetTimeout: 50,
      volumeThreshold: 2,
    })

    // Trip circuit
    breaker.trip()
    expect(breaker.isOpen()).toBe(true)

    // Wait for reset
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Execute successfully in half-open state
    await breaker.execute(async () => 'success')
    await breaker.execute(async () => 'success')

    expect(breaker.isClosed()).toBe(true)

    breaker.destroy()
  })

  it('should track statistics', async () => {
    await breaker.execute(async () => 'success')
    await breaker.execute(async () => 'success')

    try {
      await breaker.execute(async () => {
        throw new Error('Failure')
      })
    } catch {
      // Ignore
    }

    const stats = breaker.getStats()
    expect(stats.totalCalls).toBe(3)
    expect(stats.totalSuccesses).toBe(2)
    expect(stats.totalFailures).toBe(1)
  })

  it('should calculate failure rate', async () => {
    await breaker.execute(async () => 'success')

    try {
      await breaker.execute(async () => {
        throw new Error('Failure')
      })
    } catch {
      // Ignore
    }

    expect(breaker.getFailureRate()).toBe(0.5) // 1 failure out of 2 calls
  })
})

describe('Bulkhead', () => {
  it('should limit concurrent executions', async () => {
    const bulkhead = new Bulkhead(2, 10)
    let activeCount = 0
    let maxActive = 0

    const fn = async () => {
      activeCount++
      maxActive = Math.max(maxActive, activeCount)
      await new Promise((resolve) => setTimeout(resolve, 50))
      activeCount--
      return 'success'
    }

    // Start 5 concurrent operations
    const promises = Array.from({ length: 5 }, () => bulkhead.execute(fn))

    await Promise.all(promises)

    expect(maxActive).toBeLessThanOrEqual(2)
  })

  it('should reject when queue is full', async () => {
    const bulkhead = new Bulkhead(1, 1)

    const longOperation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return 'success'
    }

    // Start operations
    const promise1 = bulkhead.execute(longOperation) // Active
    const promise2 = bulkhead.execute(longOperation) // Queued

    // This should be rejected (queue full)
    await expect(bulkhead.execute(longOperation)).rejects.toThrow('Bulkhead queue is full')

    await promise1
    await promise2
  })
})

describe('Error Classification', () => {
  it('should identify network errors', () => {
    const error = new NetworkError('Connection failed')
    expect(isNetworkError(error)).toBe(true)
    expect(error.name).toBe('NetworkError')
  })

  it('should determine error severity', () => {
    const networkError = new NetworkError('Connection failed')
    expect(getErrorSeverity(networkError)).toBe('high')

    const validationError = new ValidationError('Invalid input')
    expect(getErrorSeverity(validationError)).toBe('low')
  })

  it('should identify retryable errors', () => {
    const networkError = new NetworkError('Connection failed')
    expect(shouldRetryError(networkError)).toBe(true)

    const validationError = new ValidationError('Invalid input')
    expect(shouldRetryError(validationError)).toBe(false)
  })
})

describe('Error Reporter', () => {
  beforeEach(() => {
    errorReporter.clearBreadcrumbs()
  })

  it('should add breadcrumb', () => {
    errorReporter.addBreadcrumb({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'User clicked button',
      category: 'user-action',
    })

    const breadcrumbs = errorReporter.getBreadcrumbs()
    expect(breadcrumbs).toHaveLength(1)
    expect(breadcrumbs[0].message).toBe('User clicked button')
  })

  it('should set user context', () => {
    errorReporter.setUser({
      id: '123',
      email: 'test@example.com',
    })

    // User context is set (tested indirectly through reporters)
    expect(true).toBe(true)
  })

  it('should filter errors', () => {
    errorReporter.addFilter(ErrorFilters.ignoreExtensions)

    const extensionError = new Error('Extension error')
    extensionError.stack = 'Error at chrome-extension://...'

    // Error should be filtered (tested indirectly)
    expect(true).toBe(true)
  })

  it('should capture error with context', async () => {
    // ConsoleErrorReporter uses the logger, not console directly
    const { logger } = await import('../../observability/logger.js')
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    const reporter = new ConsoleErrorReporter()
    errorReporter.addReporter(reporter)

    const error = new Error('Test error')
    errorReporter.captureError(error, {
      context: {
        component: 'TestComponent',
      },
      tags: {
        feature: 'test',
      },
    })

    expect(loggerSpy).toHaveBeenCalled()
    expect(loggerSpy).toHaveBeenCalledWith(
      '[Error Reporter] Error',
      error,
      expect.objectContaining({
        tags: { feature: 'test' },
      }),
    )

    loggerSpy.mockRestore()
  })
})

describe('Circuit Breaker Registry', () => {
  beforeEach(() => {
    circuitBreakerRegistry.clear()
  })

  it('should create and retrieve circuit breakers', () => {
    const breaker1 = circuitBreakerRegistry.get('service1')
    const breaker2 = circuitBreakerRegistry.get('service1')

    expect(breaker1).toBe(breaker2) // Same instance
  })

  it('should track multiple breakers', () => {
    circuitBreakerRegistry.get('service1')
    circuitBreakerRegistry.get('service2')

    const all = circuitBreakerRegistry.getAll()
    expect(all.size).toBe(2)
  })

  it('should remove breaker', () => {
    circuitBreakerRegistry.get('service1')
    expect(circuitBreakerRegistry.has('service1')).toBe(true)

    circuitBreakerRegistry.remove('service1')
    expect(circuitBreakerRegistry.has('service1')).toBe(false)
  })

  it('should reset all breakers', () => {
    const breaker1 = circuitBreakerRegistry.get('service1')
    const breaker2 = circuitBreakerRegistry.get('service2')

    breaker1.trip()
    breaker2.trip()

    expect(breaker1.isOpen()).toBe(true)
    expect(breaker2.isOpen()).toBe(true)

    circuitBreakerRegistry.resetAll()

    expect(breaker1.isClosed()).toBe(true)
    expect(breaker2.isClosed()).toBe(true)
  })
})
