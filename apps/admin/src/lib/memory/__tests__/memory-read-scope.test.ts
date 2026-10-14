/**
 * Caller site resolution for memory reads.
 * A user only receives sites they own or collaborate on.
 */

import type { Database } from '@revealui/db/client';
import { siteCollaborators, sites } from '@revealui/db/schema';
import { createTestDb, seedTestUser, type TestDb } from '@revealui/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveMemoryReadScope } from '../memory-read-scope';

describe('resolveMemoryReadScope', () => {
  let testDb: TestDb;
  let db: Database;

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.drizzle as unknown as Database;
    await seedTestUser(testDb.drizzle, {
      id: 'user-a',
      name: 'Tenant A',
      email: 'tenant-a@example.com',
      role: 'admin',
    });
    await seedTestUser(testDb.drizzle, {
      id: 'user-b',
      name: 'Tenant B',
      email: 'tenant-b@example.com',
      role: 'admin',
    });
    await seedTestUser(testDb.drizzle, {
      id: 'user-c',
      name: 'Collaborator',
      email: 'collaborator@example.com',
    });
    await testDb.drizzle.insert(sites).values([
      { id: 'tenant-a', name: 'Tenant A', slug: 'tenant-a', ownerId: 'user-a' },
      { id: 'tenant-b', name: 'Tenant B', slug: 'tenant-b', ownerId: 'user-b' },
      {
        id: 'tenant-a-deleted',
        name: 'Deleted',
        slug: 'tenant-a-deleted',
        ownerId: 'user-a',
        deletedAt: new Date(),
      },
    ]);
    await testDb.drizzle.insert(siteCollaborators).values({
      id: 'collab-1',
      siteId: 'tenant-a',
      userId: 'user-c',
    });
  }, 90_000);

  afterAll(async () => {
    await testDb?.close();
  });

  it('resolves the sites owned by tenant A and not tenant B', async () => {
    const scope = await resolveMemoryReadScope({
      userId: 'user-a',
      user: { id: 'user-a', role: 'admin', emailVerified: true },
      db,
    });

    expect(scope?.siteIds).toEqual(['tenant-a']);
  });

  it('includes a collaborated site and excludes a foreign site request', async () => {
    const own = await resolveMemoryReadScope({
      userId: 'user-c',
      user: { id: 'user-c', role: 'viewer' },
      db,
    });
    expect(own?.siteIds).toEqual(['tenant-a']);

    const foreign = await resolveMemoryReadScope({
      userId: 'user-a',
      user: { id: 'user-a', role: 'admin', emailVerified: true },
      requestedSiteId: 'tenant-b',
      db,
    });
    expect(foreign).toBeNull();
  });

  it('returns null when the caller has no site', async () => {
    const scope = await resolveMemoryReadScope({
      userId: 'user-missing',
      user: { id: 'user-missing', role: 'admin' },
      db,
    });
    expect(scope).toBeNull();
  });

  it('returns null for a fleet operator who does not name a site', async () => {
    const scope = await resolveMemoryReadScope({
      userId: 'user-a',
      user: {
        id: 'user-a',
        role: 'admin',
        emailVerified: true,
        _json: { roles: ['super-admin'] },
      },
      db,
    });
    expect(scope).toBeNull();
  });

  it('allows a fleet operator to name one live site', async () => {
    const scope = await resolveMemoryReadScope({
      userId: 'user-a',
      user: {
        id: 'user-a',
        role: 'admin',
        emailVerified: true,
        _json: { roles: ['super-admin'] },
      },
      requestedSiteId: 'tenant-b',
      db,
    });
    expect(scope?.siteIds).toEqual(['tenant-b']);
  });
});
