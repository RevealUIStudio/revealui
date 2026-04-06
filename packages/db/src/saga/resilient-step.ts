/**
 * Resilient Step Wrapper
 *
 * Wraps saga steps with retry (exponential backoff). Transient NeonDB
 * failures (network timeouts, 5xx responses) are retried before triggering
 * compensation.
 *
 * Uses a lightweight built-in retry to avoid a dependency on @revealui/resilience
 * from the db package. For advanced circuit breaker integration, wrap the saga
 * step's execute function with @revealui/resilience directly at the call site.
 *
 * @example
 * ```typescript
 * const steps = [
 *   resilientStep({
 *     name: 'insert-license',
 *     execute: async (ctx) => { ... },
 *     compensate: async (ctx, output) => { ... },
 *   }, { maxRetries: 5, baseDelay: 200 }),
 * ];
 *
 * await executeSaga(db, 'provision', key, steps);
 * ```
 */

import type { SagaContext, SagaRetryOptions, SagaStep } from './types.js';

/**
 * Simple retry with exponential backoff and jitter.
 * Avoids importing @revealui/resilience to keep the db package dependency-free.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number,
  maxDelay: number,
): Promise<T> {
  let lastError: Error = new Error('Retry failed');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const exponentialDelay = baseDelay * 2 ** attempt;
      const jitter = Math.random() * baseDelay;
      const delay = Math.min(exponentialDelay + jitter, maxDelay);

      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    }
  }

  throw lastError;
}

/**
 * Wrap a saga step with retry logic.
 *
 * The execute function is retried on transient failures (network errors,
 * 5xx status codes). The compensate function is NOT retried — compensations
 * should be idempotent and infallible by design.
 *
 * @param step - The saga step to wrap
 * @param options - Retry configuration
 * @returns A new SagaStep with retry-wrapped execute
 */
export function resilientStep<TOutput = unknown>(
  step: SagaStep<TOutput>,
  options?: SagaRetryOptions,
): SagaStep<TOutput> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelay ?? 500;
  const maxDelay = options?.maxDelay ?? 10_000;

  return {
    name: step.name,

    execute: async (ctx: SagaContext): Promise<TOutput> => {
      return retryWithBackoff(() => step.execute(ctx), maxRetries, baseDelay, maxDelay);
    },

    // Compensations are not retried — they must be idempotent
    compensate: step.compensate,
  };
}
