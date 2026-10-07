/** Private content boundaries exercised through real Hono routes and migrated PostgreSQL. */
import type { DatabaseClient } from '@revealui/db/client';
import { getSiteContentActor } from '@revealui/db/queries/sites';
import * as schema from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { OpenAPIHono } from '@revealui/openapi';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@revealui/db/client', async (original) => ({
  ...(await original<typeof import('@revealui/db/client')>()),
  getClient: () => state.db,
}));

import { requirePermission } from '../../middleware/authorization.js';
import { publicCacheMiddleware } from '../../middleware/cache-control.js';
import { mintPreviewToken } from '../content/_helpers/preview-token.js';
import type { ContentVariables } from '../content/index.js';
import pagesRoutes from '../content/pages.js';
import searchRoutes from '../content/search.js';
import sessionsRoutes from '../content/sessions.js';
import sitesRoutes from '../content/sites.js';
import usersRoutes from '../content/users.js';

let testDb: TestDb;
function app(actor: string | null) {
  const result = new OpenAPIHono<{ Variables: ContentVariables }>();
  result.use('*', async (c, next) => {
    c.set('db', testDb.drizzle as unknown as DatabaseClient);
    if (actor) {
      const current = await getSiteContentActor(testDb.drizzle, actor);
      if (current)
        c.set('user', { ...current, id: String(current.id), role: current.role ?? 'viewer' });
    }
    await next();
  });
  result.use('*', publicCacheMiddleware({ sMaxAge: 60 }));
  for (const prefix of ['/api/content', '/api/v1/content']) {
    result.post(`${prefix}/*`, requirePermission('content', 'create', { siteScopedContent: true }));
    result.patch(
      `${prefix}/*`,
      requirePermission('content', 'update', { siteScopedContent: true }),
    );
    result.put(`${prefix}/*`, requirePermission('content', 'update', { siteScopedContent: true }));
    result.delete(
      `${prefix}/*`,
      requirePermission('content', 'delete', { siteScopedContent: true }),
    );
    result.route(prefix, pagesRoutes);
    result.route(prefix, sitesRoutes);
    result.route(prefix, usersRoutes);
    result.route(prefix, searchRoutes);
    result.route(prefix, sessionsRoutes);
    result.post(`${prefix}/posts`, (c) => c.json({ success: true }));
  }
  result.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    throw error;
  });
  return result;
}

beforeAll(async () => {
  vi.stubEnv('REVEALUI_DEPLOYMENT_MODE', 'hosted');
  vi.stubEnv('REVEALUI_PREVIEW_TOKEN_SECRET', 'private-content-preview-secret-long-enough');
  vi.stubEnv('ADMIN_URL', 'https://admin.example.test');
  testDb = await createTestDb();
  state.db = testDb.drizzle;
  await testDb.drizzle.insert(schema.users).values(
    ['owner', 'editor', 'viewer', 'outsider', 'agent', 'operator', 'unverified-buyer'].map(
      (id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
        role: id === 'agent' ? 'agent' : 'viewer',
        status: 'active',
        emailVerified: id !== 'unverified-buyer',
        _json: id === 'operator' ? { roles: ['super-admin'] } : {},
      }),
    ),
  );
  await testDb.drizzle.insert(schema.sites).values([
    {
      id: 'private',
      ownerId: 'owner',
      name: 'Private',
      slug: 'private',
      visibility: 'private',
      status: 'published',
    },
    {
      id: 'public',
      ownerId: 'owner',
      name: 'Public',
      slug: 'public',
      visibility: 'public',
      status: 'published',
    },
    {
      id: 'unpublished',
      ownerId: 'owner',
      name: 'Unpublished',
      slug: 'unpublished',
      visibility: 'private',
      status: 'draft',
    },
    {
      id: 'deleted',
      ownerId: 'owner',
      name: 'Deleted',
      slug: 'deleted',
      visibility: 'private',
      status: 'published',
      deletedAt: new Date(),
    },
  ]);
  await testDb.drizzle.insert(schema.siteCollaborators).values(
    ['private', 'unpublished'].flatMap((siteId) => [
      { id: `${siteId}-editor`, siteId, userId: 'editor', role: 'editor' },
      { id: `${siteId}-viewer`, siteId, userId: 'viewer', role: 'viewer' },
      { id: `${siteId}-agent`, siteId, userId: 'agent', role: 'editor' },
    ]),
  );
  await testDb.drizzle.insert(schema.pages).values(
    ['private', 'public', 'unpublished', 'deleted'].flatMap((siteId) =>
      ['published', 'draft'].map((status) => ({
        id: `${siteId}-${status}`,
        siteId,
        title: 'needle confidential content',
        slug: status,
        path: `/${status}`,
        status,
      })),
    ),
  );
  await testDb.drizzle.insert(schema.editSessions).values([
    { id: 'private-session', siteId: 'private', title: 'Private draft', createdBy: 'editor' },
    { id: 'public-session', siteId: 'public', title: 'Public draft', createdBy: 'owner' },
  ]);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await testDb.close();
});

