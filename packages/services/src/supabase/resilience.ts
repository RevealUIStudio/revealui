/**
 * Supabase Resilience Layer
 *
 * Provides circuit breaker + retry protection for Supabase operations,
 * matching the resilience pattern used in packages/services/src/stripe/stripeClient.ts.
 *
 * NOTE: Circuit breaker state is in-memory (per-instance).
 * TODO: For multi-instance deployments, replace with Redis-backed state.
 * Uses createLogger from @revealui/core. Wire up to alerting when circuit opens.
 */

import { createLogger } from '@revealui/core/observability/logger';

const logger = createLogger({ service: 'Supabase' });

// ---------------------------------------------------------------------------
// Circuit breaker types
// ---------------------------------------------------------------------------

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  successCount: number;
}

// ---------------------------------------------------------------------------
// Configuration — mirrors Stripe circuit breaker config for consistency
// ---------------------------------------------------------------------------

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 30_000,
  successThreshold: 2,
};

const RETRY_CONFIG = {
  maxAttempts: 3,
  backoff: [100, 200, 400] as const,
  timeout: 10_000,
};

// ---------------------------------------------------------------------------
// Circuit breaker state store (in-memory)
// ---------------------------------------------------------------------------

const circuitBreakers = new Map<string, CircuitBreakerState>();

function getCircuitBreaker(operationName: string): CircuitBreakerState {
  if (!circuitBreakers.has(operationName)) {
    circuitBreakers.set(operationName, {
      state: 'closed',
      failures: 0,
      lastFailureTime: 0,
      successCount: 0,
    });
  }
  // biome-ignore lint/style/noNonNullAssertion: just set above
  return circuitBreakers.get(operationName)!;
}

function recordFailure(operationName: string): void {
  const breaker = getCircuitBreaker(operationName);
  breaker.failures++;
  breaker.lastFailureTime = Date.now();

  if (breaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    if (breaker.state !== 'open') {
      logger.warn(`Circuit breaker OPENED for Supabase:${operationName}`, {
        failures: breaker.failures,
        threshold: CIRCUIT_BREAKER_CONFIG.failureThreshold,
      });
    }
    breaker.state = 'open';
    breaker.successCount = 0;
  }
}

function recordSuccess(operationName: string): void {
  const breaker = getCircuitBreaker(operationName);
  breaker.failures = 0;

  if (breaker.state === 'half-open') {
    breaker.successCount++;
    if (breaker.successCount >= CIRCUIT_BREAKER_CONFIG.successThreshold) {
      logger.info(`Circuit breaker CLOSED for Supabase:${operationName}`);
      breaker.state = 'closed';
      breaker.successCount = 0;
    }
  } else if (breaker.state === 'open') {
    breaker.state = 'closed';
    breaker.successCount = 0;
  }
}

function isCircuitOpen(operationName: string): boolean {
  const breaker = getCircuitBreaker(operationName);

  if (breaker.state === 'closed') return false;

  if (breaker.state === 'open') {
    const elapsed = Date.now() - breaker.lastFailureTime;
    if (elapsed >= CIRCUIT_BREAKER_CONFIG.resetTimeout) {
      breaker.state = 'half-open';
      breaker.successCount = 0;
      return false;
    }
    return true;
  }

  return false; // half-open: allow one attempt
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Supabase operation timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Wrap a Supabase operation with circuit breaker + exponential-backoff retry.
 *
 * Usage:
 * ```ts
 * const data = await withSupabaseResilience(
 *   () => supabase.from('documents').select('*'),
 *   'documents.select',
 * )
 * ```
 */
export async function withSupabaseResilience<T>(
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  if (isCircuitOpen(operationName)) {
    logger.error(`Circuit breaker OPEN for Supabase:${operationName}`, undefined, {
      operation: operationName,
      state: 'open',
    });
    throw new Error(
      `Circuit breaker is OPEN for Supabase:${operationName}. Service may be unavailable.`,
    );
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const result = await withTimeout(operation(), RETRY_CONFIG.timeout);
      recordSuccess(operationName);
      return result;
    } catch (error) {
      lastError = error;

      const isRetryable =
        error instanceof Error &&
        (error.message.includes('timeout') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('network') ||
          error.message.includes('fetch failed'));

      if (!isRetryable) {
        recordFailure(operationName);
        logger.error(
          `Supabase:${operationName} failed (non-retryable)`,
          error instanceof Error ? error : new Error(String(error)),
          { attempt: attempt + 1 },
        );
        throw error;
      }

      logger.warn(`Supabase:${operationName} failed (retryable), retrying...`, {
        attempt: attempt + 1,
        maxAttempts: RETRY_CONFIG.maxAttempts,
        error: error instanceof Error ? error.message : String(error),
      });

      if (attempt < RETRY_CONFIG.maxAttempts - 1) {
        const backoffMs = RETRY_CONFIG.backoff[attempt] ?? RETRY_CONFIG.backoff.at(-1) ?? 1000;
        await sleep(backoffMs);
      }
    }
  }

  recordFailure(operationName);
  throw lastError instanceof Error
    ? new Error(
        `Supabase:${operationName} failed after ${RETRY_CONFIG.maxAttempts} attempts: ${lastError.message}`,
      )
    : new Error(`Supabase:${operationName} failed after ${RETRY_CONFIG.maxAttempts} attempts`);
}

// Test-only exports
export const __supabaseCircuitBreakers = circuitBreakers;
export const __supabaseCircuitBreakerConfig = CIRCUIT_BREAKER_CONFIG;
export const __supabaseRetryConfig = RETRY_CONFIG;
export const __supabaseGetCircuitBreaker = getCircuitBreaker;
export const __supabaseRecordFailure = recordFailure;
export const __supabaseRecordSuccess = recordSuccess;
export const __supabaseIsCircuitOpen = isCircuitOpen;
