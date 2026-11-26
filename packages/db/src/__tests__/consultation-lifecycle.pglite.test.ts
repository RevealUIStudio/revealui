import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countPages, getPageById, getPages } from '../queries/pages.js';
import {
  actorCanReadSite,
  countSites,
  getSiteById,
  updateConsultationLifecycle,
} from '../queries/sites.js';
import * as schema from '../schema/index.js';
import { createTestDb, type TestDb } from '../testing/drizzle-test-db.js';

let testDb: TestDb;
type Mutation = Parameters<typeof updateConsultationLifecycle>[3];
type WithoutIdentity<T> = T extends unknown ? Omit<T, 'bookingId' | 'buyerUserId'> : never;
const buyerAccess = {
  actor: { id: 'buyer', role: 'viewer', emailVerified: true },
  mode: 'hosted' as const,
};
const buyerScope = { access: buyerAccess, clientShareBuyerUserId: 'buyer' };
beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.drizzle.insert(schema.users).values(
    ['operator', 'buyer', 'other'].map((id) => ({
      id,
      email: `${id}@example.test`,
      name: id,
      role: 'viewer',
      status: 'active',
      emailVerified: true,
      _json: id === 'operator' ? { roles: ['super-admin'] } : {},
    })),
  );
});
afterAll(async () => {
  await testDb?.close();
});

async function createDelivery(id: string) {
  await testDb.drizzle.insert(schema.sites).values({
    id,
    name: id,
    slug: id,
    ownerId: 'operator',
    visibility: 'private',
    status: 'published',
    settings: {
      consultation: {
        version: 1,
        kind: 'studio-consultation',
        bookingId: id,
        buyerUserId: 'buyer',
      },
    },
  });
  await testDb.drizzle.insert(schema.siteCollaborators).values(
    ['buyer', 'other'].map((userId) => ({
      id: `${id}-${userId}`,
      siteId: id,
      userId,
      role: 'editor',
    })),
  );
  await testDb.drizzle.insert(schema.pages).values(
    ['session-notes', 'recommended-next-step', 'dns'].map((slug) => ({
      id: `${id}-${slug}`,
      siteId: id,
      title: slug,
      slug,
      path: `/${slug}`,
      status: 'published',
      blocks: [],
    })),
  );
  return (input: WithoutIdentity<Mutation>) =>
    updateConsultationLifecycle(testDb.drizzle, id, 'operator', {
      bookingId: id,
      buyerUserId: 'buyer',
      ...input,
    });
}
const eligible = { action: 'observe' as const, revoked: false, domainPackEntitled: true };
const refund = (amountRefunded: number, full = false) => ({
  chargeId: 'ch_delivery',
  amountRefunded,
  full,
});

