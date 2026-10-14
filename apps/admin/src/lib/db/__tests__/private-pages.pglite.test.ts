import type { RevealRequest } from '@revealui/core/types';
import type { Database } from '@revealui/db/client';
import { updateConsultationLifecycle } from '@revealui/db/queries/sites';
import * as schema from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@revealui/db/client', async (original) => ({
  ...(await original<typeof import('@revealui/db/client')>()),
  getRestClient: () => state.db,
}));

import { createTypedCollectionStorage } from '../typedCollectionStorage';

let testDb: TestDb;
const collection = { slug: 'pages', fields: [] };
function req(id: string): RevealRequest {
  return {
    user: { id, email: `${id}@example.test`, role: 'admin', roles: ['super-admin'] },
  } as RevealRequest;
}
beforeAll(async () => {
  testDb = await createTestDb();
  state.db = testDb.drizzle;
  vi.stubEnv('POSTGRES_URL', 'postgresql://synthetic');
  vi.stubEnv('REVEALUI_DEPLOYMENT_MODE', 'hosted');
  await testDb.drizzle.insert(schema.users).values(
    ['owner', 'viewer', 'editor', 'other'].map((id) => ({
      id,
      name: id,
      email: `${id}@example.test`,
      status: 'active',
      role: 'viewer',
    })),
  );
  await testDb.drizzle.insert(schema.sites).values({
    id: 'private',
    ownerId: 'owner',
    name: 'Private',
    slug: 'private',
    visibility: 'private',
    status: 'published',
  });
  await testDb.drizzle
    .insert(schema.siteCollaborators)
    .values(
      ['viewer', 'editor'].map((role) => ({ id: role, siteId: 'private', userId: role, role })),
    );
  await testDb.drizzle.insert(schema.pages).values(
    ['published', 'draft'].map((status) => ({
      id: status,
      siteId: 'private',
      title: status,
      slug: status,
      path: `/${status}`,
      status,
    })),
  );
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await testDb.close();
});

