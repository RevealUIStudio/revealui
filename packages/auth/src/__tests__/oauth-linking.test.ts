/**
 * OAuth Account Linking Tests
 *
 * Unit tests for linkOAuthAccount, unlinkOAuthAccount, and getLinkedProviders.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderUser } from '../server/oauth.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

/** Helper: build a chainable select mock that returns `rows` at the end. */
function mockSelectChain(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => rows),
      })),
    })),
  };
}

/** Helper: build a chainable select mock without `.limit()` (for queries that return arrays). */
function mockSelectArrayChain(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => rows),
    })),
  };
}

vi.mock('@revealui/config', () => ({
  default: { database: { url: undefined } },
}));

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/db/schema', () => ({
  oauthAccounts: {
    id: 'id',
    userId: 'userId',
    provider: 'provider',
    providerUserId: 'providerUserId',
    providerEmail: 'providerEmail',
    providerName: 'providerName',
    providerAvatarUrl: 'providerAvatarUrl',
    updatedAt: 'updatedAt',
  },
  users: {
    id: 'id',
    email: 'email',
  },
}));

// Mock provider modules (not used by linking functions, but imported at module scope)
vi.mock('../server/providers/github.js', () => ({
  buildAuthUrl: vi.fn(),
  exchangeCode: vi.fn(),
  fetchUser: vi.fn(),
}));
vi.mock('../server/providers/google.js', () => ({
  buildAuthUrl: vi.fn(),
  exchangeCode: vi.fn(),
  fetchUser: vi.fn(),
}));
vi.mock('../server/providers/vercel.js', () => ({
  buildAuthUrl: vi.fn(),
  exchangeCode: vi.fn(),
  fetchUser: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'user-abc-123';
const OTHER_USER_ID = 'user-xyz-789';

const testUser = {
  id: TEST_USER_ID,
  email: 'alice@example.com',
  name: 'Alice',
  password: 'hashed-pw',
  role: 'admin',
  status: 'active',
  avatarUrl: null,
};

const testProviderUser: ProviderUser = {
  id: 'github-12345',
  email: 'alice@github.com',
  name: 'Alice (GitHub)',
  avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('linkOAuthAccount', { timeout: 60_000 }, () => {
  let linkOAuthAccount: typeof import('../server/oauth.js').linkOAuthAccount;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to reset module state after mocks are configured
    const mod = await import('../server/oauth.js');
    linkOAuthAccount = mod.linkOAuthAccount;
  });

  it('should create a new link when none exists', async () => {
    // 1st select: no existing link by (provider, providerUserId)
    mockDb.select.mockReturnValueOnce(mockSelectChain([]));
    // 2nd select: user exists
    mockDb.select.mockReturnValueOnce(mockSelectChain([testUser]));
    // 3rd select: no existing provider link for this user+provider
    mockDb.select.mockReturnValueOnce(mockSelectChain([]));

    mockDb.insert.mockReturnValue({
      values: vi.fn(),
    });

    const user = await linkOAuthAccount(TEST_USER_ID, 'github', testProviderUser);

    expect(user.id).toBe(TEST_USER_ID);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('should refresh metadata if already linked to the same user', async () => {
    const existingLink = {
      id: 'link-1',
      userId: TEST_USER_ID,
      provider: 'github',
      providerUserId: testProviderUser.id,
    };

    // 1st select: existing link found, belongs to same user
    mockDb.select.mockReturnValueOnce(mockSelectChain([existingLink]));
    // update metadata
    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    });
    // 2nd select: fetch user
    mockDb.select.mockReturnValueOnce(mockSelectChain([testUser]));

    const user = await linkOAuthAccount(TEST_USER_ID, 'github', testProviderUser);

    expect(user.id).toBe(TEST_USER_ID);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('should throw if provider identity is linked to a different user', async () => {
    const existingLink = {
      id: 'link-1',
      userId: OTHER_USER_ID, // different user!
      provider: 'github',
      providerUserId: testProviderUser.id,
    };

    mockDb.select.mockReturnValueOnce(mockSelectChain([existingLink]));

    await expect(linkOAuthAccount(TEST_USER_ID, 'github', testProviderUser)).rejects.toThrow(
      'already linked to another user',
    );
  });

  it('should throw if user already has a different account for the same provider', async () => {
    // 1st select: no existing link by (provider, providerUserId)
    mockDb.select.mockReturnValueOnce(mockSelectChain([]));
    // 2nd select: user exists
    mockDb.select.mockReturnValueOnce(mockSelectChain([testUser]));
    // 3rd select: user already has a github link (different provider account)
    mockDb.select.mockReturnValueOnce(
      mockSelectChain([{ id: 'link-2', userId: TEST_USER_ID, provider: 'github' }]),
    );

    await expect(linkOAuthAccount(TEST_USER_ID, 'github', testProviderUser)).rejects.toThrow(
      'already have a github account linked',
    );
  });

  it('should throw if authenticated user does not exist in database', async () => {
    // 1st select: no existing link
    mockDb.select.mockReturnValueOnce(mockSelectChain([]));
    // 2nd select: user NOT found
    mockDb.select.mockReturnValueOnce(mockSelectChain([]));

    await expect(linkOAuthAccount(TEST_USER_ID, 'github', testProviderUser)).rejects.toThrow(
      'Authenticated user not found',
    );
  });
});

describe('unlinkOAuthAccount', { timeout: 60_000 }, () => {
  let unlinkOAuthAccount: typeof import('../server/oauth.js').unlinkOAuthAccount;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../server/oauth.js');
    unlinkOAuthAccount = mod.unlinkOAuthAccount;
  });

  it('should delete the link when user has a password', async () => {
    const link = { id: 'link-1', userId: TEST_USER_ID, provider: 'github' };

    // 1st select: link exists
    mockDb.select.mockReturnValueOnce(mockSelectChain([link]));
    // 2nd select: user with password
    mockDb.select.mockReturnValueOnce(mockSelectChain([{ ...testUser, password: 'hashed' }]));
    // 3rd select (allLinks): only this one link
    mockDb.select.mockReturnValueOnce(mockSelectArrayChain([{ id: 'link-1' }]));

    mockDb.delete.mockReturnValue({
      where: vi.fn(),
    });

    await unlinkOAuthAccount(TEST_USER_ID, 'github');

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
  });

  it('should delete the link when user has other OAuth providers', async () => {
    const link = { id: 'link-1', userId: TEST_USER_ID, provider: 'github' };

    // 1st select: link exists
    mockDb.select.mockReturnValueOnce(mockSelectChain([link]));
    // 2nd select: user WITHOUT password
    mockDb.select.mockReturnValueOnce(mockSelectChain([{ ...testUser, password: null }]));
    // 3rd select (allLinks): TWO links, so removing one is safe
    mockDb.select.mockReturnValueOnce(mockSelectArrayChain([{ id: 'link-1' }, { id: 'link-2' }]));

    mockDb.delete.mockReturnValue({
      where: vi.fn(),
    });

    await unlinkOAuthAccount(TEST_USER_ID, 'github');

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
  });

  it('should throw if no link exists for the provider', async () => {
    // 1st select: no link found
    mockDb.select.mockReturnValueOnce(mockSelectChain([]));

    await expect(unlinkOAuthAccount(TEST_USER_ID, 'github')).rejects.toThrow(
      'No github account is linked',
    );
  });

  it('should refuse to unlink the last auth method (no password, single link)', async () => {
    const link = { id: 'link-1', userId: TEST_USER_ID, provider: 'github' };

    // 1st select: link exists
    mockDb.select.mockReturnValueOnce(mockSelectChain([link]));
    // 2nd select: user WITHOUT password
    mockDb.select.mockReturnValueOnce(mockSelectChain([{ ...testUser, password: null }]));
    // 3rd select (allLinks): only one link  -  removing it would lock user out
    mockDb.select.mockReturnValueOnce(mockSelectArrayChain([{ id: 'link-1' }]));

    await expect(unlinkOAuthAccount(TEST_USER_ID, 'github')).rejects.toThrow(
      'Cannot unlink your only sign-in method',
    );
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it('should throw if user is not found', async () => {
    const link = { id: 'link-1', userId: TEST_USER_ID, provider: 'github' };

    // 1st select: link exists
    mockDb.select.mockReturnValueOnce(mockSelectChain([link]));
    // 2nd select: user not found
    mockDb.select.mockReturnValueOnce(mockSelectChain([]));

    await expect(unlinkOAuthAccount(TEST_USER_ID, 'github')).rejects.toThrow('User not found');
  });
});

describe('getLinkedProviders', () => {
  let getLinkedProviders: typeof import('../server/oauth.js').getLinkedProviders;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../server/oauth.js');
    getLinkedProviders = mod.getLinkedProviders;
  });

  it('should return all linked providers for a user', async () => {
    const links = [
      { provider: 'github', providerEmail: 'alice@github.com', providerName: 'Alice GH' },
      { provider: 'google', providerEmail: 'alice@gmail.com', providerName: 'Alice Google' },
    ];

    mockDb.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => links),
      })),
    });

    const result = await getLinkedProviders(TEST_USER_ID);

    expect(result).toHaveLength(2);
    expect(result[0]?.provider).toBe('github');
    expect(result[1]?.provider).toBe('google');
  });

  it('should return empty array when no providers are linked', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => []),
      })),
    });

    const result = await getLinkedProviders(TEST_USER_ID);

    expect(result).toEqual([]);
  });

  it('should handle providers with null email and name', async () => {
    const links = [{ provider: 'vercel', providerEmail: null, providerName: null }];

    mockDb.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => links),
      })),
    });

    const result = await getLinkedProviders(TEST_USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0]?.providerEmail).toBeNull();
    expect(result[0]?.providerName).toBeNull();
  });
});
