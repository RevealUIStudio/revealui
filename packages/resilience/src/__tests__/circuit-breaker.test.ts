/**
 * Circuit Breaker Tests
 *
 * Comprehensive tests for CircuitBreaker, CircuitBreakerRegistry,
 * AdaptiveCircuitBreaker, Bulkhead, ResilientOperation, and helper functions.
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

import {
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
} from '../circuit-breaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      resetTimeout: 5000,
      volumeThreshold: 3,
    });
  });

  afterEach(() => {
    breaker.destroy();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start in closed state', () => {
      expect(breaker.getState()).toBe('closed');
      expect(breaker.isClosed()).toBe(true);
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.isHalfOpen()).toBe(false);
    });

    it('should have zero stats initially', () => {
      const stats = breaker.getStats();
      expect(stats.state).toBe('closed');
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.consecutiveFailures).toBe(0);
      expect(stats.consecutiveSuccesses).toBe(0);
      expect(stats.totalCalls).toBe(0);
      expect(stats.totalFailures).toBe(0);
      expect(stats.totalSuccesses).toBe(0);
      expect(stats.lastFailureTime).toBeUndefined();
      expect(stats.lastSuccessTime).toBeUndefined();
    });

    it('should report zero failure and success rates', () => {
      expect(breaker.getFailureRate()).toBe(0);
      expect(breaker.getSuccessRate()).toBe(0);
    });
  });

  describe('execute  -  success path', () => {
    it('should return the result of the function', async () => {
      const result = await breaker.execute(async () => 42);
      expect(result).toBe(42);
    });

    it('should track success statistics', async () => {
      await breaker.execute(async () => 'ok');
      await breaker.execute(async () => 'ok');

      const stats = breaker.getStats();
      expect(stats.totalCalls).toBe(2);
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.successes).toBe(2);
      expect(stats.consecutiveSuccesses).toBe(2);
      expect(stats.lastSuccessTime).toBeDefined();
    });

    it('should reset failure count on success in closed state', async () => {
      // Cause one failure (not enough to trip)
      await expect(
        breaker.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow();

      const beforeStats = breaker.getStats();
      expect(beforeStats.failures).toBe(1);

      // Success should reset failures in closed state
      await breaker.execute(async () => 'ok');

      const afterStats = breaker.getStats();
      expect(afterStats.failures).toBe(0);
    });
  });

  describe('execute  -  failure path', () => {
    it('should re-throw the original error', async () => {
      const err = new Error('test error');
      await expect(
        breaker.execute(async () => {
          throw err;
        }),
      ).rejects.toBe(err);
    });

    it('should wrap non-Error throws into Error objects for tracking', async () => {
      // The circuit breaker wraps non-Error values internally but re-throws original
      await expect(
        breaker.execute(async () => {
          throw 'string error';
        }),
      ).rejects.toBe('string error');

      const stats = breaker.getStats();
      expect(stats.totalFailures).toBe(1);
    });

    it('should track failure statistics', async () => {
      await expect(
        breaker.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow();
      await expect(
        breaker.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow();

      const stats = breaker.getStats();
      expect(stats.totalFailures).toBe(2);
      expect(stats.consecutiveFailures).toBe(2);
      expect(stats.lastFailureTime).toBeDefined();
    });

    it('should reset consecutive successes on failure', async () => {
      await breaker.execute(async () => 'ok');
      expect(breaker.getStats().consecutiveSuccesses).toBe(1);

      await expect(
        breaker.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow();
      expect(breaker.getStats().consecutiveSuccesses).toBe(0);
    });
  });

  describe('state transitions  -  closed to open', () => {
    it('should open after reaching failure threshold with volume threshold met', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('fail');
          }),
        ).rejects.toThrow();
      }

      expect(breaker.getState()).toBe('open');
      expect(breaker.isOpen()).toBe(true);
    });

    it('should not open before volume threshold is reached', async () => {
      const b = new CircuitBreaker({
        failureThreshold: 2,
        volumeThreshold: 10,
        resetTimeout: 5000,
      });

      // 2 failures, but only 2 total calls (volumeThreshold = 10)
      await expect(
        b.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow();
      await expect(
        b.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow();

      expect(b.getState()).toBe('closed');
      b.destroy();
    });
  });

  describe('state transitions  -  open to half-open', () => {
    it('should reject with CircuitBreakerOpenError when open and timeout not elapsed', async () => {
      breaker.trip();

      await expect(breaker.execute(async () => 'ok')).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('should transition to half-open after resetTimeout and allow execution', async () => {
      breaker.trip();
      expect(breaker.isOpen()).toBe(true);

      // Advance past resetTimeout
      vi.advanceTimersByTime(5001);

      const result = await breaker.execute(async () => 'recovered');
      expect(result).toBe('recovered');
      // After one success in half-open (needs 2 for successThreshold), still half-open
      expect(breaker.getState()).toBe('half-open');
    });

    it('should transition to half-open via the reset timer', () => {
      breaker.trip();
      expect(breaker.isOpen()).toBe(true);

      vi.advanceTimersByTime(5000);
      expect(breaker.isHalfOpen()).toBe(true);
    });
  });

  describe('state transitions  -  half-open to closed', () => {
    it('should close after enough consecutive successes in half-open state', async () => {
      breaker.trip();
      vi.advanceTimersByTime(5000); // Move to half-open

      expect(breaker.isHalfOpen()).toBe(true);

      await breaker.execute(async () => 'ok');
      await breaker.execute(async () => 'ok');

      expect(breaker.isClosed()).toBe(true);
    });

    it('should not close before reaching success threshold', async () => {
      breaker.trip();
      vi.advanceTimersByTime(5000);

      await breaker.execute(async () => 'ok');
      expect(breaker.isHalfOpen()).toBe(true); // Only 1 success, need 2
    });
  });

  describe('state transitions  -  half-open to open', () => {
    it('should immediately open on failure in half-open state', async () => {
      breaker.trip();
      vi.advanceTimersByTime(5000);
      expect(breaker.isHalfOpen()).toBe(true);

      await expect(
        breaker.execute(async () => {
          throw new Error('fail again');
        }),
      ).rejects.toThrow();

      expect(breaker.isOpen()).toBe(true);
    });
  });

  describe('errorFilter', () => {
    it('should not count errors that fail the filter', async () => {
      const b = new CircuitBreaker({
        failureThreshold: 2,
        volumeThreshold: 2,
        resetTimeout: 5000,
        errorFilter: (error) => error.message !== 'ignore-me',
      });

      // These should be ignored by the filter
      await expect(
        b.execute(async () => {
          throw new Error('ignore-me');
        }),
      ).rejects.toThrow();
      await expect(
        b.execute(async () => {
          throw new Error('ignore-me');
        }),
      ).rejects.toThrow();

      // Circuit should still be closed since filter returned false
      expect(b.isClosed()).toBe(true);
      expect(b.getStats().totalFailures).toBe(0);

      b.destroy();
    });
  });

  describe('callbacks', () => {
    it('should call onStateChange on transitions', async () => {
      const onStateChange = vi.fn();
      const b = new CircuitBreaker({
        failureThreshold: 2,
        volumeThreshold: 2,
        resetTimeout: 5000,
        onStateChange,
      });

      for (let i = 0; i < 2; i++) {
        await expect(
          b.execute(async () => {
            throw new Error('fail');
          }),
        ).rejects.toThrow();
      }

      expect(onStateChange).toHaveBeenCalledWith('open');
      b.destroy();
    });

    it('should call onTrip when circuit opens', async () => {
      const onTrip = vi.fn();
      const b = new CircuitBreaker({
        failureThreshold: 2,
        volumeThreshold: 2,
        resetTimeout: 5000,
        onTrip,
      });

      for (let i = 0; i < 2; i++) {
        await expect(
          b.execute(async () => {
            throw new Error('fail');
          }),
        ).rejects.toThrow();
      }

      expect(onTrip).toHaveBeenCalledOnce();
      b.destroy();
    });

    it('should call onReset when circuit closes from half-open', async () => {
      const onReset = vi.fn();
      const b = new CircuitBreaker({
        failureThreshold: 2,
        successThreshold: 1,
        volumeThreshold: 2,
        resetTimeout: 1000,
        onReset,
      });

      b.trip();
      vi.advanceTimersByTime(1000);

      await b.execute(async () => 'ok');
      expect(onReset).toHaveBeenCalledOnce();
      b.destroy();
    });
  });

  describe('manual controls', () => {
    it('trip() should open the circuit', () => {
      breaker.trip();
      expect(breaker.isOpen()).toBe(true);
    });

    it('trip() on already open circuit should be a no-op', () => {
      breaker.trip();
      // Calling again should not throw or change state
      breaker.trip();
      expect(breaker.isOpen()).toBe(true);
    });

    it('reset() should close the circuit and clear counters', async () => {
      // Trip and verify
      breaker.trip();
      expect(breaker.isOpen()).toBe(true);

      breaker.reset();
      expect(breaker.isClosed()).toBe(true);
      expect(breaker.getStats().failures).toBe(0);
      expect(breaker.getStats().consecutiveFailures).toBe(0);
    });

    it('halfOpen() should move to half-open state', () => {
      breaker.halfOpen();
      expect(breaker.isHalfOpen()).toBe(true);
    });
  });

  describe('rates', () => {
    it('should calculate correct failure rate', async () => {
      await breaker.execute(async () => 'ok');
      await expect(
        breaker.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow();

      expect(breaker.getFailureRate()).toBe(0.5);
    });

    it('should calculate correct success rate', async () => {
      await breaker.execute(async () => 'ok');
      await breaker.execute(async () => 'ok');
      await expect(
        breaker.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow();

      expect(breaker.getSuccessRate()).toBeCloseTo(2 / 3);
    });
  });

  describe('destroy', () => {
    it('should clear the reset timer', () => {
      breaker.trip(); // Sets a reset timer
      breaker.destroy();
      // Advancing time should not cause transition after destroy
      vi.advanceTimersByTime(10000);
      expect(breaker.isOpen()).toBe(true); // Stayed open, timer was cleared
    });
  });

  describe('default config', () => {
    it('should use default values when no config is provided', () => {
      const b = new CircuitBreaker();
      expect(b.getState()).toBe('closed');
      b.destroy();
    });
  });
});

describe('CircuitBreakerOpenError', () => {
  it('should have correct name and message', () => {
    const error = new CircuitBreakerOpenError();
    expect(error.name).toBe('CircuitBreakerOpenError');
    expect(error.message).toBe('Circuit breaker is open');
    expect(error).toBeInstanceOf(Error);
  });

  it('should accept a custom message', () => {
    const error = new CircuitBreakerOpenError('custom message');
    expect(error.message).toBe('custom message');
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new CircuitBreakerRegistry();
  });

  afterEach(() => {
    registry.clear();
    vi.useRealTimers();
  });

  it('should create a new breaker on first get', () => {
    const breaker = registry.get('svc-a');
    expect(breaker).toBeInstanceOf(CircuitBreaker);
    expect(registry.has('svc-a')).toBe(true);
  });

  it('should return the same instance on subsequent gets', () => {
    const first = registry.get('svc-a');
    const second = registry.get('svc-a');
    expect(first).toBe(second);
  });

  it('should pass config only on first creation', () => {
    const breaker = registry.get('svc-a', { failureThreshold: 10 });
    // Second call with different config should return the same instance
    const same = registry.get('svc-a', { failureThreshold: 99 });
    expect(same).toBe(breaker);
  });

  it('has() should return false for unknown names', () => {
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('remove() should destroy and delete the breaker', () => {
    registry.get('svc-a');
    expect(registry.remove('svc-a')).toBe(true);
    expect(registry.has('svc-a')).toBe(false);
  });

  it('remove() should return false for unknown names', () => {
    expect(registry.remove('nonexistent')).toBe(false);
  });

  it('getAll() should return a copy of the map', () => {
    registry.get('a');
    registry.get('b');

    const all = registry.getAll();
    expect(all.size).toBe(2);
    // Modifying returned map should not affect the registry
    all.delete('a');
    expect(registry.has('a')).toBe(true);
  });

  it('getAllStats() should return stats for all breakers', async () => {
    const breakerA = registry.get('a');
    await breakerA.execute(async () => 'ok');

    const stats = registry.getAllStats();
    expect(stats.a).toBeDefined();
    expect(stats.a.totalCalls).toBe(1);
  });

  it('resetAll() should reset all breakers to closed', () => {
    const a = registry.get('a');
    const b = registry.get('b');
    a.trip();
    b.trip();

    registry.resetAll();
    expect(a.isClosed()).toBe(true);
    expect(b.isClosed()).toBe(true);
  });

  it('clear() should destroy all breakers and empty the map', () => {
    registry.get('a');
    registry.get('b');
    registry.clear();

    expect(registry.getAll().size).toBe(0);
    expect(registry.has('a')).toBe(false);
  });
});

describe('withCircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreakerRegistry.clear();
  });

  afterEach(() => {
    circuitBreakerRegistry.clear();
    vi.useRealTimers();
  });

  it('should execute the function through the registry breaker', async () => {
    const result = await withCircuitBreaker('test-svc', async () => 'hello');
    expect(result).toBe('hello');
    expect(circuitBreakerRegistry.has('test-svc')).toBe(true);
  });

  it('should throw CircuitBreakerOpenError when the breaker is open', async () => {
    const breaker = circuitBreakerRegistry.get('test-svc');
    breaker.trip();

    await expect(withCircuitBreaker('test-svc', async () => 'ok')).rejects.toThrow(
      CircuitBreakerOpenError,
    );
  });
});

describe('createCircuitBreakerMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreakerRegistry.clear();
  });

  afterEach(() => {
    circuitBreakerRegistry.clear();
    vi.useRealTimers();
  });

  it('should create middleware that wraps the next function', async () => {
    const middleware = createCircuitBreakerMiddleware('mw-test');
    const next = vi.fn(async () => ({ status: 200 }));

    const result = await middleware({}, next);
    expect(result).toEqual({ status: 200 });
    expect(next).toHaveBeenCalledOnce();
  });

  it('should reject when circuit is open', async () => {
    const middleware = createCircuitBreakerMiddleware('mw-test');
    circuitBreakerRegistry.get('mw-test').trip();

    await expect(middleware({}, async () => 'ok')).rejects.toThrow(CircuitBreakerOpenError);
  });
});

describe('fetchWithCircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreakerRegistry.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    circuitBreakerRegistry.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should return the response on success', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

    const response = await fetchWithCircuitBreaker('fetch-svc', 'https://example.com');
    expect(response).toBe(mockResponse);
  });

  it('should throw on 5xx responses and count as circuit breaker failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('error', { status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(fetchWithCircuitBreaker('fetch-svc', 'https://example.com')).rejects.toThrow(
      'HTTP 500',
    );
  });

  it('should not throw on 4xx responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('not found', { status: 404, statusText: 'Not Found' }),
    );

    const response = await fetchWithCircuitBreaker('fetch-svc', 'https://example.com');
    expect(response.status).toBe(404);
  });

  it('should pass init options to fetch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('ok', { status: 200 }));

    await fetchWithCircuitBreaker('fetch-svc', 'https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(fetch).toHaveBeenCalledWith('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

describe('AdaptiveCircuitBreaker', () => {
  let breaker: AdaptiveCircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new AdaptiveCircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      resetTimeout: 5000,
      volumeThreshold: 5,
    });
  });

  afterEach(() => {
    breaker.destroy();
    vi.useRealTimers();
  });

  it('should start with the configured failure threshold', () => {
    expect(breaker.getAdaptiveThreshold()).toBe(5);
  });

  it('should increase threshold on low error rate', async () => {
    // Many successes → low error rate → threshold should increase
    for (let i = 0; i < 20; i++) {
      await breaker.execute(async () => 'ok');
    }

    expect(breaker.getAdaptiveThreshold()).toBeGreaterThan(5);
  });

  it('should decrease threshold on high error rate', async () => {
    // Start with a higher threshold so we have room to decrease
    const b = new AdaptiveCircuitBreaker({
      failureThreshold: 10,
      volumeThreshold: 100, // High so we don't trip
      resetTimeout: 5000,
    });

    // Many failures → high error rate → threshold should decrease
    for (let i = 0; i < 20; i++) {
      try {
        await b.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // expected
      }
    }

    expect(b.getAdaptiveThreshold()).toBeLessThan(10);
    b.destroy();
  });

  it('should not decrease threshold below 2', async () => {
    const b = new AdaptiveCircuitBreaker({
      failureThreshold: 3,
      volumeThreshold: 200,
      resetTimeout: 5000,
    });

    for (let i = 0; i < 100; i++) {
      try {
        await b.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // expected
      }
    }

    expect(b.getAdaptiveThreshold()).toBeGreaterThanOrEqual(2);
    b.destroy();
  });

  it('should not increase threshold above 20', async () => {
    const b = new AdaptiveCircuitBreaker({
      failureThreshold: 18,
      volumeThreshold: 200,
      resetTimeout: 5000,
    });

    for (let i = 0; i < 150; i++) {
      await b.execute(async () => 'ok');
    }

    expect(b.getAdaptiveThreshold()).toBeLessThanOrEqual(20);
    b.destroy();
  });

  it('should re-throw errors from the underlying execute', async () => {
    await expect(
      breaker.execute(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('should use default failureThreshold of 5 when not configured', () => {
    const b = new AdaptiveCircuitBreaker();
    expect(b.getAdaptiveThreshold()).toBe(5);
    b.destroy();
  });
});

describe('Bulkhead', () => {
  it('should allow execution under the limit', async () => {
    const bulkhead = new Bulkhead(5, 10);
    const result = await bulkhead.execute(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('should limit concurrent executions to maxConcurrent', async () => {
    const bulkhead = new Bulkhead(2, 10);
    let active = 0;
    let maxActive = 0;

    const fn = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 50));
      active--;
      return 'ok';
    };

    vi.useRealTimers();
    const promises = Array.from({ length: 5 }, () => bulkhead.execute(fn));
    await Promise.all(promises);

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('should reject when queue is full', async () => {
    vi.useRealTimers();
    const bulkhead = new Bulkhead(1, 1);

    const slow = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 'ok';
    };

    const p1 = bulkhead.execute(slow); // Active
    const p2 = bulkhead.execute(slow); // Queued

    // Queue is full, next should reject
    await expect(bulkhead.execute(slow)).rejects.toThrow('Bulkhead queue is full');

    await p1;
    await p2;
  });

  it('should report correct stats', async () => {
    const bulkhead = new Bulkhead(3, 50);
    const stats = bulkhead.getStats();

    expect(stats.activeRequests).toBe(0);
    expect(stats.queueSize).toBe(0);
    expect(stats.maxConcurrent).toBe(3);
    expect(stats.maxQueue).toBe(50);
  });

  it('should decrement active requests even on failure', async () => {
    const bulkhead = new Bulkhead(2, 5);

    await expect(
      bulkhead.execute(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    expect(bulkhead.getActiveRequests()).toBe(0);
    expect(bulkhead.getQueueSize()).toBe(0);
  });

  it('should use default values when constructed without args', () => {
    const bulkhead = new Bulkhead();
    const stats = bulkhead.getStats();
    expect(stats.maxConcurrent).toBe(10);
    expect(stats.maxQueue).toBe(100);
  });
});

describe('ResilientOperation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should execute with no resilience patterns', async () => {
    const op = new ResilientOperation(async () => 'plain');
    expect(await op.execute()).toBe('plain');
  });

  it('should execute with circuit breaker only', async () => {
    const breaker = new CircuitBreaker();
    const op = new ResilientOperation(async () => 'cb-only', breaker);
    expect(await op.execute()).toBe('cb-only');
    breaker.destroy();
  });

  it('should execute with bulkhead only', async () => {
    const bulkhead = new Bulkhead(5, 10);
    const op = new ResilientOperation(async () => 'bh-only', undefined, bulkhead);
    expect(await op.execute()).toBe('bh-only');
  });

  it('should execute with both circuit breaker and bulkhead', async () => {
    const breaker = new CircuitBreaker();
    const bulkhead = new Bulkhead(5, 10);
    const op = new ResilientOperation(async () => 'both', breaker, bulkhead);
    expect(await op.execute()).toBe('both');
    breaker.destroy();
  });

  it('should propagate errors from the function', async () => {
    const op = new ResilientOperation(async () => {
      throw new Error('op failed');
    });
    await expect(op.execute()).rejects.toThrow('op failed');
  });
});

describe('createResilientFunction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create a function with no options', async () => {
    const fn = createResilientFunction(async () => 'basic');
    expect(await fn()).toBe('basic');
  });

  it('should create a function with circuit breaker config', async () => {
    const fn = createResilientFunction(async () => 'with-cb', {
      circuitBreaker: { failureThreshold: 3 },
    });
    expect(await fn()).toBe('with-cb');
  });

  it('should create a function with bulkhead config', async () => {
    const fn = createResilientFunction(async () => 'with-bh', {
      bulkhead: { maxConcurrent: 5, maxQueue: 10 },
    });
    expect(await fn()).toBe('with-bh');
  });

  it('should create a function with both configs', async () => {
    const fn = createResilientFunction(async () => 'both', {
      circuitBreaker: { failureThreshold: 3 },
      bulkhead: { maxConcurrent: 5, maxQueue: 10 },
    });
    expect(await fn()).toBe('both');
  });
});

describe('CircuitBreak decorator (manual application)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreakerRegistry.clear();
  });

  afterEach(() => {
    circuitBreakerRegistry.clear();
    vi.useRealTimers();
  });

  it('should wrap a method with a circuit breaker using a string name', async () => {
    // Apply decorator manually since legacy TS decorators require experimentalDecorators
    const descriptor: PropertyDescriptor = {
      value: async () => 'result',
      writable: true,
      configurable: true,
    };
    const target = { constructor: { name: 'Service' } };

    const result = CircuitBreak('service.call')(target, 'call', descriptor);
    const wrapped = result.value as (...args: unknown[]) => Promise<string>;
    expect(await wrapped()).toBe('result');
    expect(circuitBreakerRegistry.has('service.call')).toBe(true);
  });

  it('should wrap a method with a circuit breaker using config object', async () => {
    const descriptor: PropertyDescriptor = {
      value: async () => 'result',
      writable: true,
      configurable: true,
    };
    const target = { constructor: { name: 'Service' } };

    const result = CircuitBreak({ failureThreshold: 2 })(target, 'call', descriptor);
    const wrapped = result.value as (...args: unknown[]) => Promise<string>;
    expect(await wrapped()).toBe('result');
    expect(circuitBreakerRegistry.has('Service.call')).toBe(true);
  });

  it('should wrap a method with default config when called without args', async () => {
    const descriptor: PropertyDescriptor = {
      value: async () => 'data',
      writable: true,
      configurable: true,
    };
    const target = { constructor: { name: 'MyService' } };

    const result = CircuitBreak()(target, 'fetch', descriptor);
    const wrapped = result.value as (...args: unknown[]) => Promise<string>;
    expect(await wrapped()).toBe('data');
    expect(circuitBreakerRegistry.has('MyService.fetch')).toBe(true);
  });
});
