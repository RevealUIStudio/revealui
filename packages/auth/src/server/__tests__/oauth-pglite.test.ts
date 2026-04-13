/**
 * OAuth Integration Tests (PGlite)
 *
 * Tests the full OAuth user upsert and session creation flow
 * against a real in-memory PostgreSQL database. Provider API calls
 * (token exchange, user fetch) are mocked  -  DB operations are real.
 *
 * Covers:
 * - New user creation via OAuth
 * - Returning user metadata refresh
 * - Account linking with consent
 * - Account conflict without consent
 * - Session rotation (fixation prevention)
 * - Account linking and unlinking
 */

import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  seedTestUser,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';

// ─── Mocks ──────────────────────────────────────────────────────────────────

let testDb: TestDb;

vi.mock('@revealui/db/client', () => ({
  getClient: () => testDb.drizzle,
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import { oauthAccounts, sessions, users } from '@revealui/db/schema';
import { OAuthAccountConflictError } from '../errors.js';
import {
  getLinkedProviders,
  linkOAuthAccount,
  type ProviderUser,
  unlinkOAuthAccount,
  upsertOAuthUser,
} from '../oauth.js';
import { createSession, rotateSession } from '../session.js';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
  process.env.REVEALUI_SECRET = 'test-secret-for-oauth-tests';
  testDb = await createTestDb();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

afterEach(async () => {
  const { sql } = await import('drizzle-orm');
  await testDb.drizzle.execute(sql.raw('DELETE FROM "sessions"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "oauth_accounts"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "users"'));
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockProviderUser(overrides?: Partial<ProviderUser>): ProviderUser {
  return {
    id: `gh_${crypto.randomUUID().slice(0, 8)}`,
    email: `user-${Date.now()}@example.com`,
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.png',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('upsertOAuthUser  -  PGlite', () => {
  it('creates a new user and oauth_accounts link', async () => {
    const providerUser = mockProviderUser({ email: 'new-oauth@example.com' });

    const user = await upsertOAuthUser('github', providerUser);

    expect(user.email).toBe('new-oauth@example.com');
    expect(user.name).toBe('Test User');
    expect(user.role).toBe('viewer');
    expect(user.status).toBe('active');
    expect(user.password).toBeNull();

    // Verify oauth_accounts row
    const links = await testDb.drizzle
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, user.id));
    expect(links).toHaveLength(1);
    expect(links[0].provider).toBe('github');
    expect(links[0].providerUserId).toBe(providerUser.id);
    expect(links[0].providerEmail).toBe('new-oauth@example.com');
  });

  it('refreshes metadata for returning user', async () => {
    const providerUser = mockProviderUser({ email: 'returning@example.com', name: 'Original' });

    // First sign-in
    const user = await upsertOAuthUser('github', providerUser);

    // Second sign-in with updated name
    const updatedProviderUser = { ...providerUser, name: 'Updated Name' };
    const returnedUser = await upsertOAuthUser('github', updatedProviderUser);

    expect(returnedUser.id).toBe(user.id); // Same user

    // Metadata should be updated in oauth_accounts
    const links = await testDb.drizzle
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, user.id));
    expect(links).toHaveLength(1);
    expect(links[0].providerName).toBe('Updated Name');
  });

  it('throws OAuthAccountConflictError when email matches without consent', async () => {
    // Pre-create a user with matching email (e.g. signed up with password)
    await seedTestUser(testDb.drizzle, {
      id: 'existing-user',
      email: 'conflict@example.com',
    });

    const providerUser = mockProviderUser({ email: 'conflict@example.com' });

    await expect(upsertOAuthUser('github', providerUser)).rejects.toThrow(
      OAuthAccountConflictError,
    );
  });

  it('links to existing user when consent is given', async () => {
    await seedTestUser(testDb.drizzle, {
      id: 'consent-user',
      email: 'consent@example.com',
    });

    const providerUser = mockProviderUser({ email: 'consent@example.com' });

    const user = await upsertOAuthUser('github', providerUser, { linkConsent: true });

    expect(user.id).toBe('consent-user'); // Linked to existing user

    // Should have an oauth_accounts link
    const links = await testDb.drizzle
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, 'consent-user'));
    expect(links).toHaveLength(1);
    expect(links[0].provider).toBe('github');
  });

  it('creates user without email (no conflict check)', async () => {
    const providerUser = mockProviderUser({ email: null });

    const user = await upsertOAuthUser('github', providerUser);

    expect(user.email).toBeNull();
    expect(user.name).toBe('Test User');

    // Should still have oauth link
    const links = await testDb.drizzle
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, user.id));
    expect(links).toHaveLength(1);
  });
});

