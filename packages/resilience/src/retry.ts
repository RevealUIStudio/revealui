/**
 * Retry Logic for API Calls
 *
 * Implements exponential backoff and retry strategies
 */

import { randomInt } from 'node:crypto';
import { getResilienceLogger } from './logger.js';

export interface HttpError extends Error {
  statusCode?: number;
  response?: Response;
}

export interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBackoff?: boolean;
  jitter?: boolean;
  retryableErrors?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

export interface RetryOptions {
  signal?: AbortSignal;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  exponentialBackoff: true,
  jitter: true,
  retryableErrors: (error: Error) => {
    // Check for explicit non-retryable status codes (4xx client errors)
    if ('statusCode' in error) {
      const statusCode = (error as HttpError).statusCode;
      // Don't retry 4xx errors except 408 (timeout) and 429 (rate limit)
      if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
        return statusCode === 408 || statusCode === 429;
      }
    }
    // Retry all other errors by default (network errors, 5xx, generic errors)
    return true;
  },
  onRetry: () => {
    // No-op default  -  consumers override via config
  },
};

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
  options: RetryOptions = {},
): Promise<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error = new Error('Retry failed');

  for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
    try {
      // Check if aborted
      if (options.signal?.aborted) {
        throw new Error('Request aborted');
      }

      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's the last attempt
      if (attempt === mergedConfig.maxRetries) {
        throw lastError;
      }

      // Don't retry if error is not retryable
      if (!mergedConfig.retryableErrors(lastError)) {
        throw lastError;
      }

      // Call retry callback
      mergedConfig.onRetry(lastError, attempt + 1);

      // Calculate delay
      const delay = calculateDelay(
        attempt,
        mergedConfig.baseDelay,
        mergedConfig.maxDelay,
        mergedConfig.exponentialBackoff,
        mergedConfig.jitter,
      );

      // Wait before retrying
      await sleep(delay, options.signal);
    }
  }

  throw lastError;
}

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  exponentialBackoff: boolean,
  jitter: boolean,
): number {
  let delay = baseDelay;

  if (exponentialBackoff) {
    // Exponential backoff: 2^attempt * baseDelay
    delay = Math.min(baseDelay * 2 ** attempt, maxDelay);
  }

  if (jitter) {
    // Add cryptographically random jitter (±25%), clamped to maxDelay
    const jitterAmount = Math.ceil(delay * 0.25);
    if (jitterAmount > 0) {
      delay = delay + randomInt(jitterAmount * 2 + 1) - jitterAmount;
    }
  }

  return Math.floor(Math.min(delay, maxDelay));
}

/**
 * Sleep with abort support
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Request aborted'));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Request aborted'));
      });
    }
  });
}

/**
 * Retry wrapper for fetch
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  config?: RetryConfig,
): Promise<Response> {
  const abortController = new AbortController();
  const signal = init?.signal || abortController.signal;

  return retry(
    async () => {
      const response = await fetch(url, {
        ...init,
        signal,
      });

      // Throw on error status
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as HttpError;
        error.statusCode = response.status;
        error.response = response;
        throw error;
      }

      return response;
    },
    {
      ...config,
      retryableErrors: (error) => {
        // Check custom retryable errors first
        if (config?.retryableErrors && !config.retryableErrors(error)) {
          return false;
        }

        // Don't retry 4xx errors (except 408, 429)
        if ('statusCode' in error) {
          const statusCode = (error as HttpError).statusCode;
          if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
            return statusCode === 408 || statusCode === 429;
          }
        }

        return true;
      },
    },
    { signal },
  );
}

/**
 * Retry wrapper class
 */
export class RetryableOperation<T> {
  private config: Required<RetryConfig>;
  private abortController: AbortController;
  private attempts: number = 0;
  private lastError?: Error;

  constructor(
    private fn: () => Promise<T>,
    config: RetryConfig = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.abortController = new AbortController();
  }

  /**
   * Execute with retry
   */
  async execute(): Promise<T> {
    return retry(this.fn, this.config, { signal: this.abortController.signal });
  }

  /**
   * Abort operation
   */
  abort(): void {
    this.abortController.abort();
  }

  /**
   * Get retry statistics
   */
  getStats(): {
    attempts: number;
    lastError?: Error;
  } {
    return {
      attempts: this.attempts,
      lastError: this.lastError,
    };
  }
}

/**
 * Retry decorator
 */
export function Retryable(config?: RetryConfig) {
  return (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return retry(() => originalMethod.apply(this, args), config);
    };

    return descriptor;
  };
}

/**
 * Create retry middleware for API client
 */
