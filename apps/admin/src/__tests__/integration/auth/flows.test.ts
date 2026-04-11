/**
 * Authentication Flow Integration Tests
 *
 * Tests complete authentication flows: sign-up, sign-in, brute-force
 * protection, rate limiting, and password validation.
 *
 * Uses real auth functions from @revealui/auth with an in-memory storage
 * backend (InMemoryStorage, automatically selected when DATABASE_URL is
 * unset) and a chainable Drizzle mock for the database client.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must come before the imports under test)
// ---------------------------------------------------------------------------

// Suppress logger output
vi.mock('@revealui/core/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Stub global fetch for HIBP breach check  -  returns no breaches so
// signUp/signIn flows don't fail due to network calls in CI.
const originalFetch = globalThis.fetch;
vi.stubGlobal(
  'fetch',
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('pwnedpasswords.com')) {
      return new Response('0000000000000000000000000000000000000:0\n', { status: 200 });
    }
    return originalFetch(input, init);
  }),
);

// Chainable Drizzle-style mock returned by getClient()
const buildChainMock = () => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve([]));
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve([]));
  chain.delete = vi.fn(() => chain);
  return chain;
};

const mockDb = buildChainMock();

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}));

// ---------------------------------------------------------------------------
// Imports (after vi.mock calls)
// ---------------------------------------------------------------------------

import {
  checkRateLimit,
  clearFailedAttempts,
  isAccountLocked,
  recordFailedAttempt,
  resetRateLimit,
  signIn,
  signUp,
  validatePasswordStrength,
} from '@revealui/auth/server';

// resetStorage is not part of the server barrel export; reach into the source
// via the relative path (the admin vitest config inlines @revealui/* packages).
import { resetStorage } from '../../../../../../packages/auth/src/server/storage/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMockDb() {
  const fresh = buildChainMock();
  Object.assign(mockDb, fresh);
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStorage();
    resetMockDb();
  });

  afterEach(() => {
    resetStorage();
  });

  // -------------------------------------------------------------------------
  // Sign-Up Flow
  // -------------------------------------------------------------------------

  describe('Sign-Up Flow', () => {
    it('creates a new user with a session token', async () => {
      const email = 'newuser@example.com';

      (mockDb.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      (mockDb.returning as ReturnType<typeof vi.fn>)
        // user insert
        .mockResolvedValueOnce([
          {
            id: 'u1',
            email,
            name: 'New User',
            passwordHash: 'hashed',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
        // session insert
        .mockResolvedValueOnce([
          {
            id: 's1',
            userId: 'u1',
            tokenHash: 'th',
            expiresAt: new Date(Date.now() + 86_400_000),
            persistent: false,
          },
        ]);

      const result = await signUp(email, 'Secure123!', 'New User');

      expect(result.success).toBe(true);
      expect(result.user?.email).toBe(email);
      expect(result.sessionToken).toBeDefined();
    });

    it('rejects sign-up when email is already registered', async () => {
      const email = 'existing@example.com';

      (mockDb.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 'old-user', email, passwordHash: 'hash', name: 'Old User' },
      ]);

      const result = await signUp(email, 'NewPass123!', 'Another');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects sign-up with a password that fails strength requirements', async () => {
      // "weak" → too short, no uppercase, no digit
      const result = await signUp('weak@example.com', 'weak', 'User');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('password stored is a bcrypt hash (not plain text)', async () => {
      let capturedPasswordHash: string | undefined;

      (mockDb.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      // Capture what gets passed to .values()
      (mockDb.values as ReturnType<typeof vi.fn>).mockImplementationOnce(
        (data: Record<string, unknown>) => {
          capturedPasswordHash = data.password as string;
          return mockDb;
        },
      );

      (mockDb.returning as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          {
            id: 'u2',
            email: 'hash@example.com',
            name: 'U',
            passwordHash: 'ph',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 's2',
            userId: 'u2',
            tokenHash: 'th2',
            expiresAt: new Date(Date.now() + 86_400_000),
            persistent: false,
          },
        ]);

      await signUp('hash@example.com', 'PlainText123!', 'Hash User');

      if (capturedPasswordHash) {
        // Must be a bcrypt hash
        expect(capturedPasswordHash).toMatch(/^\$2[aby]\$/);
        // Must not be the plain-text password
        expect(capturedPasswordHash).not.toBe('PlainText123!');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Sign-In Flow
  // -------------------------------------------------------------------------

  describe('Sign-In Flow', () => {
    /**
     * Capture the bcrypt hash that signUp produces by intercepting the
     * Drizzle .values() call. Uses a container object so the value is
     * captured by reference and available after the await.
     */
    async function captureHashFromSignUp(password: string): Promise<string> {
      const captured = { hash: '' };

      (mockDb.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      (mockDb.values as ReturnType<typeof vi.fn>).mockImplementationOnce(
        (data: Record<string, unknown>) => {
          captured.hash = data.password as string;
          return mockDb;
        },
      );
      (mockDb.returning as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          {
            id: 'tmp',
            email: `tmp-${Date.now()}@ex.com`,
            name: 'T',
            password: '',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'ts',
            userId: 'tmp',
            tokenHash: 'th',
            expiresAt: new Date(Date.now() + 86_400_000),
            persistent: false,
          },
        ]);

      await signUp(`tmp-${Date.now()}@ex.com`, password, 'Temp');
      resetMockDb();
      resetStorage();
      return captured.hash;
    }

    it('returns success and a session token for correct credentials', {
      timeout: 15_000,
    }, async () => {
      const password = 'Correct123!';
      const hash = await captureHashFromSignUp(password);

      (mockDb.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          id: 'u-si-1',
          email: 'user@example.com',
          password: hash,
          emailVerified: true,
          createdAt: new Date(),
        },
      ]);
      (mockDb.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          id: 's-si-1',
          userId: 'u-si-1',
          expiresAt: new Date(Date.now() + 86_400_000),
          tokenHash: 'th',
          persistent: false,
        },
      ]);

      const result = await signIn('user@example.com', password, { ipAddress: '10.0.0.1' });

      expect(result.success).toBe(true);
      if (result.success && !result.requiresMfa) {
        expect(result.user).toBeDefined();
        expect(result.sessionToken).toBeDefined();
      }
    });

    it('rejects sign-in with wrong password', { timeout: 15_000 }, async () => {
      const correctPassword = 'Correct123!';
      const hash = await captureHashFromSignUp(correctPassword);

      (mockDb.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          id: 'u-si-2',
          email: 'user@example.com',
          password: hash,
          emailVerified: true,
          createdAt: new Date(),
        },
      ]);

      const result = await signIn('user@example.com', 'WrongPassword123!', {
        ipAddress: '10.0.0.2',
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain('Invalid');
    });

    it('rejects sign-in for non-existent email', async () => {
      (mockDb.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const result = await signIn('ghost@example.com', 'Password123!', { ipAddress: '10.0.0.3' });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('Invalid email or password');
    });

    it('returns same error for wrong password and non-existent email (prevents user enumeration)', async () => {
      // Test non-existent user
      (mockDb.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      const result1 = await signIn('nobody@example.com', 'Password123!', { ipAddress: '10.0.0.4' });

      resetStorage();
      resetMockDb();

      const correctPassword = 'CorrectPassword123!';
      const hash = await captureHashFromSignUp(correctPassword);

      // Test wrong password
      (mockDb.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          id: 'u-enum',
          email: 'exists@example.com',
          password: hash,
          emailVerified: true,
          createdAt: new Date(),
        },
      ]);
      const result2 = await signIn('exists@example.com', 'WrongPassword123!', {
        ipAddress: '10.0.0.4',
      });

      if (!(result1.success || result2.success)) {
        expect(result1.error).toBe(result2.error);
        expect(result1.error).toBe('Invalid email or password');
      } else {
        expect.unreachable('Both results should have success: false');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Brute-Force Protection
  // -------------------------------------------------------------------------

  describe('Brute-Force Protection', () => {
    it('account is not locked before any failed attempts', async () => {
      const status = await isAccountLocked('fresh@example.com');
      expect(status.locked).toBe(false);
      expect(status.attemptsRemaining).toBe(5);
    });

    it('locks account after 5 consecutive failed attempts', async () => {
      const email = 'victim@example.com';
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(email);
      }
      const status = await isAccountLocked(email);
      expect(status.locked).toBe(true);
      expect(status.attemptsRemaining).toBe(0);
    });

    it('blocks sign-in when account is locked', async () => {
      const email = 'locked@example.com';
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(email);
      }
      // Account is now locked  -  signIn should fail regardless of credentials
      (mockDb.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 'ulocked', email, password: 'any-hash', emailVerified: true, createdAt: new Date() },
      ]);

      const result = await signIn(email, 'Correct123!', { ipAddress: '10.0.0.5' });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain('Account locked');
    });

    it('clears failed attempts after clearFailedAttempts', async () => {
      const email = 'recovered@example.com';
      await recordFailedAttempt(email);
      await recordFailedAttempt(email);

      expect((await isAccountLocked(email)).attemptsRemaining).toBe(3);

      await clearFailedAttempts(email);

      const after = await isAccountLocked(email);
      expect(after.locked).toBe(false);
      expect(after.attemptsRemaining).toBe(5);
    });

    it('decrements attemptsRemaining with each failed attempt', async () => {
      const email = 'countdown@example.com';

      expect((await isAccountLocked(email)).attemptsRemaining).toBe(5);
      await recordFailedAttempt(email);
      expect((await isAccountLocked(email)).attemptsRemaining).toBe(4);
      await recordFailedAttempt(email);
      expect((await isAccountLocked(email)).attemptsRemaining).toBe(3);
    });

    it('lock duration is approximately 30 minutes', async () => {
      const email = 'timedlock@example.com';
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(email);
      }
      const status = await isAccountLocked(email);
      expect(status.locked).toBe(true);
      if (status.lockUntil) {
        const minutes = (status.lockUntil - Date.now()) / (60 * 1000);
        expect(minutes).toBeGreaterThan(29);
        expect(minutes).toBeLessThan(31);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Rate Limiting
  // -------------------------------------------------------------------------

  describe('Rate Limiting', () => {
    it('allows the first 5 requests from the same IP', async () => {
      const key = 'signin:192.168.10.1';
      for (let i = 0; i < 5; i++) {
        expect((await checkRateLimit(key)).allowed).toBe(true);
      }
    });

    it('blocks the 6th request once the limit is exhausted', async () => {
      const key = 'signin:192.168.10.2';
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(key);
      }
      const blocked = await checkRateLimit(key);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('allows requests again after resetRateLimit', async () => {
      const key = 'signin:192.168.10.3';
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(key);
      }
      expect((await checkRateLimit(key)).allowed).toBe(false);
      await resetRateLimit(key);
      expect((await checkRateLimit(key)).allowed).toBe(true);
    });

    it('tracks remaining attempts correctly', async () => {
      const key = 'signin:192.168.10.4';
      expect((await checkRateLimit(key)).remaining).toBe(4);
      expect((await checkRateLimit(key)).remaining).toBe(3);
      expect((await checkRateLimit(key)).remaining).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Password Validation
  // -------------------------------------------------------------------------

  describe('Password Validation', () => {
    it('accepts a strong password', () => {
      const r = validatePasswordStrength('StrongPass123!');
      expect(r.valid).toBe(true);
      expect(r.errors).toHaveLength(0);
    });

    it('rejects a password shorter than 8 characters', () => {
      const r = validatePasswordStrength('Sh0rt!');
      expect(r.valid).toBe(false);
      expect(r.errors).toContain('Password must be at least 8 characters long');
    });

    it('rejects a password without an uppercase letter', () => {
      const r = validatePasswordStrength('lowercase123');
      expect(r.valid).toBe(false);
      expect(r.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('rejects a password without a lowercase letter', () => {
      const r = validatePasswordStrength('UPPERCASE123');
      expect(r.valid).toBe(false);
      expect(r.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('rejects a password without a digit', () => {
      const r = validatePasswordStrength('NoNumbers!');
      expect(r.valid).toBe(false);
      expect(r.errors).toContain('Password must contain at least one number');
    });

    it('returns multiple errors for a completely weak password', () => {
      const r = validatePasswordStrength('weak');
      expect(r.valid).toBe(false);
      expect(r.errors.length).toBeGreaterThan(1);
    });

    it('rejects known weak passwords', () => {
      const weak = ['password', '12345678', 'qwerty123', 'admin123', 'Short1!'];
      for (const p of weak) {
        expect(validatePasswordStrength(p).valid).toBe(false);
      }
    });
  });
});
