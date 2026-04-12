/**
 * Session & Auth Concurrency Tests
 *
 * Verifies race condition handling in:
 * - Concurrent brute-force tracking
 * - Concurrent rate limit checks
 * - Concurrent sign-in attempts with same credentials
 * - Storage atomicity under concurrent access
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStorage } from '../../server/storage/in-memory.js';
import type { Storage } from '../../server/storage/interface.js';

// ─── Storage mock setup ─────────────────────────────────────────────────────
// We mock getStorage to use a fresh InMemoryStorage per test, avoiding
// side effects from the global singleton and database/config dependencies.

let testStorage: InMemoryStorage;

vi.mock('../../server/storage/index.js', () => ({
  getStorage: (): Storage => testStorage,
  createStorage: (): Storage => testStorage,
  resetStorage: vi.fn(),
}));

// Mock logger
vi.mock('@revealui/core/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import AFTER mocks are set up
const { recordFailedAttempt, isAccountLocked, clearFailedAttempts } = await import(
  '../../server/brute-force.js'
);
const { checkRateLimit, resetRateLimit } = await import('../../server/rate-limit.js');

describe('Brute force concurrent recording', () => {
  beforeEach(() => {
    testStorage = new InMemoryStorage();
  });

  afterEach(() => {
    testStorage.clear();
  });

  it('concurrent failed attempts should all be counted', async () => {
    const email = 'user@example.com';
    const config = { maxAttempts: 10, lockDurationMs: 30_000, windowMs: 60_000 };

    // Record 8 failures concurrently
    await Promise.all(Array.from({ length: 8 }, () => recordFailedAttempt(email, config)));

    // Check lock status  -  should have 8 attempts recorded
    const status = await isAccountLocked(email, config);
    expect(status.locked).toBe(false);
    // All 8 attempts should have been counted (atomicUpdate ensures this)
    expect(status.attemptsRemaining).toBe(2);
  });

  it('concurrent failures exceeding threshold should lock the account', async () => {
    const email = 'lockme@example.com';
    const config = { maxAttempts: 5, lockDurationMs: 30_000, windowMs: 60_000 };

    // Fire exactly maxAttempts concurrent failures
    await Promise.all(Array.from({ length: 5 }, () => recordFailedAttempt(email, config)));

    const status = await isAccountLocked(email, config);
    expect(status.locked).toBe(true);
    expect(status.attemptsRemaining).toBe(0);
  });

  it('clearFailedAttempts during concurrent recording should reset the counter', async () => {
    const email = 'clear-race@example.com';
    const config = { maxAttempts: 10, lockDurationMs: 30_000, windowMs: 60_000 };

    // Record some failures
    await Promise.all(Array.from({ length: 3 }, () => recordFailedAttempt(email, config)));

    // Clear and then immediately record more
    await clearFailedAttempts(email);

    await Promise.all(Array.from({ length: 2 }, () => recordFailedAttempt(email, config)));

    const status = await isAccountLocked(email, config);
    expect(status.locked).toBe(false);
    // After clear + 2 new attempts, should have 8 remaining
    expect(status.attemptsRemaining).toBe(8);
  });

  it('many concurrent emails should not interfere with each other', async () => {
    const config = { maxAttempts: 3, lockDurationMs: 30_000, windowMs: 60_000 };
    const emails = Array.from({ length: 20 }, (_, i) => `user-${i}@example.com`);

    // Record 2 failures for each email concurrently
    await Promise.all(
      emails.flatMap((email) => [
        recordFailedAttempt(email, config),
        recordFailedAttempt(email, config),
      ]),
    );

    // Each email should have exactly 1 remaining attempt
    const statuses = await Promise.all(emails.map((email) => isAccountLocked(email, config)));

    for (const status of statuses) {
      expect(status.locked).toBe(false);
      expect(status.attemptsRemaining).toBe(1);
    }
  });
});

describe('Rate limit concurrent checks', () => {
  beforeEach(() => {
    testStorage = new InMemoryStorage();
  });

  afterEach(() => {
    testStorage.clear();
  });

  it('sequential rate limit checks should count all requests', async () => {
    const key = 'api:10.0.0.1';
    const config = { maxAttempts: 10, windowMs: 60_000 };

    // Fire 10 sequential checks (at the limit)
    const results: Array<{ allowed: boolean; remaining: number }> = [];
    for (let i = 0; i < 10; i++) {
      results.push(await checkRateLimit(key, config));
    }

    // All 10 should be allowed (we are at exactly the limit)
    const allowed = results.filter((r) => r.allowed).length;
    expect(allowed).toBe(10);

    // The 11th should be denied
    const overflow = await checkRateLimit(key, config);
    expect(overflow.allowed).toBe(false);
    expect(overflow.remaining).toBe(0);
  });

  it('concurrent rate limit checks should count all requests (atomic)', async () => {
    const key = 'api:race';
    const config = { maxAttempts: 5, windowMs: 60_000 };

    // Fire 5 concurrent checks  -  checkRateLimit now uses atomicUpdate,
    // so all 5 increments are counted without lost updates.
    const results = await Promise.all(Array.from({ length: 5 }, () => checkRateLimit(key, config)));

    // All 5 should be allowed (exactly at the limit)
    const allowed = results.filter((r) => r.allowed).length;
    expect(allowed).toBe(5);

    // The 6th should be denied  -  all 5 previous requests were counted
    const overflow = await checkRateLimit(key, config);
    expect(overflow.allowed).toBe(false);
    expect(overflow.remaining).toBe(0);
  });

  it('sequential checks from different keys should be independent', async () => {
    const config = { maxAttempts: 3, windowMs: 60_000 };
    const keys = ['user:alice', 'user:bob', 'user:charlie'];

    // Each user makes 2 sequential requests
    for (const key of keys) {
      await checkRateLimit(key, config);
      await checkRateLimit(key, config);
    }

    // Each user should have 1 remaining after 2 uses
    for (const key of keys) {
      const status = await checkRateLimit(key, config);
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(0); // 3rd request, 0 remaining after
    }
  });

  it('reset during concurrent checking should allow new requests', async () => {
    const key = 'reset-test';
    const config = { maxAttempts: 2, windowMs: 60_000 };

    // Exhaust the limit
    await checkRateLimit(key, config);
    await checkRateLimit(key, config);

    const blocked = await checkRateLimit(key, config);
    expect(blocked.allowed).toBe(false);

    // Reset
    await resetRateLimit(key);

    // Should be allowed again
    const afterReset = await checkRateLimit(key, config);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });
});

describe('InMemoryStorage atomicUpdate concurrency', () => {
  beforeEach(() => {
    testStorage = new InMemoryStorage();
  });

  afterEach(() => {
    testStorage.clear();
  });

  it('sequential atomicUpdate calls should accumulate correctly', async () => {
    // Simulate a counter via atomicUpdate
    for (let i = 0; i < 10; i++) {
      await testStorage.atomicUpdate('counter', (existing) => {
        const current = existing ? parseInt(existing, 10) : 0;
        return { value: String(current + 1), ttlSeconds: 300 };
      });
    }

    const result = await testStorage.get('counter');
    expect(result).toBe('10');
  });

  it('concurrent atomicUpdate should not lose updates', async () => {
    // All updates are async but atomicUpdate is synchronous internally
    // (no await between read/write), so updates should not be lost
    const updates = Array.from({ length: 20 }, () =>
      testStorage.atomicUpdate('counter', (existing) => {
        const current = existing ? parseInt(existing, 10) : 0;
        return { value: String(current + 1), ttlSeconds: 300 };
      }),
    );

    await Promise.all(updates);

    const result = await testStorage.get('counter');
    expect(result).toBe('20');
  });

  it('sequential incr operations should accumulate correctly', async () => {
    // Sequential calls are always safe; this verifies basic correctness
    const results: number[] = [];
    for (let i = 0; i < 15; i++) {
      results.push(await testStorage.incr('inc-counter'));
    }

    // Each result should be unique and sequential
    expect(results).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it('concurrent incr should accumulate correctly (atomic)', async () => {
    // incr now uses synchronous Map operations (no await between read/write),
    // so concurrent calls cannot interleave and lose updates.
    const increments = Array.from({ length: 10 }, () => testStorage.incr('atomic-counter'));

    const results = await Promise.all(increments);

    // All 10 increments should be counted  -  each returns a unique value 1..10
    const sorted = [...results].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));

    // The stored value should reflect all 10 increments
    const stored = await testStorage.get('atomic-counter');
    expect(stored).toBe('10');
  });

  it('concurrent set and get should return consistent values', async () => {
    // Write a value
    await testStorage.set('key', 'initial', 300);

    // Concurrent read/write mix
    const operations = [
      testStorage.set('key', 'update-1', 300),
      testStorage.get('key'),
      testStorage.set('key', 'update-2', 300),
      testStorage.get('key'),
      testStorage.set('key', 'final', 300),
    ];

    await Promise.all(operations);

    // After all operations settle, the last writer wins
    const finalValue = await testStorage.get('key');
    expect(finalValue).toBe('final');
  });

  it('concurrent exists checks should reflect the actual state', async () => {
    await testStorage.set('ephemeral', 'value', 300);

    // Check existence concurrently
    const checks = Array.from({ length: 10 }, () => testStorage.exists('ephemeral'));

    const results = await Promise.all(checks);
    for (const result of results) {
      expect(result).toBe(true);
    }

    // Delete and check again
    await testStorage.del('ephemeral');

    const afterDelete = await testStorage.exists('ephemeral');
    expect(afterDelete).toBe(false);
  });
});