export function createRetryMiddleware<TRequest = unknown, TResponse = unknown>(
  config: RetryConfig = {},
) {
  return async (_request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> => {
    return retry(next, config);
  };
}

/**
 * Batch retry - retry multiple operations
 */
export async function retryBatch<T>(
  operations: Array<() => Promise<T>>,
  config: RetryConfig = {},
): Promise<Array<T | Error>> {
  return Promise.all(
    operations.map(async (op) => {
      try {
        return await retry(op, config);
      } catch (error) {
        return error instanceof Error ? error : new Error(String(error));
      }
    }),
  );
}

/**
 * Retry with fallback
 */
export async function retryWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  config: RetryConfig = {},
): Promise<T> {
  try {
    return await retry(primary, config);
  } catch (error) {
    getResilienceLogger().warn('Primary operation failed, trying fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback();
  }
}

/**
 * Conditional retry - only retry if condition is met
 */
export async function retryIf<T>(
  fn: () => Promise<T>,
  condition: (error: Error, attempt: number) => boolean,
  config: RetryConfig = {},
): Promise<T> {
  return retry(fn, {
    ...config,
    retryableErrors: (error) => {
      // Check original retryable condition first
      const originalCheck =
        config.retryableErrors?.(error) ?? DEFAULT_CONFIG.retryableErrors(error);
      if (!originalCheck) return false;

      // Then check custom condition
      return condition(error, 0);
    },
  });
}

/**
 * Retry until condition is met
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  config: RetryConfig = {},
  maxAttempts: number = 10,
): Promise<T> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const result = await fn();

      if (predicate(result)) {
        return result;
      }

      // Result doesn't match predicate, treat as retryable error
      attempts++;

      if (attempts >= maxAttempts) {
        throw new Error('Max attempts reached without matching predicate');
      }

      const delay = calculateDelay(
        attempts - 1,
        config.baseDelay ?? DEFAULT_CONFIG.baseDelay,
        config.maxDelay ?? DEFAULT_CONFIG.maxDelay,
        config.exponentialBackoff ?? DEFAULT_CONFIG.exponentialBackoff,
        config.jitter ?? DEFAULT_CONFIG.jitter,
      );

      await sleep(delay);
    } catch (error) {
      attempts++;

      if (attempts >= maxAttempts) {
        throw error;
      }

      const delay = calculateDelay(
        attempts - 1,
        config.baseDelay ?? DEFAULT_CONFIG.baseDelay,
        config.maxDelay ?? DEFAULT_CONFIG.maxDelay,
        config.exponentialBackoff ?? DEFAULT_CONFIG.exponentialBackoff,
        config.jitter ?? DEFAULT_CONFIG.jitter,
      );

      await sleep(delay);
    }
  }

  throw new Error('Max attempts reached');
}

/**
 * Exponential backoff iterator
 */
export class ExponentialBackoff implements AsyncIterable<number> {
  constructor(
    private baseDelay: number = 1000,
    private maxDelay: number = 30000,
    private maxAttempts: number = 10,
    private jitter: boolean = true,
  ) {}

  async *[Symbol.asyncIterator](): AsyncIterator<number> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const delay = calculateDelay(attempt, this.baseDelay, this.maxDelay, true, this.jitter);

      yield delay;

      await sleep(delay);
    }
  }
}

/**
 * Retry policy builder
 */
export class RetryPolicyBuilder {
  private config: Partial<Required<RetryConfig>> = {};

  /**
   * Set max retries
   */
  maxRetries(count: number): this {
    this.config.maxRetries = count;
    return this;
  }

  /**
   * Set base delay
   */
  baseDelay(ms: number): this {
    this.config.baseDelay = ms;
    return this;
  }

  /**
   * Set max delay
   */
  maxDelay(ms: number): this {
    this.config.maxDelay = ms;
    return this;
  }

  /**
   * Enable/disable exponential backoff
   */
  exponentialBackoff(enabled: boolean = true): this {
    this.config.exponentialBackoff = enabled;
    return this;
  }

  /**
   * Enable/disable jitter
   */
  jitter(enabled: boolean = true): this {
    this.config.jitter = enabled;
    return this;
  }

  /**
   * Set custom retryable errors function
   */
  retryOn(fn: (error: Error) => boolean): this {
    this.config.retryableErrors = fn;
    return this;
  }

  /**
   * Set retry callback
   */
  onRetry(fn: (error: Error, attempt: number) => void): this {
    this.config.onRetry = fn;
    return this;
  }

  /**
   * Build retry config
   */
  build(): RetryConfig {
    return this.config;
  }

  /**
   * Execute function with built policy
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return retry(fn, this.build());
  }
}

/**
 * Common retry policies
 */
export const RetryPolicies = {
  /**
   * Default policy - 3 retries with exponential backoff
   */
  default: (): RetryConfig => ({
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBackoff: true,
    jitter: true,
  }),

  /**
   * Aggressive policy - more retries, faster backoff
   */
  aggressive: (): RetryConfig => ({
    maxRetries: 5,
    baseDelay: 500,
    maxDelay: 10000,
    exponentialBackoff: true,
    jitter: true,
  }),

  /**
   * Conservative policy - fewer retries, longer backoff
   */
  conservative: (): RetryConfig => ({
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 60000,
    exponentialBackoff: true,
    jitter: true,
  }),

  /**
   * Linear backoff policy
   */
  linear: (): RetryConfig => ({
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    exponentialBackoff: false,
    jitter: false,
  }),

  /**
   * Immediate retry policy - no delay
   */
  immediate: (): RetryConfig => ({
    maxRetries: 3,
    baseDelay: 0,
    maxDelay: 0,
    exponentialBackoff: false,
    jitter: false,
  }),

  /**
   * Network error only policy
   */
  networkOnly: (): RetryConfig => ({
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBackoff: true,
    jitter: true,
    retryableErrors: (error) => error.name === 'NetworkError',
  }),

  /**
   * Idempotent operations policy (safe to retry)
   */
  idempotent: (): RetryConfig => ({
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBackoff: true,
    jitter: true,
  }),
};

/**
 * Global retry configuration
 */
class GlobalRetryConfig {
  private config: RetryConfig = RetryPolicies.default();

  /**
   * Set global retry config
   */
  setConfig(config: RetryConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get global retry config
   */
  getConfig(): RetryConfig {
    return this.config;
  }

  /**
   * Reset to default config
   */
  reset(): void {
    this.config = RetryPolicies.default();
  }
}

export const globalRetryConfig = new GlobalRetryConfig();
