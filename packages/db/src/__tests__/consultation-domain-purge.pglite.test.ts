import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../client/index.js';
import {
  purgeSite,
  removeConsultationDomain,
  reserveConsultationDomain,
  SiteDomainCleanupRequiredError,
  setConsultationDomain,
} from '../queries/sites.js';
import {
  anonymizeUser,
  assertUserDomainCleanupComplete,
  deleteUser,
  purgeUser,
  updateUser,
  withUserDomainCleanupAdmission,
} from '../queries/users.js';
import * as schema from '../schema/index.js';
import { createTestDb, type TestDb } from '../testing/drizzle-test-db.js';

let testDb: TestDb;
let db: Database;
beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.drizzle as unknown as Database;
});
afterAll(async () => {
  await testDb?.close();
});

async function delivery(id: string, verified: boolean) {
  const ownerId = `${id}-operator`;
  const buyerUserId = `${id}-buyer`;
  await testDb.drizzle.insert(schema.users).values([
    {
      id: ownerId,
      name: ownerId,
      email: `${ownerId}@customer.com`,
      status: 'active',
      emailVerified: true,
      _json: { roles: ['super-admin'] },
    },
    {
      id: buyerUserId,
      name: buyerUserId,
      email: `${buyerUserId}@customer.com`,
      status: 'active',
      emailVerified: true,
    },
  ]);
  await testDb.drizzle.insert(schema.sites).values({
    id,
    ownerId,
    name: id,
    slug: id,
    visibility: 'private',
    settings: {
      consultation: { version: 1, kind: 'studio-consultation', bookingId: id, buyerUserId },
      consultationLifecycle: {
        version: 1,
        revoked: false,
        domainPackPurchased: true,
        domainPack: 'entitled',
        amountRefunded: 0,
      },
    },
  });
  const domain = {
    hostname: `${id}.customer.com`,
    provider: 'vercel' as const,
    projectId: 'prj_studio',
  };
  await reserveConsultationDomain(db, id, ownerId, domain);
  if (verified)
    await setConsultationDomain(db, id, ownerId, {
      ...domain,
      verifiedAt: new Date().toISOString(),
    });
  return { ownerId, domain };
}

