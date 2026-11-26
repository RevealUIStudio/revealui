import type { DatabaseClient } from '@revealui/db/client';
import { createMedia, getMediaById } from '@revealui/db/queries/media';
import { createPage, getPageById } from '@revealui/db/queries/pages';
import { createPost, getPostById } from '@revealui/db/queries/posts';
import {
  createSite,
  deleteSite,
  getSiteById,
  getSiteContentActor,
  removeConsultationDomain,
  reserveConsultationDomain,
  SiteDomainCleanupRequiredError,
  SiteMutationProtectedError,
  setConsultationDomain,
  updateConsultationLifecycle,
  updateSite,
} from '@revealui/db/queries/sites';
import * as schema from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { OpenAPIHono } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import batchRoutes from '../content/batch.js';
import type { ContentVariables } from '../content/index.js';
import mediaRoutes from '../content/media.js';
import pageRoutes from '../content/pages.js';
import postRoutes from '../content/posts.js';
import siteRoutes from '../content/sites.js';

let testDb: TestDb;
const managedKeys = [
  'consultation',
  'consultationLifecycle',
  'consultationDomain',
  'consultationDomainPending',
];
const domain = {
  hostname: 'client.customer.com',
  provider: 'vercel' as const,
  projectId: 'prj_studio',
  verifiedAt: '2026-10-05T12:00:00.000Z',
};

async function makeSite(id: string, bound = true) {
  const created = await createSite(testDb.drizzle, {
    id,
    ownerId: 'operator',
    name: id,
    slug: id,
    visibility: bound ? 'private' : 'public',
    settings: bound
      ? {
          consultation: {
            version: 1,
            kind: 'studio-consultation',
            bookingId: id,
            buyerUserId: 'buyer',
          },
        }
      : { brand: 'Blue' },
  });
  if (!created) throw new Error('Fixture site was not created');
  if (bound)
    await updateConsultationLifecycle(testDb.drizzle, id, 'operator', {
      action: 'observe',
      bookingId: id,
      buyerUserId: 'buyer',
      revoked: false,
      domainPackEntitled: true,
    });
  return created;
}

async function reserveDomain(id: string, verified: boolean) {
  await reserveConsultationDomain(testDb.drizzle, id, 'operator', {
    hostname: domain.hostname,
    provider: domain.provider,
    projectId: domain.projectId,
  });
  if (verified) await setConsultationDomain(testDb.drizzle, id, 'operator', domain);
}

