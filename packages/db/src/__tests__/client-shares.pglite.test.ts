import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countSites, getAllSites, getSiteById, getSiteContentActor } from '../queries/sites.js';
import * as schema from '../schema/index.js';
import { createTestDb, type TestDb } from '../testing/drizzle-test-db.js';

let testDb: TestDb;
const binding = (bookingId: string) => ({
  version: 1,
  kind: 'studio-consultation',
  bookingId,
  buyerUserId: 'buyer',
});
const scope = {
  access: { actor: { id: 'buyer', role: 'viewer' }, mode: 'hosted' as const },
  clientShareBuyerUserId: 'buyer',
};
beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.drizzle.insert(schema.users).values(
    ['operator', 'buyer', 'other'].map((id) => ({
      id,
      name: id,
      email: `${id}@example.test`,
      status: 'active',
      role: 'viewer',
      emailVerified: true,
      _json: id === 'operator' ? { roles: ['super-admin'] } : {},
    })),
  );
  await testDb.drizzle.insert(schema.sites).values(
    ['first', 'second', 'unpublished', 'ordinary'].map((id) => ({
      id,
      ownerId: 'operator',
      name: id,
      slug: id,
      visibility: 'private',
      status: id === 'unpublished' ? 'draft' : 'published',
      settings:
        id === 'ordinary'
          ? {}
          : {
              consultation: binding(`booking-${id}`),
              consultationLifecycle: {
                version: 1,
                revoked: false,
                domainPackPurchased: true,
                domainPack: 'entitled',
                amountRefunded: 0,
              },
            },
    })),
  );
  await testDb.drizzle.insert(schema.siteCollaborators).values(
    ['first', 'second', 'unpublished', 'ordinary'].flatMap((siteId) =>
      ['buyer', 'other'].map((userId) => ({
        id: `${siteId}-${userId}`,
        siteId,
        userId,
        role: 'viewer',
      })),
    ),
  );
});
afterAll(async () => {
  await testDb?.close();
});

describe('authenticated consultation delivery collection', () => {
  it('filters marker, publication, exact buyer, membership and counts before pagination', async () => {
    const db = testDb.drizzle;
    expect(await countSites(db, scope)).toBe(2);
    const first = await getAllSites(db, { ...scope, limit: 1 });
    const second = await getAllSites(db, { ...scope, limit: 1, offset: 1 });
    expect([...first, ...second].map((site) => site.id).sort()).toEqual(['first', 'second']);
    expect(await getSiteById(db, 'ordinary', scope)).toBeNull();
    expect(await getSiteById(db, 'unpublished', scope)).toBeNull();
    const otherScope = {
      access: { actor: await getSiteContentActor(db, 'other'), mode: 'hosted' as const },
      clientShareBuyerUserId: 'other',
    };
    expect(await getAllSites(db, otherScope)).toEqual([]);
    expect(await getSiteById(db, 'first', otherScope)).toBeNull();
    expect(await getAllSites(db, { ...scope, access: { actor: null, mode: 'hosted' } })).toEqual(
      [],
    );
  });

  it('uses current trusted operator and verified active buyer records on every read', async () => {
    for (const id of ['operator', 'buyer']) {
      await testDb.drizzle
        .update(schema.users)
        .set({ emailVerified: false })
        .where(eq(schema.users.id, id));
      expect(await countSites(testDb.drizzle, scope)).toBe(0);
      expect(await getSiteById(testDb.drizzle, 'first', scope)).toBeNull();
      await testDb.drizzle
        .update(schema.users)
        .set({ emailVerified: true, status: 'suspended' })
        .where(eq(schema.users.id, id));
      expect(await getAllSites(testDb.drizzle, scope)).toEqual([]);
      await testDb.drizzle
        .update(schema.users)
        .set({ status: 'active' })
        .where(eq(schema.users.id, id));
    }
    await testDb.drizzle
      .update(schema.users)
      .set({ _json: { roles: ['admin'] } })
      .where(eq(schema.users.id, 'operator'));
    expect(await countSites(testDb.drizzle, scope)).toBe(0);
    await testDb.drizzle
      .update(schema.users)
      .set({ _json: { roles: ['super-admin'] } })
      .where(eq(schema.users.id, 'operator'));
    expect(await countSites(testDb.drizzle, scope)).toBe(2);
  });

  it('revokes lists, totals and direct reads when membership or publication changes', async () => {
    await testDb.drizzle
      .delete(schema.siteCollaborators)
      .where(eq(schema.siteCollaborators.id, 'first-buyer'));
    expect(await getSiteById(testDb.drizzle, 'first', scope)).toBeNull();
    expect(await countSites(testDb.drizzle, scope)).toBe(1);
    await testDb.drizzle
      .update(schema.sites)
      .set({ status: 'archived' })
      .where(eq(schema.sites.id, 'second'));
    expect(await getAllSites(testDb.drizzle, scope)).toEqual([]);
    expect(await countSites(testDb.drizzle, scope)).toBe(0);
    expect(await getSiteById(testDb.drizzle, 'second', scope)).toBeNull();
  });
});
