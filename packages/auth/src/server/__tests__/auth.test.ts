import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies (vi.mock is hoisted above imports by Vitest)
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock bcryptjs
const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn();
vi.mock('bcryptjs', () => ({
  default: {
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
    hash: (...args: unknown[]) => mockBcryptHash(...args),
  },
}));

// Mock password validation
const mockValidatePasswordStrength = vi.fn();
const mockCheckPasswordBreach = vi.fn();
vi.mock('../password-validation.js', () => ({
  validatePasswordStrength: (...args: unknown[]) => mockValidatePasswordStrength(...args),
  checkPasswordBreach: (...args: unknown[]) => mockCheckPasswordBreach(...args),
}));

// Mock brute force
const mockIsAccountLocked = vi.fn();
const mockRecordFailedAttempt = vi.fn();
const mockClearFailedAttempts = vi.fn();
vi.mock('../brute-force.js', () => ({
  isAccountLocked: (...args: unknown[]) => mockIsAccountLocked(...args),
  recordFailedAttempt: (...args: unknown[]) => mockRecordFailedAttempt(...args),
  clearFailedAttempts: (...args: unknown[]) => mockClearFailedAttempts(...args),
}));

// Mock rate limit
const mockCheckRateLimit = vi.fn();
vi.mock('../rate-limit.js', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

// Mock session
const mockCreateSession = vi.fn();
const mockRotateSession = vi.fn();
vi.mock('../session.js', () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  rotateSession: (...args: unknown[]) => mockRotateSession(...args),
}));

// Chain mocks for drizzle-orm query builder
const mockReturning = vi.fn();
const mockInsertValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockLimit = vi.fn();
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  users: { email: 'email', id: 'id' },
  oauthAccounts: { providerEmail: 'providerEmail', id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: string, val: string) => ({ col, val })),
  and: vi.fn((...conditions: unknown[]) => conditions),
  isNull: vi.fn((col: string) => ({ isNull: col })),
}));

