import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStorage } from '../storage/in-memory.js';

// Mock storage to use InMemoryStorage directly
const mockStorage = new InMemoryStorage();

vi.mock('../storage/index.js', () => ({
  getStorage: () => mockStorage,
}));

import {
  configureBruteForce,
  isAccountLocked,
  recordFailedAttempt,
  resetBruteForceConfig,
} from '../brute-force.js';
import { checkRateLimit, configureRateLimit, resetRateLimitConfig } from '../rate-limit.js';

describe('configureRateLimit', () => {
  beforeEach(() => {
    mockStorage.clear();
    resetRateLimitConfig();
  });

  afterEach(() => {
    resetRateLimitConfig();
  });

  it('should use default config when unconfigured', async () => {
    // Default: 5 attempts
    const result = await checkRateLimit('test-key');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should override defaults with configureRateLimit', async () => {
    configureRateLimit({ maxAttempts: 2 });

    const r1 = await checkRateLimit('key-a');
    expect(r1.remaining).toBe(1);

    const r2 = await checkRateLimit('key-a');
    expect(r2.remaining).toBe(0);

    const r3 = await checkRateLimit('key-a');
    expect(r3.allowed).toBe(false);
  });

  it('should merge partial overrides with defaults', async () => {
    configureRateLimit({ maxAttempts: 10 });

    const result = await checkRateLimit('key-b');
    // maxAttempts overridden to 10, so remaining should be 9
    expect(result.remaining).toBe(9);
    expect(result.allowed).toBe(true);
  });

  it('should allow per-call config to override global config', async () => {
    configureRateLimit({ maxAttempts: 100 });

    // Per-call config takes precedence
    const result = await checkRateLimit('key-c', { maxAttempts: 1, windowMs: 60_000 });
    expect(result.remaining).toBe(0);

    const result2 = await checkRateLimit('key-c', { maxAttempts: 1, windowMs: 60_000 });
    expect(result2.allowed).toBe(false);
  });

  it('should reset to defaults with resetRateLimitConfig', async () => {
    configureRateLimit({ maxAttempts: 1 });
    resetRateLimitConfig();

    const result = await checkRateLimit('key-d');
    // Back to default of 5 attempts
    expect(result.remaining).toBe(4);
  });
});

describe('configureBruteForce', () => {
  beforeEach(() => {
    mockStorage.clear();
    resetBruteForceConfig();
  });

  afterEach(() => {
    resetBruteForceConfig();
  });

  it('should use default config when unconfigured', async () => {
    const status = await isAccountLocked('user@test.com');
    expect(status.locked).toBe(false);
    expect(status.attemptsRemaining).toBe(5);
  });

  it('should override defaults with configureBruteForce', async () => {
    configureBruteForce({ maxAttempts: 2 });

    await recordFailedAttempt('user@test.com');
    await recordFailedAttempt('user@test.com');

    const status = await isAccountLocked('user@test.com');
    expect(status.locked).toBe(true);
  });

  it('should merge partial overrides with defaults', async () => {
    configureBruteForce({ maxAttempts: 3 });

    const status = await isAccountLocked('user2@test.com');
    // maxAttempts overridden to 3, lockDurationMs should still be default 30 min
    expect(status.attemptsRemaining).toBe(3);
  });

  it('should allow per-call config to override global config', async () => {
    configureBruteForce({ maxAttempts: 100 });

    // Per-call config locks after 1 attempt
    await recordFailedAttempt('user3@test.com', {
      maxAttempts: 1,
      lockDurationMs: 60_000,
      windowMs: 60_000,
    });

    const status = await isAccountLocked('user3@test.com', {
      maxAttempts: 1,
      lockDurationMs: 60_000,
      windowMs: 60_000,
    });
    expect(status.locked).toBe(true);
  });

  it('should reset to defaults with resetBruteForceConfig', async () => {
    configureBruteForce({ maxAttempts: 1 });
    resetBruteForceConfig();

    const status = await isAccountLocked('user4@test.com');
    expect(status.attemptsRemaining).toBe(5);
  });
});