function app(actorId = 'operator') {
  const result = new OpenAPIHono<{ Variables: ContentVariables }>();
  result.use('*', async (c, next) => {
    c.set('db', testDb.drizzle as unknown as DatabaseClient);
    const actor = await getSiteContentActor(testDb.drizzle, actorId);
    if (!actor) throw new Error('Fixture actor missing');
    c.set('user', { ...actor, id: String(actor.id), role: actor.role ?? 'viewer' });
    await next();
  });
  result.route('/api/content', batchRoutes);
  result.route('/api/content', siteRoutes);
  result.route('/api/content', pageRoutes);
  result.route('/api/content', postRoutes);
  result.route('/api/content', mediaRoutes);
  result.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    throw error;
  });
  return result;
}
const mutate = (path: string, body: unknown, method = 'POST') =>
  app().request(`/api/content${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  testDb = await createTestDb();
});
beforeEach(async () => {
  vi.stubEnv('REVEALUI_DEPLOYMENT_MODE', 'hosted');
  // FK-owned cleanup gives every case an independent canonical fixture.
  await testDb.drizzle.delete(schema.users);
  await testDb.drizzle.insert(schema.users).values(
    ['operator', 'buyer', 'intruder'].map((id) => ({
      id,
      name: id,
      email: `${id}@customer.com`,
      role: 'viewer',
      status: 'active',
      emailVerified: true,
      _json: id !== 'buyer' ? { roles: ['super-admin'] } : {},
    })),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await testDb?.close();
});

describe('shared ordinary site mutation boundary', () => {
  it('enforces current bound-site authority even for another platform operator', async () => {
    await makeSite('bound');
    await createPage(testDb.drizzle, {
      id: 'notes',
      siteId: 'bound',
      title: 'Notes',
      slug: 'notes',
      path: '/notes',
      createdBy: 'operator',
    });
    for (const [operation, collection, item] of [
      ['update', 'sites', { id: 'bound', name: 'Stolen' }],
      ['delete', 'sites', { id: 'bound' }],
      [
        'create',
        'pages',
        { siteId: 'bound', title: 'Injected', slug: 'injected', path: '/injected' },
      ],
      ['update', 'pages', { id: 'notes', title: 'Stolen' }],
      ['delete', 'pages', { id: 'notes' }],
    ] as const) {
      const response = await app('intruder').request(`/api/content/batch/${operation}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, items: [item] }),
      });
      expect(response.status).toBe(200);
      expect((await response.json()).results[0].status).toBe('error');
    }
    expect((await getSiteById(testDb.drizzle, 'bound'))?.name).toBe('bound');
    expect((await getPageById(testDb.drizzle, 'notes'))?.title).toBe('Notes');
  });

  it('shares strict page, post and media metadata contracts without changing ownership or source identity', async () => {
    await makeSite('bound');
    await makeSite('ordinary', false);
    await createPage(testDb.drizzle, {
      id: 'notes',
      siteId: 'bound',
      title: 'Notes',
      slug: 'notes',
      path: '/notes',
      createdBy: 'operator',
    });
    await createPost(testDb.drizzle, {
      id: 'post',
      title: 'Post',
      slug: 'post',
      authorId: 'operator',
    });
    await createMedia(testDb.drizzle, {
      id: 'media',
      filename: 'safe.png',
      mimeType: 'image/png',
      url: 'https://storage.customer.com/safe.png',
      uploadedBy: 'operator',
    });
    for (const [collection, id, data] of [
      ['posts', 'post', { content: { url: 'javascript:alert(1)' } }],
      ['pages', 'notes', { blocks: [{ url: 'javascript:alert(1)' }] }],
    ] as const) {
      const response = await mutate('/batch/update', { collection, items: [{ id, ...data }] });
      expect((await response.json()).results[0]).toMatchObject({
        status: 'error',
        error: 'Content validation failed',
      });
    }
    for (const [collection, id, data] of [
      ['pages', 'notes', { siteId: 'ordinary' }],
      ['pages', 'notes', { createdBy: 'buyer' }],
      ['pages', 'notes', { deletedAt: '2026-10-05T12:00:00.000Z' }],
      ['posts', 'post', { authorId: 'buyer' }],
      ['posts', 'post', { deletedAt: null }],
      ['posts', 'post', { version: 99 }],
      ['media', 'media', { uploadedBy: 'buyer' }],
      ['media', 'media', { url: 'https://evil.customer.com/stolen' }],
      ['media', 'media', { mimeType: 'text/html' }],
    ] as const) {
      expect((await mutate(`/${collection}/${id}`, data, 'PATCH')).status).toBe(400);
      const response = await mutate('/batch/update', { collection, items: [{ id, ...data }] });
      expect((await response.json()).results[0]).toMatchObject({
        status: 'error',
        error: 'Invalid mutation fields',
      });
    }
    for (const [collection, item] of [
      ['pages', { id: 'notes', title: 'Reviewed' }],
      ['posts', { id: 'post', title: 'Reviewed', publishedAt: '2026-10-05T12:00:00.000Z' }],
      ['media', { id: 'media', alt: 'Reviewed', focalPoint: { x: 0.5, y: 0.5 } }],
    ] as const) {
      const response = await mutate('/batch/update', { collection, items: [item] });
      expect((await response.json()).results[0].status).toBe('updated');
    }
    expect(await getPageById(testDb.drizzle, 'notes')).toMatchObject({
      siteId: 'bound',
      createdBy: 'operator',
      title: 'Reviewed',
    });
    expect(await getPostById(testDb.drizzle, 'post')).toMatchObject({
      authorId: 'operator',
      title: 'Reviewed',
      publishedAt: new Date('2026-10-05T12:00:00.000Z'),
    });
    expect(await getMediaById(testDb.drizzle, 'media')).toMatchObject({
      uploadedBy: 'operator',
      url: 'https://storage.customer.com/safe.png',
      alt: 'Reviewed',
    });
  });

  it('rejects unsupported user and storage mutations rather than bypassing their maintained owners', async () => {
    for (const operation of ['create', 'update', 'delete']) {
      const response = await mutate(`/batch/${operation}`, {
        collection: 'users',
        items: [
          {
            id: 'buyer',
            role: 'admin',
            emailVerified: true,
            _json: { roles: ['super-admin'] },
            password: 'forged',
          },
        ],
      });
      expect(response.status).toBe(400);
    }
    for (const operation of ['create', 'delete']) {
      const response = await mutate(`/batch/${operation}`, {
        collection: 'media',
        items: [{ id: 'forged-media', filename: 'forged', url: 'https://evil.customer.com/file' }],
      });
      expect((await response.json()).results[0].status).toBe('error');
    }
    expect((await getSiteContentActor(testDb.drizzle, 'buyer'))?.emailVerified).toBe(true);
    expect((await getSiteContentActor(testDb.drizzle, 'buyer'))?._json).toEqual({});
    expect(await getMediaById(testDb.drizzle, 'forged-media')).toBeNull();
  });
  it('rejects managed settings through generic updates of ordinary and bound sites', async () => {
    await makeSite('ordinary', false);
    await makeSite('bound');
    for (const key of managedKeys) {
      for (const id of ['ordinary', 'bound'])
        await expect(
          updateSite(testDb.drizzle, id, { settings: { [key]: domain } }),
        ).rejects.toBeInstanceOf(SiteMutationProtectedError);
    }
    expect((await getSiteById(testDb.drizzle, 'ordinary'))?.settings).toEqual({ brand: 'Blue' });
    expect((await getSiteById(testDb.drizzle, 'bound'))?.settings).not.toHaveProperty(
      'consultationDomain',
    );
    for (const key of managedKeys.filter((key) => key !== 'consultation'))
      await expect(
        createSite(testDb.drizzle, {
          id: `forged-${key}`,
          ownerId: 'operator',
          name: 'Forged',
          slug: `forged-${key}`,
          settings: { [key]: domain },
        }),
      ).rejects.toBeInstanceOf(SiteMutationProtectedError);
  });

  it('keeps bound owner, audience and settings immutable while ordinary metadata and publication remain editable', async () => {
    await makeSite('bound');
    const before = await getSiteById(testDb.drizzle, 'bound');
    for (const data of [
      { ownerId: 'buyer' },
      { visibility: 'public' },
      { settings: null },
      { settings: {} },
      { settings: { brand: 'Other' } },
      { deletedAt: new Date() },
      { id: 'replacement' },
    ])
      await expect(updateSite(testDb.drizzle, 'bound', data)).rejects.toBeInstanceOf(
        SiteMutationProtectedError,
      );
    expect(await getSiteById(testDb.drizzle, 'bound')).toEqual(before);
    const renamed = await updateSite(testDb.drizzle, 'bound', {
      name: 'Reviewed',
      status: 'published',
    });
    expect(renamed).toMatchObject({
      name: 'Reviewed',
      status: 'published',
      ownerId: 'operator',
      visibility: 'private',
      settings: before?.settings,
    });
    await makeSite('ordinary', false);
    expect(
      await updateSite(testDb.drizzle, 'ordinary', {
        settings: { brand: 'Green' },
        visibility: 'private',
      }),
    ).toMatchObject({ settings: { brand: 'Green' }, visibility: 'private' });
  });

  it('uses the same safe PATCH contract for batch and direct HTTP writes', async () => {
    await makeSite('bound');
    const forged = [
      { settings: { consultationDomain: domain } },
      { settings: { consultationLifecycle: { domainPackPurchased: true } } },
      { ownerId: 'buyer' },
      { deletedAt: '2026-10-05T12:00:00.000Z' },
      { version: 999 },
    ];
    for (const data of forged) {
      expect((await mutate('/sites/bound', data, 'PATCH')).status).toBe(400);
      const response = await mutate('/batch/update', {
        collection: 'sites',
        items: [{ id: 'bound', ...data }],
      });
      expect(response.status).toBe(200);
      expect((await response.json()).results[0].status).toBe('error');
    }
    const updated = await mutate('/batch/update', {
      collection: 'sites',
      items: [{ id: 'bound', name: 'Reviewed batch', status: 'published' }],
    });
    expect((await updated.json()).results[0].status).toBe('updated');
    expect((await getSiteById(testDb.drizzle, 'bound'))?.name).toBe('Reviewed batch');
    expect((await getSiteById(testDb.drizzle, 'bound'))?.settings).not.toHaveProperty(
      'consultationDomain',
    );
  });

  it.each([false, true])(
    'retains provider ownership until maintained cleanup, verified=%s',
    async (verified) => {
      await makeSite('bound');
      await reserveDomain('bound', verified);
      const before = await getSiteById(testDb.drizzle, 'bound');
      await expect(deleteSite(testDb.drizzle, 'bound')).rejects.toBeInstanceOf(
        SiteDomainCleanupRequiredError,
      );
      const direct = await app().request('/api/content/sites/bound', { method: 'DELETE' });
      expect(direct.status).toBe(409);
      expect((await direct.json()).error).toContain('Detach');
      const batch = await mutate('/batch/delete', {
        collection: 'sites',
        items: [{ id: 'bound' }],
      });
      expect((await batch.json()).results[0]).toMatchObject({
        id: 'bound',
        status: 'error',
        error: 'Detach the consultation hostname before deleting this site.',
      });
      expect(await getSiteById(testDb.drizzle, 'bound')).toEqual(before);
      // The specialized owner removes its provider resource before this DB completion.
      await removeConsultationDomain(testDb.drizzle, 'bound', 'operator', domain.hostname);
      expect((await app().request('/api/content/sites/bound', { method: 'DELETE' })).status).toBe(
        200,
      );
      expect(await getSiteById(testDb.drizzle, 'bound')).toBeNull();
    },
  );

  it('checks current stored alias state in the mutation statement rather than an earlier caller snapshot', async () => {
    await makeSite('bound');
    const earlier = await getSiteById(testDb.drizzle, 'bound');
    expect(earlier?.settings).not.toHaveProperty('consultationDomainPending');
    await reserveDomain('bound', false);
    await expect(deleteSite(testDb.drizzle, 'bound')).rejects.toBeInstanceOf(
      SiteDomainCleanupRequiredError,
    );
    const retained = await getSiteById(testDb.drizzle, 'bound');
    expect(retained?.settings).toHaveProperty('consultationDomainPending');
    expect(retained?.deletedAt).toBeNull();
  });
});