describe('persisted consultation lifecycle authorization', () => {
  it('denies unobserved bindings, other collaborators and buyer drafts through ordinary content reads', async () => {
    const mutate = await createDelivery('initial');
    expect(await getSiteById(testDb.drizzle, 'initial', buyerScope)).toBeNull();
    expect(await actorCanReadSite(testDb.drizzle, buyerAccess.actor, 'initial', 'hosted')).toBe(
      false,
    );
    expect(await getPages(testDb.drizzle, { siteId: 'initial', access: buyerAccess })).toEqual([]);
    await mutate(eligible);
    expect(await actorCanReadSite(testDb.drizzle, buyerAccess.actor, 'initial', 'hosted')).toBe(
      true,
    );
    expect(await getPages(testDb.drizzle, { siteId: 'initial', access: buyerAccess })).toHaveLength(
      3,
    );
    expect(
      await actorCanReadSite(testDb.drizzle, { id: 'other', role: 'editor' }, 'initial', 'hosted'),
    ).toBe(false);
    await testDb.drizzle
      .update(schema.pages)
      .set({ status: 'draft' })
      .where(eq(schema.pages.id, 'initial-session-notes'));
    expect(await getPageById(testDb.drizzle, 'initial-session-notes', buyerAccess)).toBeNull();
  });

  it('keeps notes available while partial refunds deny optional pages despite stale publication', async () => {
    const mutate = await createDelivery('partial');
    await mutate(eligible);
    await mutate({ ...eligible, refund: refund(50) });
    await mutate(eligible);
    await testDb.drizzle
      .update(schema.sites)
      .set({ status: 'published' })
      .where(eq(schema.sites.id, 'partial'));
    await testDb.drizzle
      .update(schema.pages)
      .set({ status: 'published' })
      .where(eq(schema.pages.id, 'partial-dns'));
    expect(await countPages(testDb.drizzle, { siteId: 'partial', access: buyerAccess })).toBe(2);
    expect(await getPageById(testDb.drizzle, 'partial-dns', buyerAccess)).toBeNull();
    expect(await getPageById(testDb.drizzle, 'partial-session-notes', buyerAccess)).not.toBeNull();
    await mutate({
      action: 'resolve-domain-pack',
      chargeId: 'ch_delivery',
      amountRefunded: 50,
      decision: 'retained',
    });
    await mutate({ ...eligible, refund: refund(50) });
    expect(await countPages(testDb.drizzle, { siteId: 'partial', access: buyerAccess })).toBe(3);
    await mutate({ ...eligible, refund: refund(100) });
    expect(
      await mutate({
        action: 'resolve-domain-pack',
        chargeId: 'ch_delivery',
        amountRefunded: 50,
        decision: 'retained',
      }),
    ).toBeNull();
    expect(await getPageById(testDb.drizzle, 'partial-dns', buyerAccess)).toBeNull();
    expect(
      await mutate({ ...eligible, refund: { ...refund(200), chargeId: 'ch_wrong' } }),
    ).toBeNull();
  });

  it('makes full and manual revocation dominate older observations, grants and publication', async () => {
    for (const id of ['full', 'manual']) {
      const mutate = await createDelivery(id);
      await mutate(eligible);
      await mutate(
        id === 'full' ? { ...eligible, refund: refund(500, true) } : { action: 'revoke' },
      );
      const stale = await mutate(eligible);
      expect(stale?.settings).toMatchObject({
        consultationLifecycle: { revoked: true, domainPack: 'revoked' },
      });
      await testDb.drizzle
        .update(schema.sites)
        .set({ status: 'published' })
        .where(eq(schema.sites.id, id));
      await testDb.drizzle
        .update(schema.siteCollaborators)
        .set({ role: 'viewer' })
        .where(eq(schema.siteCollaborators.id, `${id}-buyer`));
      expect(await getSiteById(testDb.drizzle, id, buyerScope)).toBeNull();
      expect(await getPages(testDb.drizzle, { siteId: id, access: buyerAccess })).toEqual([]);
      expect(await actorCanReadSite(testDb.drizzle, buyerAccess.actor, id, 'hosted')).toBe(false);
    }
    expect(await countSites(testDb.drizzle, { ...buyerScope, consultationBookingId: 'full' })).toBe(
      0,
    );
  });

  it('does not let an older retained decision override same-amount revocation', async () => {
    const mutate = await createDelivery('decision');
    await mutate({ ...eligible, refund: refund(50) });
    await mutate({
      action: 'resolve-domain-pack',
      chargeId: 'ch_delivery',
      amountRefunded: 50,
      decision: 'retained',
    });
    await mutate({
      action: 'resolve-domain-pack',
      chargeId: 'ch_delivery',
      amountRefunded: 50,
      decision: 'revoked',
    });
    expect(
      await mutate({
        action: 'resolve-domain-pack',
        chargeId: 'ch_delivery',
        amountRefunded: 50,
        decision: 'retained',
      }),
    ).toBeNull();
    await mutate({ ...eligible, refund: refund(50) });
    expect(await getPageById(testDb.drizzle, 'decision-dns', buyerAccess)).toBeNull();
    await mutate({ ...eligible, refund: refund(100) });
    expect(
      await mutate({
        action: 'resolve-domain-pack',
        chargeId: 'ch_delivery',
        amountRefunded: 100,
        decision: 'retained',
      }),
    ).not.toBeNull();
  });

  it('does not restore lost base entitlement through stale observations or refund resolution', async () => {
    const mutate = await createDelivery('base');
    await mutate(eligible);
    await mutate({ ...eligible, domainPackEntitled: false });
    await mutate(eligible);
    await mutate({ ...eligible, refund: refund(50) });
    expect(
      await mutate({
        action: 'resolve-domain-pack',
        chargeId: 'ch_delivery',
        amountRefunded: 50,
        decision: 'retained',
      }),
    ).toBeNull();
    expect(await getPageById(testDb.drizzle, 'base-dns', buyerAccess)).toBeNull();
    expect(await getPageById(testDb.drizzle, 'base-session-notes', buyerAccess)).not.toBeNull();
  });
});