describe('session management  -  PGlite', () => {
  it('createSession inserts a session row with hashed token', async () => {
    await seedTestUser(testDb.drizzle, { id: 'sess-user-1' });

    const result = await createSession('sess-user-1', {
      persistent: true,
      userAgent: 'test-agent/1.0',
      ipAddress: '127.0.0.1',
    });

    expect(result.token).toBeDefined();
    expect(result.token.length).toBeGreaterThan(20);
    expect(result.session.userId).toBe('sess-user-1');
    expect(result.session.persistent).toBe(true);
    expect(result.session.userAgent).toBe('test-agent/1.0');

    // Token should be stored as hash, not plaintext
    const dbSessions = await testDb.drizzle
      .select()
      .from(sessions)
      .where(eq(sessions.userId, 'sess-user-1'));
    expect(dbSessions).toHaveLength(1);
    expect(dbSessions[0].tokenHash).not.toBe(result.token);
    expect(dbSessions[0].tokenHash.length).toBeGreaterThan(0);

    // Expiration should be ~7 days out for persistent
    const expiresIn = dbSessions[0].expiresAt.getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(6 * 24 * 60 * 60 * 1000); // > 6 days
    expect(expiresIn).toBeLessThan(8 * 24 * 60 * 60 * 1000); // < 8 days
  });

  it('rotateSession deletes old sessions and creates new one', async () => {
    await seedTestUser(testDb.drizzle, { id: 'rotate-user' });

    // Create initial sessions
    await createSession('rotate-user', { persistent: false });
    await createSession('rotate-user', { persistent: true });

    const before = await testDb.drizzle
      .select()
      .from(sessions)
      .where(eq(sessions.userId, 'rotate-user'));
    expect(before).toHaveLength(2);

    // Rotate  -  should delete all old sessions and create one new
    const rotated = await rotateSession('rotate-user', { persistent: true });

    const after = await testDb.drizzle
      .select()
      .from(sessions)
      .where(eq(sessions.userId, 'rotate-user'));

    // Should have exactly 1 session (the new one)
    expect(after).toHaveLength(1);
    expect(after[0].tokenHash).not.toBe(before[0].tokenHash);
    expect(rotated.token).toBeDefined();
    expect(rotated.session.persistent).toBe(true);
  });
});

describe('account linking  -  PGlite', () => {
  it('links multiple providers to same user', async () => {
    await seedTestUser(testDb.drizzle, { id: 'multi-link-user', email: 'multi@example.com' });

    const ghUser = mockProviderUser({ id: 'gh-123', email: 'multi@example.com' });
    await linkOAuthAccount('multi-link-user', 'github', ghUser);

    const googleUser = mockProviderUser({ id: 'google-456', email: 'multi@example.com' });
    await linkOAuthAccount('multi-link-user', 'google', googleUser);

    const providers = await getLinkedProviders('multi-link-user');
    expect(providers).toHaveLength(2);
    expect(providers.map((p) => p.provider).sort()).toEqual(['github', 'google']);
  });

  it('unlinkOAuthAccount removes the link', async () => {
    await seedTestUser(testDb.drizzle, { id: 'unlink-user', email: 'unlink@example.com' });

    // Set a password so unlink is allowed
    await testDb.drizzle
      .update(users)
      .set({ password: 'hashed-pw' })
      .where(eq(users.id, 'unlink-user'));

    const ghUser = mockProviderUser({ id: 'gh-unlink' });
    await linkOAuthAccount('unlink-user', 'github', ghUser);

    const beforeProviders = await getLinkedProviders('unlink-user');
    expect(beforeProviders).toHaveLength(1);

    await unlinkOAuthAccount('unlink-user', 'github');

    const afterProviders = await getLinkedProviders('unlink-user');
    expect(afterProviders).toHaveLength(0);
  });

  it('refuses to unlink sole auth method (no password)', async () => {
    const providerUser = mockProviderUser({ email: 'sole-auth@example.com' });
    const user = await upsertOAuthUser('github', providerUser);

    // User has no password, GitHub is only auth method
    await expect(unlinkOAuthAccount(user.id, 'github')).rejects.toThrow();
  });
});
