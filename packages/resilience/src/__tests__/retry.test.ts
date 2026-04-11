/**
 * Retry Logic Tests
 *
 * Comprehensive tests for retry, calculateDelay, sleep, fetchWithRetry,
 * RetryableOperation, RetryPolicyBuilder, retryBatch, retryWithFallback,
 * retryIf, retryUntil, ExponentialBackoff, RetryPolicies, and GlobalRetryConfig.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the resilience logger before importing modules that use it
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};
vi.mock('../logger.js', () => ({
  getResilienceLogger: () => mockLogger,
  configureResilienceLogger: vi.fn(),
}));

// Mock crypto.randomInt to make jitter deterministic
vi.mock('node:crypto', () => ({
  randomInt: vi.fn((max: number) => Math.floor(max / 2)),
}));

import type { HttpError } from '../retry.js';
import {
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
} from '../retry.js';

describe('calculateDelay', () => {
  it('should return base delay for attempt 0 with exponential backoff', () => {
    expect(calculateDelay(0, 1000, 30000, true, false)).toBe(1000);
  });

  it('should double delay per attempt with exponential backoff', () => {
    expect(calculateDelay(1, 1000, 30000, true, false)).toBe(2000);
    expect(calculateDelay(2, 1000, 30000, true, false)).toBe(4000);
    expect(calculateDelay(3, 1000, 30000, true, false)).toBe(8000);
  });

  it('should cap at maxDelay', () => {
    expect(calculateDelay(10, 1000, 5000, true, false)).toBe(5000);
  });

  it('should use base delay without exponential backoff', () => {
    expect(calculateDelay(0, 1000, 30000, false, false)).toBe(1000);
    expect(calculateDelay(5, 1000, 30000, false, false)).toBe(1000);
  });

  it('should apply jitter when enabled', () => {
    // With our mock, randomInt returns max/2, so jitter should add ~0
    const delay = calculateDelay(0, 1000, 30000, true, true);
    // Should be around 1000 ±250
    expect(delay).toBeGreaterThanOrEqual(750);
    expect(delay).toBeLessThanOrEqual(1250);
  });

  it('should clamp jitter result to maxDelay', () => {
    const delay = calculateDelay(10, 1000, 5000, true, true);
    expect(delay).toBeLessThanOrEqual(5000);
  });
});

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve after the specified duration', async () => {
    const p = sleep(100);
    vi.advanceTimersByTime(100);
    await expect(p).resolves.toBeUndefined();
  });

  it('should reject immediately if signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(sleep(100, controller.signal)).rejects.toThrow('Request aborted');
  });

  it('should reject when signal is aborted during sleep', async () => {
    const controller = new AbortController();
    const p = sleep(1000, controller.signal);

    controller.abort();
    await expect(p).rejects.toThrow('Request aborted');
  });
});

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on first success', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await retry(fn, { maxRetries: 3, baseDelay: 10, jitter: false });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should retry on failure and succeed', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error('temporary');
      return 'recovered';
    });

    const p = retry(fn, { maxRetries: 3, baseDelay: 10, jitter: false });

    // Advance timers for the sleep between retries
    await vi.advanceTimersByTimeAsync(100);

    const result = await p;
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries exhausted', async () => {
    vi.useRealTimers(); // Use real timers  -  fast baseDelay makes this instant
    const fn = vi.fn(async () => {
      throw new Error('permanent');
    });

    await expect(
      retry(fn, { maxRetries: 2, baseDelay: 1, maxDelay: 5, jitter: false }),
    ).rejects.toThrow('permanent');

    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should not retry non-retryable errors (4xx)', async () => {
    const fn = vi.fn(async () => {
      const error = new Error('Bad Request') as HttpError;
      error.statusCode = 400;
      throw error;
    });

    await expect(retry(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow('Bad Request');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should retry 408 (timeout) errors', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) {
        const error = new Error('Timeout') as HttpError;
        error.statusCode = 408;
        throw error;
      }
      return 'ok';
    });

    const p = retry(fn, { maxRetries: 3, baseDelay: 10, jitter: false });
    await vi.advanceTimersByTimeAsync(100);

    expect(await p).toBe('ok');
  });

  it('should retry 429 (rate limit) errors', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) {
        const error = new Error('Rate limited') as HttpError;
        error.statusCode = 429;
        throw error;
      }
      return 'ok';
    });

    const p = retry(fn, { maxRetries: 3, baseDelay: 10, jitter: false });
    await vi.advanceTimersByTimeAsync(100);

    expect(await p).toBe('ok');
  });

  it('should call onRetry callback on each retry', async () => {
    const onRetry = vi.fn();
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return 'ok';
    });

    const p = retry(fn, { maxRetries: 3, baseDelay: 10, jitter: false, onRetry });
    await vi.advanceTimersByTimeAsync(200);
    await p;

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2);
  });

  it('should respect abort signal', async () => {
    const controller = new AbortController();
    const fn = vi.fn(async () => {
      throw new Error('fail');
    });

    controller.abort();

    await expect(
      retry(fn, { maxRetries: 3, baseDelay: 10 }, { signal: controller.signal }),
    ).rejects.toThrow('Request aborted');
  });

  it('should handle non-Error throws', async () => {
    const fn = vi.fn(async () => {
      throw 'string error';
    });

    const p = retry(fn, { maxRetries: 0, baseDelay: 10 });
    await expect(p).rejects.toThrow('string error');
  });

  it('should use custom retryableErrors function', async () => {
    const fn = vi.fn(async () => {
      throw new Error('custom-non-retryable');
    });

    await expect(
      retry(fn, {
        maxRetries: 3,
        baseDelay: 10,
        retryableErrors: () => false,
      }),
    ).rejects.toThrow('custom-non-retryable');

    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should return response on success', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

    const response = await fetchWithRetry('https://example.com');
    expect(response).toBe(mockResponse);
  });

  it('should throw HttpError on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('error', { status: 500, statusText: 'Internal Server Error' }),
    );

    const p = fetchWithRetry('https://example.com', undefined, {
      maxRetries: 0,
      baseDelay: 10,
    });

    await expect(p).rejects.toThrow('HTTP 500');
  });

  it('should not retry 4xx errors (except 408, 429)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('not found', { status: 404, statusText: 'Not Found' }),
    );

    await expect(
      fetchWithRetry('https://example.com', undefined, {
        maxRetries: 3,
        baseDelay: 10,
      }),
    ).rejects.toThrow('HTTP 404');

    expect(fetch).toHaveBeenCalledOnce();
  });

  it('should retry 429 responses', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response('rate limited', { status: 429, statusText: 'Too Many Requests' }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const p = fetchWithRetry('https://example.com', undefined, {
      maxRetries: 3,
      baseDelay: 10,
      jitter: false,
    });

    await vi.advanceTimersByTimeAsync(100);
    const response = await p;
    expect(response.status).toBe(200);
  });

  it('should respect custom retryableErrors config', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('error', { status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(
      fetchWithRetry('https://example.com', undefined, {
        maxRetries: 3,
        baseDelay: 10,
        retryableErrors: () => false, // Never retry
      }),
    ).rejects.toThrow('HTTP 500');

    expect(fetch).toHaveBeenCalledOnce();
  });

  it('should pass request init to fetch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('ok', { status: 200 }));

    await fetchWithRetry('https://example.com', {
      method: 'POST',
      body: '{}',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
  });
});

describe('RetryableOperation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should execute the function with retry', async () => {
    let calls = 0;
    const op = new RetryableOperation(
      async () => {
        calls++;
        if (calls < 2) throw new Error('fail');
        return 'ok';
      },
      { maxRetries: 3, baseDelay: 10, jitter: false },
    );

    const p = op.execute();
    await vi.advanceTimersByTimeAsync(100);
    expect(await p).toBe('ok');
  });

  it('should support abort via abort()', async () => {
    vi.useRealTimers(); // Avoid unhandled rejection from fake timers + abort
    const op = new RetryableOperation(
      async () => {
        throw new Error('fail');
      },
      { maxRetries: 10, baseDelay: 1, maxDelay: 5, jitter: false },
    );

    const p = op.execute();
    // Abort after a tick so the first attempt starts
    await new Promise((resolve) => setTimeout(resolve, 5));
    op.abort();

    await expect(p).rejects.toThrow();
  });

  it('should return stats', () => {
    const op = new RetryableOperation(async () => 'ok');
    const stats = op.getStats();
    expect(stats.attempts).toBe(0);
    expect(stats.lastError).toBeUndefined();
  });
});

describe('Retryable decorator (manual application)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should wrap a method with retry logic', async () => {
    let calls = 0;

    const descriptor: PropertyDescriptor = {
      value: async (): Promise<string> => {
        calls++;
        if (calls < 2) throw new Error('fail');
        return 'ok';
      },
      writable: true,
      configurable: true,
    };

    const result = Retryable({ maxRetries: 3, baseDelay: 10, jitter: false })(
      {},
      'fetch',
      descriptor,
    );
    const wrapped = result.value as () => Promise<string>;
    const p = wrapped();
    await vi.advanceTimersByTimeAsync(100);
    expect(await p).toBe('ok');
  });
});

describe('createRetryMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should wrap the next function with retry', async () => {
    const middleware = createRetryMiddleware({ maxRetries: 2, baseDelay: 10, jitter: false });
    let calls = 0;

    const next = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error('fail');
      return { status: 200 };
    });

    const p = middleware({}, next);
    await vi.advanceTimersByTimeAsync(100);
    expect(await p).toEqual({ status: 200 });
  });
});

describe('retryBatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should run all operations and return results', async () => {
    const ops = [async () => 1, async () => 2, async () => 3];

    const p = retryBatch(ops, { maxRetries: 0 });
    const results = await p;

    expect(results).toEqual([1, 2, 3]);
  });

  it('should return Error for failed operations without throwing', async () => {
    const ops = [
      async () => 'ok',
      async () => {
        throw new Error('fail');
      },
    ];

    const p = retryBatch(ops, { maxRetries: 0, baseDelay: 10 });
    const results = await p;

    expect(results[0]).toBe('ok');
    expect(results[1]).toBeInstanceOf(Error);
    expect((results[1] as Error).message).toBe('fail');
  });

  it('should handle non-Error throws in batch', async () => {
    const ops = [
      async () => {
        throw 'string error';
      },
    ];

    const p = retryBatch(ops, { maxRetries: 0 });
    const results = await p;

    expect(results[0]).toBeInstanceOf(Error);
    expect((results[0] as Error).message).toBe('string error');
  });
});

describe('retryWithFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return primary result on success', async () => {
    const result = await retryWithFallback(
      async () => 'primary',
      async () => 'fallback',
      { maxRetries: 0 },
    );
    expect(result).toBe('primary');
  });

  it('should use fallback when primary fails all retries', async () => {
    const p = retryWithFallback(
      async () => {
        throw new Error('primary fail');
      },
      async () => 'fallback-result',
      { maxRetries: 1, baseDelay: 10, jitter: false },
    );

    await vi.advanceTimersByTimeAsync(200);
    expect(await p).toBe('fallback-result');
  });
});

describe('retryIf', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should retry when condition returns true', async () => {
    let calls = 0;

    const p = retryIf(
      async () => {
        calls++;
        if (calls < 2) throw new Error('retryable');
        return 'ok';
      },
      () => true,
      { maxRetries: 3, baseDelay: 10, jitter: false },
    );

    await vi.advanceTimersByTimeAsync(100);
    expect(await p).toBe('ok');
  });

  it('should not retry when condition returns false', async () => {
    const fn = vi.fn(async () => {
      throw new Error('non-retryable');
    });

    const p = retryIf(fn, () => false, { maxRetries: 3, baseDelay: 10 });

    await expect(p).rejects.toThrow('non-retryable');
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('retryUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return immediately when predicate matches', async () => {
    const result = await retryUntil(
      async () => 42,
      (r) => r === 42,
      { baseDelay: 10, jitter: false },
    );
    expect(result).toBe(42);
  });

  it('should retry until predicate matches', async () => {
    vi.useRealTimers();
    let calls = 0;

    const result = await retryUntil(
      async () => {
        calls++;
        return calls;
      },
      (r) => r >= 3,
      { baseDelay: 1, maxDelay: 5, jitter: false },
      10,
    );

    expect(result).toBe(3);
  });

  it('should throw when maxAttempts reached without matching predicate', async () => {
    vi.useRealTimers();

    await expect(
      retryUntil(
        async () => 'never-match',
        () => false,
        { baseDelay: 1, maxDelay: 5, jitter: false },
        3,
      ),
    ).rejects.toThrow('Max attempts reached without matching predicate');
  });

  it('should handle errors during attempts and retry', async () => {
    vi.useRealTimers();
    let calls = 0;

    const result = await retryUntil(
      async () => {
        calls++;
        if (calls < 3) throw new Error('intermittent');
        return 'ok';
      },
      (r) => r === 'ok',
      { baseDelay: 1, maxDelay: 5, jitter: false },
      5,
    );

    expect(result).toBe('ok');
  });

  it('should throw the last error when maxAttempts reached via errors', async () => {
    vi.useRealTimers();

    await expect(
      retryUntil(
        async () => {
          throw new Error('always-fail');
        },
        () => true,
        { baseDelay: 1, maxDelay: 5, jitter: false },
        2,
      ),
    ).rejects.toThrow('always-fail');
  });
});

describe('ExponentialBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should yield increasing delays', async () => {
    vi.useRealTimers(); // Real timers with tiny delays
    const backoff = new ExponentialBackoff(1, 100, 3, false);
    const delays: number[] = [];

    for await (const delay of backoff) {
      delays.push(delay);
    }

    // Delays should be: 1*2^0=1, 1*2^1=2, 1*2^2=4
    expect(delays).toEqual([1, 2, 4]);
  });

  it('should stop after maxAttempts', async () => {
    vi.useRealTimers(); // Real timers with tiny delays to avoid timeout
    const backoff = new ExponentialBackoff(1, 10, 2, false);
    const delays: number[] = [];

    for await (const delay of backoff) {
      delays.push(delay);
    }

    expect(delays).toHaveLength(2);
  });
});

describe('RetryPolicyBuilder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should build a config with all settings', () => {
    const config = new RetryPolicyBuilder()
      .maxRetries(5)
      .baseDelay(500)
      .maxDelay(10000)
      .exponentialBackoff(true)
      .jitter(false)
      .build();

    expect(config.maxRetries).toBe(5);
    expect(config.baseDelay).toBe(500);
    expect(config.maxDelay).toBe(10000);
    expect(config.exponentialBackoff).toBe(true);
    expect(config.jitter).toBe(false);
  });

  it('should support retryOn', () => {
    const filter = (error: Error) => error.message === 'retry-me';
    const config = new RetryPolicyBuilder().retryOn(filter).build();
    expect(config.retryableErrors).toBe(filter);
  });

  it('should support onRetry callback', () => {
    const callback = vi.fn();
    const config = new RetryPolicyBuilder().onRetry(callback).build();
    expect(config.onRetry).toBe(callback);
  });

  it('should execute a function with the built policy', async () => {
    const builder = new RetryPolicyBuilder().maxRetries(1).baseDelay(10).jitter(false);

    let calls = 0;
    const p = builder.execute(async () => {
      calls++;
      if (calls < 2) throw new Error('fail');
      return 'ok';
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(await p).toBe('ok');
  });
});

describe('RetryPolicies', () => {
  it('default policy should have standard values', () => {
    const p = RetryPolicies.default();
    expect(p.maxRetries).toBe(3);
    expect(p.baseDelay).toBe(1000);
    expect(p.maxDelay).toBe(30000);
    expect(p.exponentialBackoff).toBe(true);
    expect(p.jitter).toBe(true);
  });

  it('aggressive policy should have more retries', () => {
    const p = RetryPolicies.aggressive();
    expect(p.maxRetries).toBe(5);
    expect(p.baseDelay).toBe(500);
  });

  it('conservative policy should have fewer retries', () => {
    const p = RetryPolicies.conservative();
    expect(p.maxRetries).toBe(2);
    expect(p.baseDelay).toBe(2000);
  });

  it('linear policy should disable exponential backoff', () => {
    const p = RetryPolicies.linear();
    expect(p.exponentialBackoff).toBe(false);
    expect(p.jitter).toBe(false);
  });

  it('immediate policy should have zero delay', () => {
    const p = RetryPolicies.immediate();
    expect(p.baseDelay).toBe(0);
    expect(p.maxDelay).toBe(0);
  });

  it('networkOnly policy should only retry NetworkError', () => {
    const p = RetryPolicies.networkOnly();
    expect(p.retryableErrors).toBeDefined();

    const networkError = new Error('fail');
    networkError.name = 'NetworkError';
    expect(p.retryableErrors?.(networkError)).toBe(true);

    const otherError = new Error('fail');
    expect(p.retryableErrors?.(otherError)).toBe(false);
  });

  it('idempotent policy should allow 5 retries', () => {
    const p = RetryPolicies.idempotent();
    expect(p.maxRetries).toBe(5);
  });
});

describe('globalRetryConfig', () => {
  afterEach(() => {
    globalRetryConfig.reset();
  });

  it('should start with default config', () => {
    const config = globalRetryConfig.getConfig();
    expect(config.maxRetries).toBe(3);
    expect(config.exponentialBackoff).toBe(true);
  });

  it('should allow setting config', () => {
    globalRetryConfig.setConfig({ maxRetries: 10 });
    expect(globalRetryConfig.getConfig().maxRetries).toBe(10);
    // Other fields should be preserved
    expect(globalRetryConfig.getConfig().exponentialBackoff).toBe(true);
  });

  it('should reset to default', () => {
    globalRetryConfig.setConfig({ maxRetries: 99 });
    globalRetryConfig.reset();
    expect(globalRetryConfig.getConfig().maxRetries).toBe(3);
  });
});
