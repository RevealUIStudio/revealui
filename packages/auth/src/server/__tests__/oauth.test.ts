import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies (vi.mock is hoisted above imports by Vitest)
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock provider modules
const mockGithubBuildAuthUrl = vi
  .fn()
  .mockReturnValue('https://github.com/login/oauth/authorize?test=1');
const mockGithubExchangeCode = vi.fn().mockResolvedValue('gh-access-token');
const mockGithubFetchUser = vi.fn().mockResolvedValue({
  id: 'gh-123',
  email: 'gh@example.com',
  name: 'GitHub User',
  avatarUrl: 'https://github.com/avatar.png',
});

vi.mock('../providers/github.js', () => ({
  buildAuthUrl: (...args: unknown[]) => mockGithubBuildAuthUrl(...args),
  exchangeCode: (...args: unknown[]) => mockGithubExchangeCode(...args),
  fetchUser: (...args: unknown[]) => mockGithubFetchUser(...args),
}));

const mockGoogleBuildAuthUrl = vi
  .fn()
  .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?test=1');
const mockGoogleExchangeCode = vi.fn().mockResolvedValue('google-access-token');
const mockGoogleFetchUser = vi.fn().mockResolvedValue({
  id: 'google-123',
  email: 'google@example.com',
  name: 'Google User',
  avatarUrl: null,
});

vi.mock('../providers/google.js', () => ({
  buildAuthUrl: (...args: unknown[]) => mockGoogleBuildAuthUrl(...args),
  exchangeCode: (...args: unknown[]) => mockGoogleExchangeCode(...args),
  fetchUser: (...args: unknown[]) => mockGoogleFetchUser(...args),
}));

const mockVercelBuildAuthUrl = vi.fn().mockReturnValue('https://vercel.com/oauth/authorize?test=1');
const mockVercelExchangeCode = vi.fn().mockResolvedValue('vercel-access-token');
const mockVercelFetchUser = vi.fn().mockResolvedValue({
  id: 'vercel-123',
  email: 'vercel@example.com',
  name: 'Vercel User',
  avatarUrl: null,
});

vi.mock('../providers/vercel.js', () => ({
  buildAuthUrl: (...args: unknown[]) => mockVercelBuildAuthUrl(...args),
  exchangeCode: (...args: unknown[]) => mockVercelExchangeCode(...args),
  fetchUser: (...args: unknown[]) => mockVercelFetchUser(...args),
}));

// Chain mocks for drizzle-orm query builder
const mockLimit = vi.fn().mockResolvedValue([]);
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  users: { email: 'email', id: 'id', password: 'password' },
  oauthAccounts: {
    id: 'id',
    provider: 'provider',
    providerUserId: 'providerUserId',
    providerEmail: 'providerEmail',
    providerName: 'providerName',
    providerAvatarUrl: 'providerAvatarUrl',
    userId: 'userId',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: string, val: string) => ({ col, val })),
  and: vi.fn((...conditions: unknown[]) => ({ and: conditions })),
}));

import { getClient } from '@revealui/db/client';
import { OAuthAccountConflictError } from '../errors.js';
import {
  buildAuthUrl,
  exchangeCode,
  fetchProviderUser,
  generateOAuthState,
  getLinkedProviders,
  linkOAuthAccount,
  unlinkOAuthAccount,
  upsertOAuthUser,
  verifyOAuthState,
} from '../oauth.js';

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

const TEST_PROVIDER_USER = {
  id: 'provider-user-1',
  email: 'provider@example.com',
  name: 'Provider User',
  avatarUrl: 'https://example.com/avatar.png',
};