describe('durable consultation domain deletion prerequisite', () => {
  it.each(['pending', 'verified'])(
    'preserves %s resources through direct deletion, owner cascade and maintained purge until detach',
    async (state) => {
      const id = `purge-${state}`;
      const { ownerId, domain } = await delivery(id, state === 'verified');
      const databaseConstraint = {
        cause: { code: '23514', constraint: 'sites_consultation_domain_cleanup_required' },
      };
      const rawDeletionError = await testDb.drizzle
        .delete(schema.sites)
        .where(eq(schema.sites.id, id))
        .catch((error: unknown) => error);
      expect(rawDeletionError).toMatchObject(databaseConstraint);
      expect(SiteDomainCleanupRequiredError.fromDatabase(rawDeletionError)).toMatchObject({
        statusCode: 409,
        code: 'SITE_DOMAIN_CLEANUP_REQUIRED',
      });
      await expect(
        testDb.drizzle.delete(schema.users).where(eq(schema.users.id, ownerId)),
      ).rejects.toMatchObject(databaseConstraint);
      for (const change of [
        { status: 'deleted' },
        { deletedAt: new Date() },
        { anonymizedAt: new Date() },
      ])
        await expect(
          testDb.drizzle.update(schema.users).set(change).where(eq(schema.users.id, ownerId)),
        ).rejects.toMatchObject(databaseConstraint);
      for (const operation of [
        () => purgeSite(db, id),
        () => purgeUser(db, ownerId),
        () => deleteUser(db, ownerId),
        () => anonymizeUser(db, ownerId),
        () => assertUserDomainCleanupComplete(db, ownerId),
        () => updateUser(db, ownerId, { status: 'deleted' }),
        () => updateUser(db, ownerId, { deletedAt: new Date() }),
        () => updateUser(db, ownerId, { anonymizedAt: new Date() }),
      ]) {
        const result = operation();
        await expect(result).rejects.toBeInstanceOf(SiteDomainCleanupRequiredError);
        await expect(result).rejects.toMatchObject({
          statusCode: 409,
          code: 'SITE_DOMAIN_CLEANUP_REQUIRED',
        });
      }
      let erasureStarted = false;
      await expect(
        withUserDomainCleanupAdmission(db, ownerId, async () => {
          erasureStarted = true;
        }),
      ).rejects.toBeInstanceOf(SiteDomainCleanupRequiredError);
      expect(erasureStarted).toBe(false);
      expect(
        (await testDb.drizzle.select().from(schema.users).where(eq(schema.users.id, ownerId)))
          .length,
      ).toBe(1);
      expect(
        (await testDb.drizzle.select().from(schema.users).where(eq(schema.users.id, ownerId)))[0],
      ).toMatchObject({
        status: 'active',
        deletedAt: null,
        anonymizedAt: null,
        emailVerified: true,
      });
      expect(
        (await testDb.drizzle.select().from(schema.sites).where(eq(schema.sites.id, id)))[0]
          ?.settings,
      ).toHaveProperty(state === 'verified' ? 'consultationDomain' : 'consultationDomainPending');
      // The provider-backed route removes these keys only after provider success.
      await removeConsultationDomain(db, id, ownerId, domain.hostname);
      await expect(
        withUserDomainCleanupAdmission(db, ownerId, async () => 'erasure admitted'),
      ).resolves.toBe('erasure admitted');
      await expect(anonymizeUser(db, ownerId)).resolves.toMatchObject({
        status: 'deleted',
        email: null,
      });
      await expect(purgeUser(db, ownerId)).resolves.toBeUndefined();
      expect(
        await testDb.drizzle.select().from(schema.sites).where(eq(schema.sites.id, id)),
      ).toEqual([]);
    },
  );

  it('keeps ordinary user and site permanent cleanup available', async () => {
    await testDb.drizzle
      .insert(schema.users)
      .values({ id: 'ordinary-owner', name: 'Ordinary', status: 'active' });
    await testDb.drizzle.insert(schema.sites).values({
      id: 'ordinary-site',
      name: 'Ordinary',
      slug: 'ordinary-site',
      ownerId: 'ordinary-owner',
    });
    await expect(purgeSite(db, 'ordinary-site')).resolves.toBeUndefined();
    await expect(deleteUser(db, 'ordinary-owner')).resolves.toBeUndefined();
    await expect(anonymizeUser(db, 'ordinary-owner')).resolves.toMatchObject({
      email: null,
      status: 'deleted',
    });
    await expect(purgeUser(db, 'ordinary-owner')).resolves.toBeUndefined();
    await expect(purgeSite(db, 'missing-site')).resolves.toBeUndefined();
    await expect(purgeUser(db, 'missing-user')).resolves.toBeUndefined();
  });

  it('admits account erasure while another owner retains a pending hostname', async () => {
    const { ownerId: unrelatedOwnerId } = await delivery('unrelated-pending', false);
    const userId = 'unrelated-erasure';
    await testDb.drizzle.insert(schema.users).values({
      id: userId,
      name: 'Unrelated account',
      status: 'active',
    });
    await expect(assertUserDomainCleanupComplete(db, unrelatedOwnerId)).rejects.toBeInstanceOf(
      SiteDomainCleanupRequiredError,
    );
    await expect(assertUserDomainCleanupComplete(db, userId)).resolves.toBeUndefined();
    let erasureAdmitted = false;
    await expect(
      withUserDomainCleanupAdmission(db, userId, async () => {
        erasureAdmitted = true;
        return 'admitted';
      }),
    ).resolves.toBe('admitted');
    expect(erasureAdmitted).toBe(true);
    await expect(anonymizeUser(db, userId)).resolves.toMatchObject({ status: 'deleted' });
    await expect(purgeUser(db, userId)).resolves.toBeUndefined();
    await expect(purgeUser(db, 'missing-unrelated-user')).resolves.toBeUndefined();
    await expect(purgeSite(db, 'missing-unrelated-site')).resolves.toBeUndefined();
    expect(
      await testDb.drizzle.select().from(schema.users).where(eq(schema.users.id, userId)),
    ).toEqual([]);
    expect(
      (
        await testDb.drizzle
          .select()
          .from(schema.sites)
          .where(eq(schema.sites.id, 'unrelated-pending'))
      )[0]?.settings,
    ).toHaveProperty('consultationDomainPending');
  });
});
