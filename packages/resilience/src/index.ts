/**
 * @revealui/resilience — Resilience infrastructure for RevealUI applications.
 *
 * - circuit-breaker: Circuit breaker pattern, bulkhead, adaptive thresholds
 * - retry: Exponential backoff, retry policies, batch retry, fallback
 * - logger: Configurable internal logger (defaults to console)
 */

export type {
  CircuitBreakerConfig,
  CircuitBreakerStats,
  CircuitState,
} from './circuit-breaker.js';
export {
  AdaptiveCircuitBreaker,
  Bulkhead,
  CircuitBreak,
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
  createCircuitBreakerMiddleware,
  createResilientFunction,
  fetchWithCircuitBreaker,
  ResilientOperation,
  withCircuitBreaker,
} from './circuit-breaker.js';
// Circuit breaker state stores (pluggable backends)
export type {
  CircuitBreakerSnapshot,
  CircuitBreakerStore,
} from './circuit-breaker-store.js';
export {
  InMemoryCircuitBreakerStore,
  PGliteCircuitBreakerStore,
} from './circuit-breaker-store.js';
export type { ResilienceLogger } from './logger.js';
export { configureResilienceLogger, getResilienceLogger } from './logger.js';
export type { HttpError, RetryConfig, RetryOptions } from './retry.js';
export {
  calculateDelay,
  createRetryMiddleware,
  ExponentialBackoff,
  fetchWithRetry,
  globalRetryConfig,
  Retryable,
  RetryableOperation,
  RetryPolicies,
  RetryPolicyBuilder,
  retry,
  retryBatch,
  retryIf,
  retryUntil,
  retryWithFallback,
  sleep,
} from './retry.js';