describe('oauth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_SECRET = 'test-secret-for-hmac-signing';
    process.env.GITHUB_CLIENT_ID = 'gh-client-id';
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.VERCEL_CLIENT_ID = 'vercel-client-id';

    // Re-setup getClient to return module-level mocks (tests may override)
    vi.mocked(getClient).mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    });

    // Reset chain mock return values
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockLimit.mockResolvedValue([]);
    mockInsertValues.mockResolvedValue(undefined);
    mockUpdateSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDeleteWhere.mockResolvedValue(undefined);
  });

  // =========================================================================
  // generateOAuthState / verifyOAuthState
  // =========================================================================
  describe('generateOAuthState', () => {
    it('returns state and cookieValue', () => {
      const result = generateOAuthState('github', '/dashboard');
      expect(result.state).toBeDefined();
      expect(result.cookieValue).toBeDefined();
      expect(result.cookieValue).toContain('.');
    });

    it('state is base64url-encoded JSON with provider, redirectTo, nonce', () => {
      const result = generateOAuthState('github', '/callback');
      const decoded = JSON.parse(Buffer.from(result.state, 'base64url').toString());
      expect(decoded.provider).toBe('github');
      expect(decoded.redirectTo).toBe('/callback');
      expect(decoded.nonce).toBeDefined();
      expect(typeof decoded.nonce).toBe('string');
    });

    it('cookie value format is state.hmac', () => {
      const result = generateOAuthState('google', '/');
      const parts = result.cookieValue.split('.');
      expect(parts.length).toBe(2);
      expect(parts[0]).toBe(result.state);
      // HMAC is 64-char hex (SHA-256)
      expect(parts[1]).toMatch(/^[0-9a-f]{64}$/);
    });

    it('throws when REVEALUI_SECRET is not set', () => {
      delete process.env.REVEALUI_SECRET;
      expect(() => generateOAuthState('github', '/')).toThrow('REVEALUI_SECRET');
    });

    it('generates unique nonce each time', () => {
      const r1 = generateOAuthState('github', '/');
      const r2 = generateOAuthState('github', '/');
      expect(r1.state).not.toBe(r2.state);
    });
  });

  describe('verifyOAuthState', () => {
    it('returns provider and redirectTo for valid state', () => {
      const { state, cookieValue } = generateOAuthState('github', '/dashboard');
      const result = verifyOAuthState(state, cookieValue);
      expect(result).toMatchObject({ provider: 'github', redirectTo: '/dashboard' });
      expect(result?.codeVerifier).toBeDefined();
    });

    it('returns null when state is null', () => {
      expect(verifyOAuthState(null, 'some-cookie')).toBeNull();
    });

    it('returns null when cookieValue is null', () => {
      expect(verifyOAuthState('some-state', null)).toBeNull();
    });

    it('returns null when both are undefined', () => {
      expect(verifyOAuthState(undefined, undefined)).toBeNull();
    });

    it('returns null when cookie has no dot separator', () => {
      expect(verifyOAuthState('abc', 'nodot')).toBeNull();
    });

    it('returns null when state does not match cookie state', () => {
      const { cookieValue } = generateOAuthState('github', '/');
      expect(verifyOAuthState('tampered-state', cookieValue)).toBeNull();
    });

    it('returns null when HMAC is invalid (tampered)', () => {
      const { state, cookieValue } = generateOAuthState('github', '/');
      const tampered = `${cookieValue.slice(0, -4)}ffff`;
      expect(verifyOAuthState(state, tampered)).toBeNull();
    });

    it('returns null when HMAC has wrong length', () => {
      const { state } = generateOAuthState('github', '/');
      expect(verifyOAuthState(state, `${state}.short`)).toBeNull();
    });

    it('throws when REVEALUI_SECRET is not set', () => {
      const { state, cookieValue } = generateOAuthState('github', '/');
      delete process.env.REVEALUI_SECRET;
      expect(() => verifyOAuthState(state, cookieValue)).toThrow('REVEALUI_SECRET');
    });

    it('returns null for malformed base64url state payload', () => {
      const secret = process.env.REVEALUI_SECRET as string;
      const badState = '!!!invalid-base64url!!!';
      const hmac = crypto.createHmac('sha256', secret).update(badState).digest('hex');
      expect(verifyOAuthState(badState, `${badState}.${hmac}`)).toBeNull();
    });
  });

  // =========================================================================
  // buildAuthUrl
  // =========================================================================
  describe('buildAuthUrl', () => {
    it('delegates to github provider', () => {
      buildAuthUrl('github', 'http://localhost/callback', 'state123', 'challenge');
      expect(mockGithubBuildAuthUrl).toHaveBeenCalledWith(
        'gh-client-id',
        'http://localhost/callback',
        'state123',
        'challenge',
      );
    });

    it('delegates to google provider', () => {
      buildAuthUrl('google', 'http://localhost/callback', 'state123', 'challenge');
      expect(mockGoogleBuildAuthUrl).toHaveBeenCalledWith(
        'google-client-id',
        'http://localhost/callback',
        'state123',
        'challenge',
      );
    });

    it('delegates to vercel provider', () => {
      buildAuthUrl('vercel', 'http://localhost/callback', 'state123', 'challenge');
      expect(mockVercelBuildAuthUrl).toHaveBeenCalledWith(
        'vercel-client-id',
        'http://localhost/callback',
        'state123',
        'challenge',
      );
    });

    it('throws for unknown provider', () => {
      expect(() => buildAuthUrl('twitter', 'http://localhost/callback', 'state')).toThrow(
        'Unknown provider: twitter',
      );
    });

    it('throws when client ID is missing', () => {
      delete process.env.GITHUB_CLIENT_ID;
      expect(() => buildAuthUrl('github', 'http://localhost/callback', 'state')).toThrow(
        'Missing client ID',
      );
    });
  });

  // =========================================================================
  // exchangeCode
  // =========================================================================
  describe('exchangeCode', () => {
    it('delegates to github provider', async () => {
      const token = await exchangeCode(
        'github',
        'auth-code',
        'http://localhost/callback',
        'verifier',
      );
      expect(mockGithubExchangeCode).toHaveBeenCalledWith(
        'auth-code',
        'http://localhost/callback',
        'verifier',
      );
      expect(token).toBe('gh-access-token');
    });

    it('delegates to google provider', async () => {
      const token = await exchangeCode(
        'google',
        'auth-code',
        'http://localhost/callback',
        'verifier',
      );
      expect(mockGoogleExchangeCode).toHaveBeenCalledWith(
        'auth-code',
        'http://localhost/callback',
        'verifier',
      );
      expect(token).toBe('google-access-token');
    });

    it('delegates to vercel provider', async () => {
      const token = await exchangeCode(
        'vercel',
        'auth-code',
        'http://localhost/callback',
        'verifier',
      );
      expect(mockVercelExchangeCode).toHaveBeenCalledWith(
        'auth-code',
        'http://localhost/callback',
        'verifier',
      );
      expect(token).toBe('vercel-access-token');
    });

    it('throws for unknown provider', async () => {
      await expect(exchangeCode('twitter', 'code', 'uri')).rejects.toThrow(
        'Unknown provider: twitter',
      );
    });
  });

  // =========================================================================
  // fetchProviderUser
  // =========================================================================
  describe('fetchProviderUser', () => {
    it('delegates to github provider', async () => {
      const user = await fetchProviderUser('github', 'token');
      expect(mockGithubFetchUser).toHaveBeenCalledWith('token');
      expect(user.id).toBe('gh-123');
    });

    it('delegates to google provider', async () => {
      const user = await fetchProviderUser('google', 'token');
      expect(mockGoogleFetchUser).toHaveBeenCalledWith('token');
      expect(user.id).toBe('google-123');
    });

    it('delegates to vercel provider', async () => {
      const user = await fetchProviderUser('vercel', 'token');
      expect(mockVercelFetchUser).toHaveBeenCalledWith('token');
      expect(user.id).toBe('vercel-123');
    });

    it('throws for unknown provider', async () => {
      await expect(fetchProviderUser('twitter', 'token')).rejects.toThrow(
        'Unknown provider: twitter',
      );
    });
  });

  // =========================================================================
  // upsertOAuthUser
  // =========================================================================
  describe('upsertOAuthUser', () => {
    it('returns existing user when OAuth account already linked', async () => {
      const existingAccount = {
        id: 'oa-1',
        userId: 'user-1',
        provider: 'github',
        providerUserId: 'provider-user-1',
      };
      const user = makeUser();

      // First select: oauth_accounts lookup → found
      // Second select: users lookup → found
      mockLimit.mockResolvedValueOnce([existingAccount]).mockResolvedValueOnce([user]);

      const result = await upsertOAuthUser('github', TEST_PROVIDER_USER);
      expect(result.id).toBe('user-1');
      // Should update provider metadata
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('throws when existing OAuth account references deleted user', async () => {
      const existingAccount = {
        id: 'oa-1',
        userId: 'deleted-user',
        provider: 'github',
        providerUserId: 'provider-user-1',
      };
      mockLimit
        .mockResolvedValueOnce([existingAccount]) // oauth found
        .mockResolvedValueOnce([]); // user NOT found

      await expect(upsertOAuthUser('github', TEST_PROVIDER_USER)).rejects.toThrow(
        'OAuth account references a deleted user',
      );
    });

    it('throws OAuthAccountConflictError when email matches existing user', async () => {
      mockLimit
        .mockResolvedValueOnce([]) // no oauth account
        .mockResolvedValueOnce([makeUser()]); // email match in users table

      await expect(upsertOAuthUser('github', TEST_PROVIDER_USER)).rejects.toBeInstanceOf(
        OAuthAccountConflictError,
      );
    });

    it('creates new user when no matching account or email exists', async () => {
      const newUser = makeUser({ id: 'new-user-uuid' });
      mockLimit
        .mockResolvedValueOnce([]) // no oauth account
        .mockResolvedValueOnce([]) // no email match
        .mockResolvedValueOnce([newUser]); // final select after insert

      const result = await upsertOAuthUser('github', TEST_PROVIDER_USER);
      expect(result.id).toBe('new-user-uuid');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('creates user with role "user" for new OAuth signups', async () => {
      const newUser = makeUser({ role: 'user' });
      mockLimit
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([newUser]);

      await upsertOAuthUser('github', TEST_PROVIDER_USER);

      // Find the users insert call (first insert is for users, second for oauthAccounts)
      const firstInsertValues = mockInsertValues.mock.calls[0][0];
      expect(firstInsertValues.role).toBe('user');
      expect(firstInsertValues.password).toBeNull();
    });

    it('handles provider user with null email', async () => {
      const providerUserNoEmail = { ...TEST_PROVIDER_USER, email: null };
      const newUser = makeUser({ email: null });
      mockLimit
        .mockResolvedValueOnce([]) // no oauth account
        .mockResolvedValueOnce([newUser]); // final select

      const result = await upsertOAuthUser('github', providerUserNoEmail);
      expect(result).toBeDefined();
    });

    it('throws when final user fetch fails', async () => {
      mockLimit
        .mockResolvedValueOnce([]) // no oauth account
        .mockResolvedValueOnce([]) // no email match
        .mockResolvedValueOnce([]); // final select returns nothing

      await expect(upsertOAuthUser('github', TEST_PROVIDER_USER)).rejects.toThrow(
        'Failed to fetch upserted OAuth user',
      );
    });
  });

  // =========================================================================
  // linkOAuthAccount
  // =========================================================================
  describe('linkOAuthAccount', () => {
    it('refreshes metadata when already linked to same user', async () => {
      const existingLink = {
        id: 'link-1',
        userId: 'user-1',
        provider: 'github',
        providerUserId: 'provider-user-1',
      };
      const user = makeUser();

      mockLimit
        .mockResolvedValueOnce([existingLink]) // existing link found
        .mockResolvedValueOnce([user]); // user lookup

      const result = await linkOAuthAccount('user-1', 'github', TEST_PROVIDER_USER);
      expect(result.id).toBe('user-1');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('throws when provider account linked to different user', async () => {
      const existingLink = {
        id: 'link-1',
        userId: 'other-user',
        provider: 'github',
        providerUserId: 'provider-user-1',
      };
      mockLimit.mockResolvedValueOnce([existingLink]);

      await expect(linkOAuthAccount('user-1', 'github', TEST_PROVIDER_USER)).rejects.toThrow(
        'already linked to another user',
      );
    });

    it('throws when user already has a link for same provider', async () => {
      const user = makeUser();

      mockLimit
        .mockResolvedValueOnce([]) // no existing link for this provider identity
        .mockResolvedValueOnce([user]) // user exists
        .mockResolvedValueOnce([{ id: 'old-link', provider: 'github' }]); // existing provider link

      await expect(linkOAuthAccount('user-1', 'github', TEST_PROVIDER_USER)).rejects.toThrow(
        'already have a github account linked',
      );
    });

    it('creates new link when none exists', async () => {
      const user = makeUser();

      mockLimit
        .mockResolvedValueOnce([]) // no existing link for provider identity
        .mockResolvedValueOnce([user]) // user exists
        .mockResolvedValueOnce([]); // no existing provider link for user

      const result = await linkOAuthAccount('user-1', 'github', TEST_PROVIDER_USER);
      expect(result.id).toBe('user-1');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('throws when authenticated user not found', async () => {
      mockLimit
        .mockResolvedValueOnce([]) // no existing link
        .mockResolvedValueOnce([]); // user NOT found

      await expect(linkOAuthAccount('user-1', 'github', TEST_PROVIDER_USER)).rejects.toThrow(
        'Authenticated user not found',
      );
    });
  });

  // =========================================================================
  // unlinkOAuthAccount
  // =========================================================================
  describe('unlinkOAuthAccount', () => {
    it('removes the link when safe', async () => {
      const link = { id: 'link-1', userId: 'user-1', provider: 'github' };
      const user = makeUser({ password: '$2a$12$hashed' }); // has password

      const selectFrom = vi
        .fn()
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([link]) }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([user]) }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockResolvedValue([{ id: 'link-1' }, { id: 'link-2' }]),
        });

      const selectFn = vi.fn().mockReturnValue({ from: selectFrom });
      const deleteFn = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

      vi.mocked(getClient).mockReturnValue({
        select: selectFn,
        insert: mockInsert,
        update: mockUpdate,
        delete: deleteFn,
      } as ReturnType<typeof getClient>);

      await expect(unlinkOAuthAccount('user-1', 'github')).resolves.toBeUndefined();
      expect(deleteFn).toHaveBeenCalled();
    });

    it('throws when no link exists for provider', async () => {
      // select().from(oauthAccounts).where(...).limit(1) → no link
      mockLimit.mockResolvedValueOnce([]);

      await expect(unlinkOAuthAccount('user-1', 'github')).rejects.toThrow(
        'No github account is linked',
      );
    });

    it('throws when unlinking would leave user locked out (no password, sole link)', async () => {
      const link = { id: 'link-1', userId: 'user-1', provider: 'github' };
      const user = makeUser({ password: null }); // no password

      const whereFnForAllLinks = vi.fn().mockResolvedValueOnce([{ id: 'link-1' }]); // only 1 link

      const selectFrom = vi
        .fn()
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([link]) }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([user]) }),
        })
        .mockReturnValueOnce({ where: whereFnForAllLinks });

      const selectFn = vi.fn().mockReturnValue({ from: selectFrom });

      vi.mocked(getClient).mockReturnValue({
        select: selectFn,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      } as ReturnType<typeof getClient>);

      await expect(unlinkOAuthAccount('user-1', 'github')).rejects.toThrow(
        'Cannot unlink your only sign-in method',
      );
    });

    it('allows unlinking when user has a password', async () => {
      const link = { id: 'link-1', userId: 'user-1', provider: 'github' };
      const user = makeUser({ password: '$2a$12$hashed' });
      const deleteFn = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

      const selectFrom = vi
        .fn()
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([link]) }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([user]) }),
        })
        .mockReturnValueOnce({ where: vi.fn().mockResolvedValue([{ id: 'link-1' }]) });

      const selectFn = vi.fn().mockReturnValue({ from: selectFrom });

      vi.mocked(getClient).mockReturnValue({
        select: selectFn,
        insert: mockInsert,
        update: mockUpdate,
        delete: deleteFn,
      } as ReturnType<typeof getClient>);

      await expect(unlinkOAuthAccount('user-1', 'github')).resolves.toBeUndefined();
      expect(deleteFn).toHaveBeenCalled();
    });

    it('allows unlinking when user has other OAuth links', async () => {
      const link = { id: 'link-1', userId: 'user-1', provider: 'github' };
      const user = makeUser({ password: null });
      const deleteFn = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

      const selectFrom = vi
        .fn()
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([link]) }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([user]) }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockResolvedValue([{ id: 'link-1' }, { id: 'link-2' }]),
        }); // 2 links

      const selectFn = vi.fn().mockReturnValue({ from: selectFrom });

      vi.mocked(getClient).mockReturnValue({
        select: selectFn,
        insert: mockInsert,
        update: mockUpdate,
        delete: deleteFn,
      } as ReturnType<typeof getClient>);

      await expect(unlinkOAuthAccount('user-1', 'github')).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // getLinkedProviders
  // =========================================================================
  describe('getLinkedProviders', () => {
    it('returns empty array when no providers linked', async () => {
      // Override the chain so .where returns directly (no .limit)
      const selectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      const selectFn = vi.fn().mockReturnValue({ from: selectFrom });

      vi.mocked(getClient).mockReturnValue({
        select: selectFn,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      } as ReturnType<typeof getClient>);

      const result = await getLinkedProviders('user-1');
      expect(result).toEqual([]);
    });

    it('returns linked providers with metadata', async () => {
      const links = [
        { provider: 'github', providerEmail: 'gh@example.com', providerName: 'GH User' },
        { provider: 'google', providerEmail: 'g@example.com', providerName: 'Google User' },
      ];

      const selectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(links),
      });
      const selectFn = vi.fn().mockReturnValue({ from: selectFrom });

      vi.mocked(getClient).mockReturnValue({
        select: selectFn,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      } as ReturnType<typeof getClient>);

      const result = await getLinkedProviders('user-1');
      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe('github');
      expect(result[1].provider).toBe('google');
    });
  });
});