describe('private site audience', () => {
  it('creates immutable consultation provenance only through an authenticated canonical operator', async () => {
    const body = {
      name: 'Consultation delivery',
      slug: 'bound-delivery',
      visibility: 'private',
      settings: {
        consultation: {
          version: 1,
          kind: 'studio-consultation',
          bookingId: 'paid-booking',
          buyerUserId: 'viewer',
        },
      },
    };
    const post = (actor: string, value: unknown) =>
      app(actor).request('/api/content/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
    expect((await post('owner', { ...body, ownerId: 'operator' })).status).toBe(400);
    expect((await post('owner', body)).status).toBe(403);
    expect((await post('operator', { ...body, visibility: 'public' })).status).toBe(400);
    expect(
      (
        await post('operator', {
          ...body,
          settings: {
            consultation: { ...body.settings.consultation, buyerUserId: 'unverified-buyer' },
          },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await post('operator', {
          ...body,
          settings: { consultation: { ...body.settings.consultation, verified: true } },
        })
      ).status,
    ).toBe(400);
    expect((await app('operator').request('/api/content/users/viewer')).status).toBe(200);
    expect((await app('owner').request('/api/content/users/viewer')).status).toBe(403);
    const response = await post('operator', body);
    expect(response.status).toBe(201);
    const { data: site } = await response.json();
    expect(site.ownerId).toBe('operator');
    expect(site.settings).toEqual(body.settings);
    expect((await post('operator', { ...body, slug: 'duplicate-delivery' })).status).toBe(409);
    const result = await (
      await app('operator').request('/api/content/sites?consultationBookingId=paid-booking')
    ).json();
    expect(result.data.map((row: { id: string }) => row.id)).toEqual([site.id]);
    expect(result.totalDocs).toBe(1);
    expect(
      (
        await app('operator').request(`/api/content/sites/${site.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visibility: 'public' }),
        })
      ).status,
    ).toBe(400);
    // Generic PATCH has no owner or consultation binding assignment surface.
    const rejected = await app('operator').request(`/api/content/sites/${site.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: 'owner', settings: {} }),
    });
    expect(rejected.status).toBe(400);
    const preserved = await app('operator').request(`/api/content/sites/${site.id}`);
    expect((await preserved.json()).data).toMatchObject({
      ownerId: 'operator',
      settings: body.settings,
    });
  });

  it('applies consultation lifecycle only for the canonical operator owner and preserves terminal denial', async () => {
    const created = await app('operator').request('/api/content/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Lifecycle delivery',
        slug: 'lifecycle-delivery',
        status: 'published',
        visibility: 'private',
        settings: {
          consultation: {
            version: 1,
            kind: 'studio-consultation',
            bookingId: 'lifecycle-booking',
            buyerUserId: 'viewer',
          },
        },
      }),
    });
    expect(created.status).toBe(201);
    const { data: site } = await created.json();
    const path = `/api/content/sites/${site.id}/consultation-lifecycle`;
    const observe = {
      action: 'observe',
      bookingId: 'lifecycle-booking',
      buyerUserId: 'viewer',
      revoked: false,
      domainPackEntitled: true,
    };
    const mutate = (actor: string | null, input: unknown) =>
      app(actor).request(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    expect((await mutate(null, observe)).status).toBe(401);
    expect((await mutate('owner', observe)).status).toBe(403);
    expect((await mutate('operator', { ...observe, buyerUserId: 'outsider' })).status).toBe(409);
    expect((await mutate('operator', { ...observe, arbitrary: true })).status).toBe(400);
    await app('operator').request(`/api/content/sites/${site.id}/collaborators/viewer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'viewer' }),
    });
    expect((await app('viewer').request(`/api/content/sites/${site.id}`)).status).toBe(403);
    const allowed = await mutate('operator', observe);
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).data.settings.consultationLifecycle).toMatchObject({
      revoked: false,
      domainPackPurchased: true,
      domainPack: 'entitled',
      amountRefunded: 0,
    });
    expect((await app('viewer').request(`/api/content/sites/${site.id}`)).status).toBe(200);
    expect(
      (
        await mutate('operator', {
          action: 'revoke',
          bookingId: 'lifecycle-booking',
          buyerUserId: 'viewer',
        })
      ).status,
    ).toBe(200);
    const stale = await mutate('operator', observe);
    expect(stale.status).toBe(200);
    expect((await stale.json()).data.settings.consultationLifecycle.revoked).toBe(true);
    await app('operator').request(`/api/content/sites/${site.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    });
    expect((await app('viewer').request(`/api/content/sites/${site.id}`)).status).toBe(403);
  });

  it.each([null, 'outsider'])('hides private IDs, lists and counts from %s', async (actor) => {
    const server = app(actor);
    expect((await server.request('/api/content/pages/private-published')).status).toBe(404);
    expect((await server.request('/api/content/sites/private/pages')).status).toBe(404);
    const search = await server.request('/api/content/search?q=needle&type=pages');
    expect(search.headers.get('Cache-Control')).toBe('no-store');
    const body = await search.json();
    expect(body.results.map((row: { id: string }) => row.id)).toEqual(['public-published']);
    expect(body.totalDocs).toBe(1);
    expect((await server.request('/api/content/pages/public-published')).status).toBe(200);
    expect((await server.request('/api/content/pages/public-draft')).status).toBe(404);
  });

  it.each(['owner', 'editor'])(
    'allows %s to read private drafts with no shared caching',
    async (actor) => {
      const server = app(actor);
      const response = await server.request('/api/content/pages/private-draft');
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect((await server.request('/api/content/sites/private/pages')).status).toBe(200);
      expect((await server.request('/api/content/pages/unpublished-draft')).status).toBe(200);
      expect((await server.request('/api/content/pages/deleted-published')).status).toBe(404);
    },
  );

  it('limits viewers to published content from published sites', async () => {
    const server = app('viewer');
    expect((await server.request('/api/content/pages/private-published')).status).toBe(200);
    expect((await server.request('/api/content/pages/private-draft')).status).toBe(404);
    expect((await server.request('/api/content/pages/unpublished-published')).status).toBe(404);
    const list = await (await server.request('/api/content/sites/private/pages')).json();
    expect(list.data.map((row: { id: string }) => row.id)).toEqual(['private-published']);
    const collection = await (await server.request('/api/content/pages')).json();
    expect(collection.totalDocs).toBe(1);
    expect(collection.data.map((row: { id: string }) => row.id)).toEqual(['private-published']);
    expect(
      (
        await server.request('/api/content/pages/private-published', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Stolen' }),
        })
      ).status,
    ).toBe(403);
  });

  it('filters session lists and denies draft reads without current editor membership', async () => {
    for (const actor of ['viewer', 'outsider']) {
      expect((await app(actor).request('/api/content/sessions/private-session')).status).toBe(403);
      const body = await (await app(actor).request('/api/content/sessions')).json();
      expect(body.data).toEqual([]);
    }
    expect((await app('editor').request('/api/content/sessions/private-session')).status).toBe(200);
    const response = await app('editor').request(
      '/api/content/sessions/private-session/docs/page/public-published',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'title', value: 'Cross-site copy' }),
      },
    );
    expect(response.status).toBe(404);
  });

  it.each(['owner', 'editor'])(
    'lets a %s with a viewer account role edit and publish their site',
    async (actor) => {
      const server = app(actor);
      const created = await server.request('/api/v1/content/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: 'private', title: 'Member editing' }),
      });
      expect(created.status).toBe(201);
      const { data: session } = await created.json();
      const patched = await server.request(
        `/api/content/sessions/${session.id}/docs/page/private-draft`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: 'title', value: 'Updated needle' }),
        },
      );
      expect(patched.status).toBe(200);
      expect(
        (await server.request(`/api/content/sessions/${session.id}/publish`, { method: 'POST' }))
          .status,
      ).toBe(200);
      expect((await server.request('/api/content/posts', { method: 'POST' })).status).toBe(403);
      await testDb.drizzle
        .update(schema.pages)
        .set({ status: 'draft' })
        .where(eq(schema.pages.id, 'private-draft'));
    },
  );

  it('lets a site agent propose drafts and denies agent publication', async () => {
    const server = app('agent');
    const response = await server.request('/api/content/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: 'private', title: 'Agent proposal' }),
    });
    expect(response.status).toBe(201);
    const { data: session } = await response.json();
    expect(
      (await server.request(`/api/content/sessions/${session.id}/publish`, { method: 'POST' }))
        .status,
    ).toBe(403);
    expect(
      (
        await server.request('/api/content/pages/private-published', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'published', title: 'Agent live write' }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await server.request('/api/content/sites/private/collaborators/outsider', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'admin' }),
        })
      ).status,
    ).toBe(403);
  });

  it('rejects persisted cross-site overlays before draft reads, events, writes or publication', async () => {
    await testDb.drizzle.insert(schema.editSessionDocs).values({
      id: 'wrong-site-overlay',
      sessionId: 'private-session',
      docType: 'page',
      docId: 'public-published',
      draft: { title: 'Secret from another site' },
      baseVersion: 1,
    });
    const server = app('editor');
    for (const path of [
      '/api/content/sessions/private-session',
      '/api/content/sessions/private-session/events',
    ]) {
      expect((await server.request(path)).status).toBe(409);
    }
    expect(
      (await server.request('/api/content/sessions/private-session/publish', { method: 'POST' }))
        .status,
    ).toBe(409);
    const token = mintPreviewToken(
      'private-content-preview-secret-long-enough',
      'private-session',
      60,
    ).token;
    expect(
      (await server.request(`/api/content/sessions/private-session/preview?token=${token}`)).status,
    ).toBe(409);
    const patched = await server.request(
      '/api/content/sessions/private-session/docs/page/public-published',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'title', value: 'Changed cross-site' }),
      },
    );
    expect(patched.status).toBe(409);
    await testDb.drizzle
      .delete(schema.editSessionDocs)
      .where(eq(schema.editSessionDocs.id, 'wrong-site-overlay'));
  });

  it('grants and revokes canonical client membership through site administration', async () => {
    const grant = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'viewer' }),
    };
    expect(
      (await app('editor').request('/api/content/sites/private/collaborators/outsider', grant))
        .status,
    ).toBe(403);
    expect(
      (await app('owner').request('/api/content/sites/private/collaborators/missing', grant))
        .status,
    ).toBe(404);
    expect(
      (await app('owner').request('/api/content/sites/private/collaborators/outsider', grant))
        .status,
    ).toBe(200);
    expect((await app('outsider').request('/api/content/pages/private-published')).status).toBe(
      200,
    );
    expect((await app('outsider').request('/api/content/pages/private-draft')).status).toBe(404);
    expect(
      (
        await app('owner').request('/api/content/sites/private/collaborators/outsider', {
          method: 'DELETE',
        })
      ).status,
    ).toBe(200);
    expect((await app('outsider').request('/api/content/pages/private-published')).status).toBe(
      404,
    );
  });

  it('keeps publication separate from audience when an owner makes a site private', async () => {
    const server = app('owner');
    const response = await server.request('/api/content/sites/public', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: 'private' }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      visibility: 'private',
      status: 'published',
    });
    expect((await app(null).request('/api/content/pages/public-published')).status).toBe(404);
    await server.request('/api/content/sites/public', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: 'public' }),
    });
  });

  it('keeps private preview tokens behind current membership while public previews retain bearer access', async () => {
    const privateToken = mintPreviewToken(
      'private-content-preview-secret-long-enough',
      'private-session',
      60,
    ).token;
    const publicToken = mintPreviewToken(
      'private-content-preview-secret-long-enough',
      'public-session',
      60,
    ).token;
    const path = `/api/content/sessions/private-session/preview?token=${privateToken}`;
    expect((await app(null).request(path)).status).toBe(401);
    expect((await app('outsider').request(path)).status).toBe(403);
    expect((await app('viewer').request(path)).status).toBe(403);
    expect((await app('editor').request(path)).status).toBe(200);
    expect(
      (await app(null).request(`/api/content/sessions/public-session/preview?token=${publicToken}`))
        .status,
    ).toBe(200);
    await testDb.drizzle
      .delete(schema.siteCollaborators)
      .where(eq(schema.siteCollaborators.id, 'private-editor'));
    expect((await app('editor').request(path)).status).toBe(403);
  });
});