describe('canonical typed page bridge authorization', () => {
  it.each([undefined, 'other'])(
    'denies private lists and IDs for %s despite forged shell roles',
    async (actor) => {
      const storage = createTypedCollectionStorage();
      const request = actor ? req(actor) : undefined;
      expect(await storage?.findByID?.(collection, { id: 'published', req: request })).toBeNull();
      const list = await storage?.find?.(collection, {
        req: request,
        where: { siteId: { equals: 'private' } },
      });
      expect(list?.docs).toEqual([]);
      expect(list?.totalDocs).toBe(0);
    },
  );
  it('scopes viewer lists, direct IDs and writes to their actual membership', async () => {
    const storage = createTypedCollectionStorage();
    expect(
      await storage?.findByID?.(collection, { id: 'published', req: req('viewer') }),
    ).toMatchObject({ id: 'published' });
    expect(await storage?.findByID?.(collection, { id: 'draft', req: req('viewer') })).toBeNull();
    const list = await storage?.find?.(collection, {
      req: req('viewer'),
      where: { siteId: { equals: 'private' } },
    });
    expect(list?.docs.map((page) => page.id)).toEqual(['published']);
    expect(list?.totalDocs).toBe(1);
    await expect(
      storage?.update?.(collection, {
        id: 'published',
        data: { title: 'forbidden' },
        req: req('viewer'),
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      storage?.delete?.(collection, { id: 'published', req: req('other') }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it.each(['owner', 'editor'])('lets %s read drafts through the same bridge', async (actor) => {
    const storage = createTypedCollectionStorage();
    expect(await storage?.findByID?.(collection, { id: 'draft', req: req(actor) })).toMatchObject({
      id: 'draft',
    });
    expect(
      (
        await storage?.find?.(collection, {
          req: req(actor),
          where: { siteId: { equals: 'private' } },
        })
      )?.totalDocs,
    ).toBe(2);
  });
  it('denies anonymous drafts and current unpublished or deleted public parents through canonical SQL', async () => {
    for (const status of ['published', 'draft', 'deleted']) {
      const siteId = `public-${status}`;
      await testDb.drizzle.insert(schema.sites).values({
        id: siteId,
        name: siteId,
        slug: siteId,
        ownerId: 'owner',
        visibility: 'public',
        status: status === 'draft' ? 'draft' : 'published',
        deletedAt: status === 'deleted' ? new Date() : null,
      });
      await testDb.drizzle.insert(schema.pages).values({
        id: `${siteId}-page`,
        title: siteId,
        slug: 'page',
        path: '/',
        siteId,
        status: 'published',
      });
    }
    await testDb.drizzle.insert(schema.pages).values({
      id: 'public-page-draft',
      title: 'draft',
      slug: 'draft',
      path: '/draft',
      siteId: 'public-published',
      status: 'draft',
    });
    const storage = createTypedCollectionStorage();
    expect(await storage?.findByID?.(collection, { id: 'public-published-page' })).toMatchObject({
      id: 'public-published-page',
    });
    for (const id of ['public-page-draft', 'public-draft-page', 'public-deleted-page']) {
      expect(await storage?.findByID?.(collection, { id })).toBeNull();
    }
    const list = await storage?.find?.(collection, {
      where: { siteId: { equals: 'public-published' } },
    });
    expect(list?.docs.map((page) => page.id)).toEqual(['public-published-page']);
    expect(list?.totalDocs).toBe(1);
  });
  it('applies current consultation page entitlement to direct IDs as well as lists', async () => {
    await testDb.drizzle.insert(schema.users).values({
      id: 'studio-operator',
      name: 'Studio',
      email: 'operator@customer.com',
      status: 'active',
      role: 'viewer',
      emailVerified: true,
      _json: { roles: ['super-admin'] },
    });
    await testDb.drizzle.update(schema.users).set({ emailVerified: true });
    await testDb.drizzle.insert(schema.sites).values({
      id: 'consultation',
      ownerId: 'studio-operator',
      name: 'Consultation',
      slug: 'consultation',
      visibility: 'private',
      status: 'published',
      settings: {
        consultation: {
          version: 1,
          kind: 'studio-consultation',
          bookingId: 'booking',
          buyerUserId: 'viewer',
        },
        consultationLifecycle: {
          version: 1,
          revoked: false,
          domainPackPurchased: true,
          domainPack: 'review_required',
          amountRefunded: 50,
          chargeId: 'ch_review',
        },
      },
    });
    await testDb.drizzle.insert(schema.siteCollaborators).values({
      id: 'consultation-viewer',
      siteId: 'consultation',
      userId: 'viewer',
      role: 'viewer',
    });
    await testDb.drizzle.insert(schema.pages).values(
      ['session-notes', 'domain-dns'].map((slug) => ({
        id: `consultation-${slug}`,
        siteId: 'consultation',
        title: slug,
        slug,
        path: `/${slug}`,
        status: 'published',
      })),
    );
    const storage = createTypedCollectionStorage();
    expect(
      await storage?.findByID?.(collection, {
        id: 'consultation-session-notes',
        req: req('viewer'),
      }),
    ).toMatchObject({ id: 'consultation-session-notes' });
    expect(
      await storage?.findByID?.(collection, { id: 'consultation-domain-dns', req: req('viewer') }),
    ).toBeNull();
    const list = await storage?.find?.(collection, {
      req: req('viewer'),
      where: { siteId: { equals: 'consultation' } },
    });
    expect(list?.docs.map((page) => page.id)).toEqual(['consultation-session-notes']);
    expect(list?.totalDocs).toBe(1);
    const lifecycleDb = testDb.drizzle as unknown as Database;
    await updateConsultationLifecycle(lifecycleDb, 'consultation', 'studio-operator', {
      action: 'resolve-domain-pack',
      bookingId: 'booking',
      buyerUserId: 'viewer',
      chargeId: 'ch_review',
      amountRefunded: 50,
      decision: 'retained',
    });
    expect(
      await storage?.findByID?.(collection, { id: 'consultation-domain-dns', req: req('viewer') }),
    ).toMatchObject({ id: 'consultation-domain-dns' });
    await updateConsultationLifecycle(lifecycleDb, 'consultation', 'studio-operator', {
      action: 'revoke',
      bookingId: 'booking',
      buyerUserId: 'viewer',
    });
    expect(
      await storage?.findByID?.(collection, {
        id: 'consultation-session-notes',
        req: req('viewer'),
      }),
    ).toBeNull();
  });
});
