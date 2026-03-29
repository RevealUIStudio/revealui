/**
 * Supabase Resilience Layer Tests
 *
 * Tests the circuit breaker + retry protection for Supabase operations:
 * - Circuit breaker state transitions (closed -> open -> half-open -> closed)
 * - Retry logic with exponential backoff for retryable errors
 * - Non-retryable error handling (immediate throw)
 * - Timeout handling
 * - Circuit open rejection
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __supabaseCircuitBreakerConfig,
  __supabaseCircuitBreakers,
  __supabaseGetCircuitBreaker,
  __supabaseIsCircuitOpen,
  __supabaseRecordFailure,
  __supabaseRecordSuccess,
  __supabaseRetryConfig,
  withSupabaseResilience,
} from '../src/supabase/resilience.js';

// Mock the logger
vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('Supabase Circuit Breaker', () => {
  beforeEach(() => {
    __supabaseCircuitBreakers.clear();
  });

  describe('state transitions', () => {
    it('starts in closed state', () => {
      const breaker = __supabaseGetCircuitBreaker('test.operation');
      expect(breaker.state).toBe('closed');
      expect(breaker.failures).toBe(0);
      expect(breaker.successCount).toBe(0);
    });

    it('transitions to open after reaching failure threshold', () => {
      const operationName = 'test.open';
      for (let i = 0; i < __supabaseCircuitBreakerConfig.failureThreshold; i++) {
        __supabaseRecordFailure(operationName);
      }
      const breaker = __supabaseGetCircuitBreaker(operationName);
      expect(breaker.state).toBe('open');
    });

    it('remains closed below failure threshold', () => {
      const operationName = 'test.belowThreshold';
      for (let i = 0; i < __supabaseCircuitBreakerConfig.failureThreshold - 1; i++) {
        __supabaseRecordFailure(operationName);
      }
      const breaker = __supabaseGetCircuitBreaker(operationName);
      expect(breaker.state).toBe('closed');
      expect(breaker.failures).toBe(__supabaseCircuitBreakerConfig.failureThreshold - 1);
    });

    it('resets failure count on success', () => {
      const operationName = 'test.resetOnSuccess';
      __supabaseRecordFailure(operationName);
      __supabaseRecordFailure(operationName);
      __supabaseRecordSuccess(operationName);

      const breaker = __supabaseGetCircuitBreaker(operationName);
      expect(breaker.failures).toBe(0);
      expect(breaker.state).toBe('closed');
    });

    it('transitions from half-open to closed after success threshold', () => {
      const operationName = 'test.halfOpenToClose';
      const breaker = __supabaseGetCircuitBreaker(operationName);

      // Manually set to half-open
      breaker.state = 'half-open';
      breaker.successCount = 0;

      for (let i = 0; i < __supabaseCircuitBreakerConfig.successThreshold; i++) {
        __supabaseRecordSuccess(operationName);
      }

      expect(breaker.state).toBe('closed');
      expect(breaker.successCount).toBe(0);
    });

    it('increments success count in half-open state', () => {
      const operationName = 'test.halfOpenIncrement';
      const breaker = __supabaseGetCircuitBreaker(operationName);
      breaker.state = 'half-open';
      breaker.successCount = 0;

      __supabaseRecordSuccess(operationName);

      expect(breaker.successCount).toBe(1);
      expect(breaker.state).toBe('half-open');
    });

    it('resets successCount when transitioning to open', () => {
      const operationName = 'test.openResetSuccess';
      const breaker = __supabaseGetCircuitBreaker(operationName);
      breaker.successCount = 1;

      for (let i = 0; i < __supabaseCircuitBreakerConfig.failureThreshold; i++) {
        __supabaseRecordFailure(operationName);
      }

      expect(breaker.state).toBe('open');
      expect(breaker.successCount).toBe(0);
    });

    it('transitions from open to closed on success (direct reset)', () => {
      const operationName = 'test.openDirectClose';
      const breaker = __supabaseGetCircuitBreaker(operationName);
      breaker.state = 'open';

      __supabaseRecordSuccess(operationName);

      expect(breaker.state).toBe('closed');
      expect(breaker.successCount).toBe(0);
    });
  });

  describe('isCircuitOpen', () => {
    it('returns false when circuit is closed', () => {
      expect(__supabaseIsCircuitOpen('test.closed')).toBe(false);
    });

    it('returns true when circuit is open and within reset timeout', () => {
      const operationName = 'test.openBlocked';
      for (let i = 0; i < __supabaseCircuitBreakerConfig.failureThreshold; i++) {
        __supabaseRecordFailure(operationName);
      }
      expect(__supabaseIsCircuitOpen(operationName)).toBe(true);
    });

    it('transitions to half-open after reset timeout', () => {
      const operationName = 'test.halfOpenTimeout';
      const breaker = __supabaseGetCircuitBreaker(operationName);
      breaker.state = 'open';
      breaker.lastFailureTime = Date.now() - __supabaseCircuitBreakerConfig.resetTimeout - 1;

      expect(__supabaseIsCircuitOpen(operationName)).toBe(false);
      expect(breaker.state).toBe('half-open');
    });

    it('returns false when circuit is half-open (allows probe)', () => {
      const operationName = 'test.halfOpenProbe';
      const breaker = __supabaseGetCircuitBreaker(operationName);
      breaker.state = 'half-open';

      expect(__supabaseIsCircuitOpen(operationName)).toBe(false);
    });
  });
});

describe('withSupabaseResilience', () => {
  beforeEach(() => {
    __supabaseCircuitBreakers.clear();
  });

  it('passes through successful operations', async () => {
    const result = await withSupabaseResilience(
      () => Promise.resolve({ data: [1, 2, 3], error: null }),
      'test.success',
    );

    expect(result).toEqual({ data: [1, 2, 3], error: null });
  });

  it('throws immediately for non-retryable errors', async () => {
    const nonRetryableError = new Error('Invalid query syntax');

    await expect(
      withSupabaseResilience(() => Promise.reject(nonRetryableError), 'test.nonRetryable'),
    ).rejects.toThrow('Invalid query syntax');
  });

  it('retries on timeout errors', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout waiting for response'))
      .mockResolvedValueOnce({ data: 'ok' });

    const result = await withSupabaseResilience(operation, 'test.retryTimeout');

    expect(result).toEqual({ data: 'ok' });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('retries on ECONNREFUSED errors', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5432'))
      .mockResolvedValueOnce({ data: 'ok' });

    const result = await withSupabaseResilience(operation, 'test.retryEconnrefused');

    expect(result).toEqual({ data: 'ok' });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('retries on ETIMEDOUT errors', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('connect ETIMEDOUT 1.2.3.4:443'))
      .mockResolvedValueOnce({ data: 'ok' });

    const result = await withSupabaseResilience(operation, 'test.retryEtimedout');

    expect(result).toEqual({ data: 'ok' });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('retries on network errors', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ data: 'ok' });

    const result = await withSupabaseResilience(operation, 'test.retryNetwork');

    expect(result).toEqual({ data: 'ok' });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('retries on fetch failed errors', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce({ data: 'ok' });

    const result = await withSupabaseResilience(operation, 'test.retryFetchFailed');

    expect(result).toEqual({ data: 'ok' });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('gives up after max retry attempts for retryable errors', async () => {
    const networkError = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    const operation = vi.fn().mockRejectedValue(networkError);

    await expect(withSupabaseResilience(operation, 'test.exhaustRetries')).rejects.toThrow(
      `Supabase:test.exhaustRetries failed after ${__supabaseRetryConfig.maxAttempts} attempts`,
    );

    expect(operation).toHaveBeenCalledTimes(__supabaseRetryConfig.maxAttempts);
  });

  it('blocks calls when circuit breaker is open', async () => {
    // Force circuit open
    for (let i = 0; i < __supabaseCircuitBreakerConfig.failureThreshold; i++) {
      __supabaseRecordFailure('test.circuitOpen');
    }

    await expect(
      withSupabaseResilience(() => Promise.resolve('should not run'), 'test.circuitOpen'),
    ).rejects.toThrow('Circuit breaker is OPEN for Supabase:test.circuitOpen');
  });

  it('records failure on non-retryable error', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Invalid query'));

    await expect(withSupabaseResilience(operation, 'test.failureRecorded')).rejects.toThrow(
      'Invalid query',
    );

    const breaker = __supabaseGetCircuitBreaker('test.failureRecorded');
    expect(breaker.failures).toBe(1);
  });

  it('records failure after exhausting retries', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('network error'));

    await expect(withSupabaseResilience(operation, 'test.failureAfterRetries')).rejects.toThrow();

    const breaker = __supabaseGetCircuitBreaker('test.failureAfterRetries');
    expect(breaker.failures).toBe(1);
  });

  it('records success on successful operation', async () => {
    // First cause a failure to increment counter
    __supabaseRecordFailure('test.successRecorded');
    expect(__supabaseGetCircuitBreaker('test.successRecorded').failures).toBe(1);

    await withSupabaseResilience(() => Promise.resolve('ok'), 'test.successRecorded');

    const breaker = __supabaseGetCircuitBreaker('test.successRecorded');
    expect(breaker.failures).toBe(0);
  });

  it('handles non-Error thrown values in retryable path', async () => {
    const operation = vi.fn().mockRejectedValue('string error');

    // Non-Error values are non-retryable (the instanceof Error check fails)
    await expect(withSupabaseResilience(operation, 'test.nonErrorThrown')).rejects.toBe(
      'string error',
    );

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('config has expected default values', () => {
    expect(__supabaseCircuitBreakerConfig.failureThreshold).toBe(5);
    expect(__supabaseCircuitBreakerConfig.resetTimeout).toBe(30_000);
    expect(__supabaseCircuitBreakerConfig.successThreshold).toBe(2);

    expect(__supabaseRetryConfig.maxAttempts).toBe(3);
    expect(__supabaseRetryConfig.timeout).toBe(10_000);
    expect(__supabaseRetryConfig.backoff).toEqual([100, 200, 400]);
  });
});
