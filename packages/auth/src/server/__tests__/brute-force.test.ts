import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStorage } from '../storage/in-memory.js';

// ---------------------------------------------------------------------------
// Mock storage to use InMemoryStorage directly
// ---------------------------------------------------------------------------
const mockStorage = new InMemoryStorage();

vi.mock('../storage/index.js', () => ({
  getStorage: () => mockStorage,
}));

import type { BruteForceConfig } from '../brute-force.js';
import {
  clearFailedAttempts,
  getFailedAttemptCount,
  isAccountLocked,
  recordFailedAttempt,
} from '../brute-force.js';

describe('brute-force', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // recordFailedAttempt
  // =========================================================================
  describe('recordFailedAttempt', () => {
    it('tracks a single failed attempt', async () => {
      await recordFailedAttempt('user@test.com');
      const count = await getFailedAttemptCount('user@test.com');
      expect(count).toBe(1);
    });

    it('increments on successive failures', async () => {
      await recordFailedAttempt('user@test.com');
      await recordFailedAttempt('user@test.com');
      await recordFailedAttempt('user@test.com');
      const count = await getFailedAttemptCount('user@test.com');
      expect(count).toBe(3);
    });

    it('locks account after reaching maxAttempts', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 3,
        lockDurationMs: 60_000,
        windowMs: 60_000,
      };

      await recordFailedAttempt('user@test.com', config);
      await recordFailedAttempt('user@test.com', config);
      await recordFailedAttempt('user@test.com', config);

      const status = await isAccountLocked('user@test.com', config);
      expect(status.locked).toBe(true);
      expect(status.lockUntil).toBeDefined();
      expect(status.attemptsRemaining).toBe(0);
    });

    it('does not lock before maxAttempts', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 5,
        lockDurationMs: 60_000,
        windowMs: 60_000,
      };

      await recordFailedAttempt('user@test.com', config);
      await recordFailedAttempt('user@test.com', config);

      const status = await isAccountLocked('user@test.com', config);
      expect(status.locked).toBe(false);
      expect(status.attemptsRemaining).toBe(3);
    });

    it('resets count when window expires before recording', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 5,
        lockDurationMs: 60_000,
        windowMs: 50,
      };

      await recordFailedAttempt('user@test.com', config);
      await recordFailedAttempt('user@test.com', config);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      await recordFailedAttempt('user@test.com', config);
      const count = await getFailedAttemptCount('user@test.com');
      expect(count).toBe(1); // reset to 1 after window expired
    });

    it('resets count when lock expires before recording', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 1,
        lockDurationMs: 50,
        windowMs: 60_000,
      };

      await recordFailedAttempt('user@test.com', config);

      // Wait for lock to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      await recordFailedAttempt('user@test.com', config);
      // After lock expiry, count resets then increments to 1, hitting maxAttempts again
      const count = await getFailedAttemptCount('user@test.com');
      expect(count).toBe(1);
    });

    it('isolates different email addresses', async () => {
      await recordFailedAttempt('a@test.com');
      await recordFailedAttempt('a@test.com');
      await recordFailedAttempt('b@test.com');

      expect(await getFailedAttemptCount('a@test.com')).toBe(2);
      expect(await getFailedAttemptCount('b@test.com')).toBe(1);
    });
  });

  // =========================================================================
  // isAccountLocked
  // =========================================================================
  describe('isAccountLocked', () => {
    it('returns unlocked for unknown email', async () => {
      const status = await isAccountLocked('unknown@test.com');
      expect(status.locked).toBe(false);
      expect(status.attemptsRemaining).toBe(5); // default maxAttempts
    });

    it('returns correct attemptsRemaining', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 5,
        lockDurationMs: 60_000,
        windowMs: 60_000,
      };

      await recordFailedAttempt('user@test.com', config);
      await recordFailedAttempt('user@test.com', config);

      const status = await isAccountLocked('user@test.com', config);
      expect(status.attemptsRemaining).toBe(3);
    });

    it('detects locked account', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 2,
        lockDurationMs: 60_000,
        windowMs: 60_000,
      };

      await recordFailedAttempt('user@test.com', config);
      await recordFailedAttempt('user@test.com', config);

      const status = await isAccountLocked('user@test.com', config);
      expect(status.locked).toBe(true);
      expect(status.lockUntil).toBeGreaterThan(Date.now());
    });

    it('unlocks after lock duration expires', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 1,
        lockDurationMs: 50,
        windowMs: 60_000,
      };

      await recordFailedAttempt('user@test.com', config);

      // Wait for lock to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = await isAccountLocked('user@test.com', config);
      expect(status.locked).toBe(false);
      expect(status.attemptsRemaining).toBe(1);
    });

    it('unlocks after window expires', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 5,
        lockDurationMs: 60_000,
        windowMs: 50,
      };

      await recordFailedAttempt('user@test.com', config);
      await recordFailedAttempt('user@test.com', config);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = await isAccountLocked('user@test.com', config);
      expect(status.locked).toBe(false);
      expect(status.attemptsRemaining).toBe(5);
    });

    it('uses custom config maxAttempts for attemptsRemaining', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 10,
        lockDurationMs: 60_000,
        windowMs: 60_000,
      };

      const status = await isAccountLocked('fresh@test.com', config);
      expect(status.attemptsRemaining).toBe(10);
    });
  });

  // =========================================================================
  // clearFailedAttempts
  // =========================================================================
  describe('clearFailedAttempts', () => {
    it('clears all attempts for an email', async () => {
      await recordFailedAttempt('user@test.com');
      await recordFailedAttempt('user@test.com');
      await recordFailedAttempt('user@test.com');

      await clearFailedAttempts('user@test.com');

      const count = await getFailedAttemptCount('user@test.com');
      expect(count).toBe(0);
    });

    it('unlocks a locked account', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 1,
        lockDurationMs: 60_000,
        windowMs: 60_000,
      };

      await recordFailedAttempt('user@test.com', config);
      const locked = await isAccountLocked('user@test.com', config);
      expect(locked.locked).toBe(true);

      await clearFailedAttempts('user@test.com');

      const status = await isAccountLocked('user@test.com', config);
      expect(status.locked).toBe(false);
    });

    it('does not throw for nonexistent email', async () => {
      await expect(clearFailedAttempts('nonexistent@test.com')).resolves.toBeUndefined();
    });

    it('does not affect other emails', async () => {
      await recordFailedAttempt('a@test.com');
      await recordFailedAttempt('b@test.com');

      await clearFailedAttempts('a@test.com');

      expect(await getFailedAttemptCount('a@test.com')).toBe(0);
      expect(await getFailedAttemptCount('b@test.com')).toBe(1);
    });
  });

  // =========================================================================
  // getFailedAttemptCount
  // =========================================================================
  describe('getFailedAttemptCount', () => {
    it('returns 0 for unknown email', async () => {
      const count = await getFailedAttemptCount('unknown@test.com');
      expect(count).toBe(0);
    });

    it('returns correct count after multiple attempts', async () => {
      await recordFailedAttempt('user@test.com');
      await recordFailedAttempt('user@test.com');
      await recordFailedAttempt('user@test.com');
      await recordFailedAttempt('user@test.com');

      const count = await getFailedAttemptCount('user@test.com');
      expect(count).toBe(4);
    });

    it('returns 0 after clearing', async () => {
      await recordFailedAttempt('user@test.com');
      await clearFailedAttempts('user@test.com');

      const count = await getFailedAttemptCount('user@test.com');
      expect(count).toBe(0);
    });
  });

  // =========================================================================
  // Custom config overrides
  // =========================================================================
  describe('custom config overrides', () => {
    it('respects custom maxAttempts', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 2,
        lockDurationMs: 60_000,
        windowMs: 60_000,
      };

      await recordFailedAttempt('user@test.com', config);
      const status1 = await isAccountLocked('user@test.com', config);
      expect(status1.locked).toBe(false);

      await recordFailedAttempt('user@test.com', config);
      const status2 = await isAccountLocked('user@test.com', config);
      expect(status2.locked).toBe(true);
    });

    it('respects custom lockDurationMs', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 1,
        lockDurationMs: 50,
        windowMs: 60_000,
      };

      await recordFailedAttempt('user@test.com', config);
      const locked = await isAccountLocked('user@test.com', config);
      expect(locked.locked).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const unlocked = await isAccountLocked('user@test.com', config);
      expect(unlocked.locked).toBe(false);
    });

    it('respects custom windowMs', async () => {
      const config: BruteForceConfig = {
        maxAttempts: 5,
        lockDurationMs: 60_000,
        windowMs: 50,
      };

      await recordFailedAttempt('user@test.com', config);
      await recordFailedAttempt('user@test.com', config);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Window expired  -  isAccountLocked properly handles window expiry:
      const status = await isAccountLocked('user@test.com', config);
      expect(status.locked).toBe(false);
      expect(status.attemptsRemaining).toBe(5);
    });
  });
});
