/**
 * Test-only utilities for accessing circuit breaker and retry internals.
 * DO NOT import this in production code - only use in test files.
 *
 * Access via Vitest alias: import { testUtils } from 'services/stripeTestUtils'
 */

import type Stripe from 'stripe'

// Import __-prefixed exports (test-only, not for production use)
import {
  __CIRCUIT_BREAKER_CONFIG as CIRCUIT_BREAKER_CONFIG,
  __circuitBreakers as circuitBreakers,
  createProtectedStripe,
  __getCircuitBreaker as getCircuitBreaker,
  __isCircuitOpen as isCircuitOpen,
  __RETRY_CONFIG as RETRY_CONFIG,
  __recordFailure as recordFailure,
  __recordSuccess as recordSuccess,
  __resetStripe as resetStripe,
} from './stripeClient'

export const testUtils = {
  /**
   * Get all circuit breaker states (for inspection in tests)
   */
  getCircuitBreakers: () => circuitBreakers,

  /**
   * Get circuit breaker state for a specific operation
   */
  getCircuitBreakerState: (operationName: string) => {
    return getCircuitBreaker(operationName)
  },

  /**
   * Reset circuit breaker state for a specific operation
   */
  resetCircuitBreaker: (operationName: string) => {
    circuitBreakers.set(operationName, {
      state: 'closed',
      failures: 0,
      lastFailureTime: 0,
      successCount: 0,
    })
  },

  /**
   * Reset all circuit breakers (for test cleanup)
   */
  resetAllCircuitBreakers: () => {
    circuitBreakers.clear()
  },

  /**
   * Get current circuit breaker config
   */
  getCircuitBreakerConfig: () => ({ ...CIRCUIT_BREAKER_CONFIG }),

  /**
   * Get current retry config
   */
  getRetryConfig: () => ({ ...RETRY_CONFIG }),

  /**
   * Manually set circuit breaker state (for testing state transitions)
   */
  setCircuitBreakerState: (
    operationName: string,
    state: {
      state: 'closed' | 'open' | 'half-open'
      failures: number
      lastFailureTime: number
      successCount: number
    },
  ) => {
    circuitBreakers.set(operationName, state)
  },

  /**
   * Manually record a failure (for testing)
   */
  recordFailure: (operationName: string) => {
    recordFailure(operationName)
  },

  /**
   * Manually record a success (for testing)
   */
  recordSuccess: (operationName: string) => {
    recordSuccess(operationName)
  },

  /**
   * Check if circuit is open (for testing)
   */
  isCircuitOpen: (operationName: string) => {
    return isCircuitOpen(operationName)
  },

  /**
   * Reset the cached Stripe instance (for testing)
   * This clears the module-level cache
   */
  resetStripe: () => {
    resetStripe()
  },

  /**
   * Create a protected Stripe client with a test instance (for testing)
   * This uses the factory pattern to inject a mock Stripe instance
   */
  createTestProtectedStripe: (testInstance: Stripe) => {
    return createProtectedStripe(testInstance)
  },
}
