/**
 * Circuit breaker test helpers
 *
 * PURPOSE: Test Stripe circuit breaker state transitions and retry logic
 *
 * IMPORTANT: These helpers access test-only exports from stripeClient.ts
 * (prefixed with __) to enable white-box testing of circuit breaker behavior.
 */

// @ts-ignore - services package exports need to be configured
import {
  __CIRCUIT_BREAKER_CONFIG,
  __circuitBreakers,
  __getCircuitBreaker,
  __isCircuitOpen,
  __RETRY_CONFIG,
  __recordFailure,
  __recordSuccess,
  __resetStripe,
} from '@revealui/services/stripe/stripeClient'

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open'

/**
 * Circuit breaker state snapshot
 */
export interface CircuitBreakerSnapshot {
  state: CircuitState
  failures: number
  successCount: number
  lastFailureTime: number
  isOpen: boolean
}

/**
 * Get circuit breaker state for an operation
 *
 * @param operationName - Operation name (e.g., 'customers.create')
 * @returns Circuit breaker state snapshot
 */
export function getCircuitBreakerState(operationName: string): CircuitBreakerSnapshot {
  const breaker = __getCircuitBreaker(operationName)
  return {
    state: breaker.state,
    failures: breaker.failures,
    successCount: breaker.successCount,
    lastFailureTime: breaker.lastFailureTime,
    isOpen: __isCircuitOpen(operationName),
  }
}

/**
 * Reset circuit breaker for a specific operation
 *
 * @param operationName - Operation name to reset
 */
export function resetCircuitBreaker(operationName: string): void {
  __circuitBreakers.delete(operationName)
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  __circuitBreakers.clear()
}

/**
 * Simulate multiple failures to trigger circuit breaker
 *
 * @param operationName - Operation name
 * @param count - Number of failures to simulate
 */
export function simulateFailures(operationName: string, count: number): void {
  for (let i = 0; i < count; i++) {
    __recordFailure(operationName)
  }
}

/**
 * Simulate multiple successes (useful for half-open → closed transition)
 *
 * @param operationName - Operation name
 * @param count - Number of successes to simulate
 */
export function simulateSuccesses(operationName: string, count: number): void {
  for (let i = 0; i < count; i++) {
    __recordSuccess(operationName)
  }
}

/**
 * Manually set circuit breaker state (for testing)
 *
 * @param operationName - Operation name
 * @param state - Desired state
 */
export function setCircuitBreakerState(operationName: string, state: CircuitState): void {
  const breaker = __getCircuitBreaker(operationName)
  breaker.state = state
  if (state === 'open') {
    breaker.lastFailureTime = Date.now()
  }
}

/**
 * Advance circuit breaker time (for testing timeout transitions)
 *
 * @param operationName - Operation name
 * @param ms - Milliseconds to advance
 */
export function advanceCircuitBreakerTime(operationName: string, ms: number): void {
  const breaker = __getCircuitBreaker(operationName)
  breaker.lastFailureTime = Date.now() - ms
}

/**
 * Get circuit breaker configuration constants
 */
export function getCircuitBreakerConfig() {
  return {
    failureThreshold: __CIRCUIT_BREAKER_CONFIG.failureThreshold,
    resetTimeout: __CIRCUIT_BREAKER_CONFIG.resetTimeout,
    successThreshold: __CIRCUIT_BREAKER_CONFIG.successThreshold,
  }
}

/**
 * Get retry configuration constants
 */
export function getRetryConfig() {
  return {
    maxAttempts: __RETRY_CONFIG.maxAttempts,
    backoff: __RETRY_CONFIG.backoff,
    timeout: __RETRY_CONFIG.timeout,
  }
}

/**
 * Reset the cached Stripe instance (test-only)
 */
export function resetStripeInstance(): void {
  __resetStripe()
}

/**
 * Wait for circuit breaker to transition to half-open state
 *
 * @param operationName - Operation name
 * @param maxWaitMs - Maximum wait time in milliseconds (default: 35000ms)
 * @returns Promise that resolves when circuit is half-open or rejects on timeout
 */
export async function waitForHalfOpen(
  operationName: string,
  maxWaitMs: number = 35000,
): Promise<void> {
  const startTime = Date.now()

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const state = getCircuitBreakerState(operationName)

      if (state.state === 'half-open') {
        clearInterval(interval)
        resolve()
      } else if (Date.now() - startTime >= maxWaitMs) {
        clearInterval(interval)
        reject(new Error(`Circuit breaker did not transition to half-open within ${maxWaitMs}ms`))
      }
    }, 100)
  })
}

/**
 * Create a test scenario for circuit breaker state machine
 *
 * @param operationName - Operation name
 * @returns Object with helper methods for testing state transitions
 */
export function createCircuitBreakerScenario(operationName: string) {
  return {
    /**
     * Get current state
     */
    getState: () => getCircuitBreakerState(operationName),

    /**
     * Transition from CLOSED → OPEN (5 failures)
     */
    transitionToOpen: () => {
      const config = getCircuitBreakerConfig()
      simulateFailures(operationName, config.failureThreshold)
    },

    /**
     * Transition from OPEN → HALF-OPEN (wait for reset timeout)
     */
    transitionToHalfOpen: () => {
      const config = getCircuitBreakerConfig()
      advanceCircuitBreakerTime(operationName, config.resetTimeout)
    },

    /**
     * Transition from HALF-OPEN → CLOSED (2 successes)
     */
    transitionToClosed: () => {
      setCircuitBreakerState(operationName, 'half-open')
      const config = getCircuitBreakerConfig()
      simulateSuccesses(operationName, config.successThreshold)
    },

    /**
     * Transition from HALF-OPEN → OPEN (1 failure)
     */
    transitionBackToOpen: () => {
      setCircuitBreakerState(operationName, 'half-open')
      simulateFailures(operationName, 1)
    },

    /**
     * Reset to initial state
     */
    reset: () => {
      resetCircuitBreaker(operationName)
    },
  }
}
