import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies (vi.mock is hoisted above imports by Vitest)
// ---------------------------------------------------------------------------
const { mockLoggerError } = vi.hoisted(() => ({ mockLoggerError: vi.fn() }));
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
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

// Mock audit bridge
const mockAuditLoginSuccess = vi.fn();
const mockAuditLoginFailure = vi.fn();
vi.mock('../audit-bridge.js', () => ({
  auditLoginSuccess: (...args: unknown[]) => mockAuditLoginSuccess(...args),
  auditLoginFailure: (...args: unknown[]) => mockAuditLoginFailure(...args),
}));

const mockEnsureAccountOwnerPlatformAdmin = vi.fn();
vi.mock('../platform-roles.js', () => ({
  ensureAccountOwnerPlatformAdmin: (...args: unknown[]) =>
    mockEnsureAccountOwnerPlatformAdmin(...args),
}));

const mockIsHostedDeployment = vi.fn(() => false);
vi.mock('@revealui/core/deployment-mode', () => ({
  isHostedDeployment: (...args: unknown[]) => mockIsHostedDeployment(...args),
  detectDeploymentMode: vi.fn(() => 'forge'),
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
  accounts: { id: 'id', slug: 'slug' },
  accountMemberships: { id: 'id', accountId: 'accountId', userId: 'userId' },
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
    role: 'viewer',
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
    mockAuditLoginSuccess.mockResolvedValue(undefined);
    mockAuditLoginFailure.mockResolvedValue(undefined);
    mockBcryptCompare.mockResolvedValue(true);
    mockBcryptHash.mockResolvedValue('$2a$12$newhashedpassword');
    mockValidatePasswordStrength.mockReturnValue({ valid: true, errors: [] });
    mockCheckPasswordBreach.mockResolvedValue(0); // Not breached by default
    // Default: user lookup returns nothing (for signUp), or user (for signIn)
    mockLimit.mockResolvedValue([]);
    mockReturning.mockResolvedValue([makeUser()]);

    // Reset env vars then enable signup for tests (default is now closed)
    delete process.env.REVEALUI_SIGNUP_WHITELIST;
    process.env.REVEALUI_SIGNUP_OPEN = 'true';
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

    it('signs in when createdAt is a string, not a Date (Postgres storage path)', async () => {
      // Regression (GAP-446): the Postgres storage path returns createdAt as an
      // ISO string, not a Date object. With emailVerified:false the sign-in reads
      // createdAt to compute account age; calling .getTime() on a string threw a
      // TypeError that fell through to the outer catch and turned a valid login
      // into "unexpected_error" on real deploys. The account is within the 24h
      // grace window, so login must succeed.
      const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const user = makeUser({
        emailVerified: false,
        createdAt: oneHourAgoIso as unknown as Date,
      });
      mockLimit.mockResolvedValueOnce([user]);
      mockBcryptCompare.mockResolvedValueOnce(true);

      const result = await signIn('test@example.com', 'Password123');
      expect(result.reason).not.toBe('unexpected_error');
      expect(result.success).toBe(true);
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

    it('returns database_error (not unexpected_error) when the rate-limit check throws', async () => {
      // GAP-430 regression: checkRateLimit's storage backend (DatabaseStorage
      // in production) can throw for reasons unrelated to the credential
      // check. Before this guard, any such throw fell through to the outer
      // catch and reported the generic, undiagnosable 'unexpected_error'.
      mockCheckRateLimit.mockRejectedValueOnce(new Error('rate limit storage down'));

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('database_error');
      }
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Error checking rate limit',
        expect.any(Error),
        expect.objectContaining({ message: 'rate limit storage down' }),
      );
    });

    it('returns database_error (not unexpected_error) when the account-lock check throws', async () => {
      mockIsAccountLocked.mockRejectedValueOnce(new Error('lock storage down'));

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('database_error');
      }
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Error checking account lock status',
        expect.any(Error),
        expect.objectContaining({ message: 'lock storage down' }),
      );
    });

    it('still succeeds when clearFailedAttempts throws (best-effort bookkeeping, not a gate)', async () => {
      mockLimit.mockResolvedValueOnce([makeUser()]);
      mockBcryptCompare.mockResolvedValueOnce(true);
      mockClearFailedAttempts.mockRejectedValueOnce(new Error('clear storage down'));

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(true);
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Error clearing failed attempts after successful login',
        expect.any(Error),
        expect.objectContaining({ message: 'clear storage down' }),
      );
    });

    it('logs the real error on a genuinely uncaught exception (outer catch)', async () => {
      // auditLoginSuccess is documented as best-effort/never-throwing, but the
      // outer catch must still surface the real error object (not swallow it
      // silently) if that guarantee is ever violated.
      mockLimit.mockResolvedValueOnce([makeUser()]);
      mockBcryptCompare.mockResolvedValueOnce(true);
      mockAuditLoginSuccess.mockRejectedValueOnce(new Error('audit boom'));

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('unexpected_error');
      }
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Unexpected error in signIn',
        expect.any(Error),
        expect.objectContaining({ message: 'audit boom' }),
      );
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

    // =======================================================================
    // Audit-trail wiring
    // =======================================================================
    it('lands exactly one login-success audit event with the actor id on success', async () => {
      mockLimit.mockResolvedValueOnce([makeUser()]);
      mockBcryptCompare.mockResolvedValueOnce(true);

      const result = await signIn('test@example.com', 'Password123', {
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(result.success).toBe(true);
      expect(mockAuditLoginSuccess).toHaveBeenCalledTimes(1);
      expect(mockAuditLoginSuccess).toHaveBeenCalledWith('user-1', '1.2.3.4', 'test-agent');
      expect(mockAuditLoginFailure).not.toHaveBeenCalled();
    });

    it('lands exactly one login-failure audit event on invalid password', async () => {
      mockLimit.mockResolvedValueOnce([makeUser()]);
      mockBcryptCompare.mockResolvedValueOnce(false);

      const result = await signIn('test@example.com', 'WrongPass1', {
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(result.success).toBe(false);
      expect(mockAuditLoginFailure).toHaveBeenCalledTimes(1);
      expect(mockAuditLoginFailure).toHaveBeenCalledWith(
        'test@example.com',
        '1.2.3.4',
        'test-agent',
        'invalid_credentials',
      );
      expect(mockAuditLoginSuccess).not.toHaveBeenCalled();
    });

    it('lands a login-failure audit event for a nonexistent user', async () => {
      mockLimit.mockResolvedValueOnce([]);

      await signIn('nobody@example.com', 'Password123');

      expect(mockAuditLoginFailure).toHaveBeenCalledTimes(1);
      expect(mockAuditLoginSuccess).not.toHaveBeenCalled();
    });

    it('does not emit a login-success event when MFA is still pending (no session yet)', async () => {
      mockLimit.mockResolvedValueOnce([makeUser({ mfaEnabled: true })]);
      mockBcryptCompare.mockResolvedValueOnce(true);

      const result = await signIn('test@example.com', 'Password123');

      expect(result.success).toBe(true);
      expect(mockAuditLoginSuccess).not.toHaveBeenCalled();
      expect(mockAuditLoginFailure).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // signUp
  // =========================================================================
  describe('signUp', () => {
    // Personal-account provisioning at signup is hosted-only (license signing
    // key present). Default to absent (Forge) so existing cases are unaffected;
    // the hosted case sets it explicitly.
    beforeEach(() => {
      delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;
      mockIsHostedDeployment.mockReturnValue(false);
      mockEnsureAccountOwnerPlatformAdmin.mockResolvedValue({
        previousRole: 'viewer',
        nextRole: 'admin',
        updated: true,
      });
    });

    it('provisions a personal account + owner membership on hosted SaaS', async () => {
      mockIsHostedDeployment.mockReturnValue(true);
      mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await signUp('acct@example.com', 'StrongPass1', 'Acct User');
      expect(result.success).toBe(true);

      const valueCalls = mockInsertValues.mock.calls.map((c) => c[0]);
      // account insert (Workspace name + slug) + owner membership insert
      expect(
        valueCalls.some(
          (v) =>
            typeof v.name === 'string' &&
            v.name.includes('Workspace') &&
            typeof v.slug === 'string',
        ),
      ).toBe(true);
      expect(
        valueCalls.some((v) => v.role === 'owner' && v.status === 'active' && Boolean(v.accountId)),
      ).toBe(true);
      // Platform shell admin (not super-admin) for account owner
      expect(mockEnsureAccountOwnerPlatformAdmin).toHaveBeenCalled();
    });

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

    it('blocks signups when neither env var is set (default closed)', () => {
      delete process.env.REVEALUI_SIGNUP_OPEN;
      expect(isSignupAllowed('anyone@example.com')).toBe(false);
    });

    it('restricts to whitelist when REVEALUI_SIGNUP_WHITELIST is set', () => {
      delete process.env.REVEALUI_SIGNUP_OPEN;
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
      delete process.env.REVEALUI_SIGNUP_OPEN;
      process.env.REVEALUI_SIGNUP_WHITELIST = 'admin@test.com';

      const result = isSignupAllowed('outsider@test.com');
      expect(result).toBe(false);
    });
  });
});