import { isSignupAllowed, signIn, signUp } from '../auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    password: '$2a$12$hashedpassword',
    role: 'user',
    status: 'active',
    avatarUrl: null,
    schemaVersion: '1',
    type: 'user',
    agentModel: null,
    agentCapabilities: null,
    agentConfig: null,
    emailVerified: true,
    emailVerificationToken: null,
    emailVerifiedAt: null,
    preferences: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: null,
    ...overrides,
  };
}

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup drizzle chain mocks (clearAllMocks removes implementations)
    mockInsertValues.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    // Default mocks: rate limit allowed, account not locked
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: Date.now() + 900_000,
    });
    mockIsAccountLocked.mockResolvedValue({ locked: false, attemptsRemaining: 5 });
    mockRecordFailedAttempt.mockResolvedValue(undefined);
    mockClearFailedAttempts.mockResolvedValue(undefined);
    mockCreateSession.mockResolvedValue({ token: 'session-token-abc', session: {} });
    mockRotateSession.mockResolvedValue({ token: 'session-token-abc', session: {} });
    mockBcryptCompare.mockResolvedValue(true);
    mockBcryptHash.mockResolvedValue('$2a$12$newhashedpassword');
    mockValidatePasswordStrength.mockReturnValue({ valid: true, errors: [] });
    mockCheckPasswordBreach.mockResolvedValue(0); // Not breached by default
    // Default: user lookup returns nothing (for signUp), or user (for signIn)
    mockLimit.mockResolvedValue([]);
    mockReturning.mockResolvedValue([makeUser()]);

    // Reset env vars
    delete process.env.REVEALUI_SIGNUP_OPEN;
    delete process.env.REVEALUI_SIGNUP_WHITELIST;
  });

  // =========================================================================
  // signIn
  // =========================================================================
  describe('signIn', () => {
    it('returns success with valid credentials', async () => {
      const user = makeUser();
      mockLimit.mockResolvedValueOnce([user]); // user lookup
      mockBcryptCompare.mockResolvedValueOnce(true);

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.sessionToken).toBe('session-token-abc');
    });

    it('returns error for nonexistent user', async () => {
      mockLimit.mockResolvedValueOnce([]); // no user found

      const result = await signIn('nobody@example.com', 'Password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('invalid_credentials');
      }
      expect(result.error).toBe('Invalid email or password');
      expect(mockRecordFailedAttempt).toHaveBeenCalledWith('nobody@example.com');
    });

    it('returns error for invalid password', async () => {
      mockLimit.mockResolvedValueOnce([makeUser()]);
      mockBcryptCompare.mockResolvedValueOnce(false);

      const result = await signIn('test@example.com', 'WrongPass1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('invalid_credentials');
      }
      expect(result.error).toBe('Invalid email or password');
      expect(mockRecordFailedAttempt).toHaveBeenCalled();
    });

    it('returns error when account is locked', async () => {
      mockIsAccountLocked.mockResolvedValueOnce({
        locked: true,
        lockUntil: Date.now() + 1_800_000,
        attemptsRemaining: 0,
      });

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('account_locked');
      }
      expect(result.error).toContain('Account locked');
    });

    it('returns error when rate limited', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 900_000,
      });

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('rate_limited');
      }
      expect(result.error).toContain('Too many login attempts');
    });

    it('clears failed attempts on successful login', async () => {
      mockLimit.mockResolvedValueOnce([makeUser()]);
      mockBcryptCompare.mockResolvedValueOnce(true);

      await signIn('test@example.com', 'Password123');
      expect(mockClearFailedAttempts).toHaveBeenCalledWith('test@example.com');
    });

    it('records failed attempt on wrong password', async () => {
      mockLimit.mockResolvedValueOnce([makeUser()]);
      mockBcryptCompare.mockResolvedValueOnce(false);

      await signIn('test@example.com', 'wrong');
      expect(mockRecordFailedAttempt).toHaveBeenCalledWith('test@example.com');
    });

    it('returns error for OAuth-only user (no password)', async () => {
      mockLimit.mockResolvedValueOnce([makeUser({ password: null })]);

      const result = await signIn('oauth@example.com', 'Password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('invalid_credentials');
      }
      expect(result.error).toBe('Invalid email or password');
    });

    it('returns error when session creation fails', async () => {
      mockLimit.mockResolvedValueOnce([makeUser()]);
      mockBcryptCompare.mockResolvedValueOnce(true);
      mockRotateSession.mockRejectedValueOnce(new Error('DB down'));

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('session_error');
      }
      expect(result.error).toBe('Failed to create session');
    });

    it('passes IP and user agent to rate limit', async () => {
      mockLimit.mockResolvedValueOnce([makeUser()]);

      await signIn('test@example.com', 'Password123', {
        ipAddress: '1.2.3.4',
        userAgent: 'TestAgent',
      });

      expect(mockCheckRateLimit).toHaveBeenCalledWith('signin:1.2.3.4');
    });

    it('uses "unknown" when IP is not provided', async () => {
      mockLimit.mockResolvedValueOnce([makeUser()]);

      await signIn('test@example.com', 'Password123');

      expect(mockCheckRateLimit).toHaveBeenCalledWith('signin:unknown');
    });

    it('returns requiresMfa when MFA is enabled', async () => {
      mockLimit.mockResolvedValueOnce([makeUser({ mfaEnabled: true })]);
      mockBcryptCompare.mockResolvedValueOnce(true);

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(true);
      if (result.success && result.requiresMfa) {
        expect(result.mfaUserId).toBe('user-1');
      } else {
        throw new Error('Expected MFA result');
      }
    });

    it('returns database_error when user query throws', async () => {
      mockLimit.mockRejectedValueOnce(new Error('query failed'));

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('database_error');
      }
    });

    it('returns invalid_credentials when bcrypt.compare throws', async () => {
      mockLimit.mockResolvedValueOnce([makeUser()]);
      mockBcryptCompare.mockRejectedValueOnce(new Error('bcrypt failed'));

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('invalid_credentials');
      }
    });

    it('returns unexpected_error on uncaught exception', async () => {
      mockCheckRateLimit.mockRejectedValueOnce(new Error('unexpected'));

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('unexpected_error');
      }
    });

    it('returns email_not_verified for unverified account past grace period', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      mockLimit.mockResolvedValueOnce([
        makeUser({ emailVerified: false, createdAt: twentyFiveHoursAgo }),
      ]);
      mockBcryptCompare.mockResolvedValueOnce(true);

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('email_not_verified');
        expect(result.error).toBe('Please verify your email address before signing in.');
      }
    });

    it('allows sign-in for unverified account within grace period', async () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
      mockLimit.mockResolvedValueOnce([makeUser({ emailVerified: false, createdAt: oneHourAgo })]);
      mockBcryptCompare.mockResolvedValueOnce(true);

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(true);
      expect(result.sessionToken).toBe('session-token-abc');
    });

    it('allows sign-in for verified account regardless of age', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      mockLimit.mockResolvedValueOnce([
        makeUser({ emailVerified: true, createdAt: thirtyDaysAgo }),
      ]);
      mockBcryptCompare.mockResolvedValueOnce(true);

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(true);
      expect(result.sessionToken).toBe('session-token-abc');
    });
  });

  // =========================================================================
  // signUp
  // =========================================================================
  describe('signUp', () => {
    it('creates user and returns session token on success', async () => {
      // First limit call: user lookup (no existing)
      // Second limit call: OAuth check (no existing)
      mockLimit
        .mockResolvedValueOnce([]) // users table check
        .mockResolvedValueOnce([]); // oauth_accounts check

      const result = await signUp('new@example.com', 'StrongPass1', 'New User');
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.sessionToken).toBe('session-token-abc');
    });

    it('rejects duplicate email', async () => {
      mockLimit.mockResolvedValueOnce([makeUser()]); // existing user found

      const result = await signUp('test@example.com', 'StrongPass1', 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unable to create account');
    });

    it('rejects weak password', async () => {
      mockValidatePasswordStrength.mockReturnValueOnce({
        valid: false,
        errors: ['Password must be at least 8 characters long'],
      });

      const result = await signUp('new@example.com', 'short', 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Password must be at least 8 characters');
    });

    it('rejects when rate limited', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 900_000,
      });

      const result = await signUp('new@example.com', 'StrongPass1', 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many registration attempts');
    });

    it('passes ToS options to user creation', async () => {
      mockLimit
        .mockResolvedValueOnce([]) // users check
        .mockResolvedValueOnce([]); // oauth check

      const tosDate = new Date('2025-01-01');
      await signUp('new@example.com', 'StrongPass1', 'Test', {
        tosAcceptedAt: tosDate,
        tosVersion: '1.0',
      });

      expect(mockInsertValues).toHaveBeenCalled();
      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.tosAcceptedAt).toEqual(tosDate);
      expect(insertCall.tosVersion).toBe('1.0');
    });

    it('blocks signup when email conflicts with OAuth account', async () => {
      mockLimit
        .mockResolvedValueOnce([]) // no user in users table
        .mockResolvedValueOnce([{ id: 'oauth-1' }]); // OAuth account exists

      const result = await signUp('oauth@example.com', 'StrongPass1', 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unable to create account');
    });

    it('returns error when user creation returns no result', async () => {
      mockLimit
        .mockResolvedValueOnce([]) // users check
        .mockResolvedValueOnce([]); // oauth check
      mockReturning.mockResolvedValueOnce([]); // insert returns empty

      const result = await signUp('new@example.com', 'StrongPass1', 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toBe('User creation returned no result');
    });

    it('returns raw email verification token (not hash)', async () => {
      mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await signUp('new@example.com', 'StrongPass1', 'Test');
      expect(result.success).toBe(true);
      // The raw token should be a 64-char hex string (32 bytes)
      if (result.user?.emailVerificationToken) {
        expect(result.user.emailVerificationToken).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('hashes password with bcrypt cost 12', async () => {
      mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await signUp('new@example.com', 'StrongPass1', 'Test');
      expect(mockBcryptHash).toHaveBeenCalledWith('StrongPass1', 12);
    });
  });

  // =========================================================================
  // isSignupAllowed
  // =========================================================================
  describe('isSignupAllowed', () => {
    it('allows all emails when REVEALUI_SIGNUP_OPEN is true', () => {
      process.env.REVEALUI_SIGNUP_OPEN = 'true';
      expect(isSignupAllowed('anyone@example.com')).toBe(true);
    });

    it('allows all emails when neither env var is set', () => {
      expect(isSignupAllowed('anyone@example.com')).toBe(true);
    });

    it('restricts to whitelist when REVEALUI_SIGNUP_WHITELIST is set', () => {
      process.env.REVEALUI_SIGNUP_WHITELIST = 'a@test.com, b@test.com';
      expect(isSignupAllowed('a@test.com')).toBe(true);
      expect(isSignupAllowed('b@test.com')).toBe(true);
      expect(isSignupAllowed('c@test.com')).toBe(false);
    });

    it('handles case-insensitive email matching', () => {
      process.env.REVEALUI_SIGNUP_WHITELIST = 'Admin@Test.com';
      expect(isSignupAllowed('admin@test.com')).toBe(true);
      expect(isSignupAllowed('ADMIN@TEST.COM')).toBe(true);
    });

    it('ignores empty entries in whitelist', () => {
      process.env.REVEALUI_SIGNUP_WHITELIST = 'a@test.com,,,b@test.com,';
      expect(isSignupAllowed('a@test.com')).toBe(true);
      expect(isSignupAllowed('b@test.com')).toBe(true);
    });

    it('SIGNUP_OPEN=true takes priority over whitelist', () => {
      process.env.REVEALUI_SIGNUP_OPEN = 'true';
      process.env.REVEALUI_SIGNUP_WHITELIST = 'only@test.com';
      expect(isSignupAllowed('anyone@example.com')).toBe(true);
    });

    it('SIGNUP_OPEN=false does not open signups', () => {
      process.env.REVEALUI_SIGNUP_OPEN = 'false';
      process.env.REVEALUI_SIGNUP_WHITELIST = 'a@test.com';
      expect(isSignupAllowed('b@test.com')).toBe(false);
    });

    it('rejects when signup is restricted', () => {
      process.env.REVEALUI_SIGNUP_WHITELIST = 'admin@test.com';

      const result = isSignupAllowed('outsider@test.com');
      expect(result).toBe(false);
    });
  });
});
