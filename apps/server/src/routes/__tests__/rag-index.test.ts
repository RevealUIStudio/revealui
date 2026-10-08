import { resolveLLMClientForRequest } from '@revealui/ai/llm/server';
import type { DatabaseClient } from '@revealui/db/client';
import { pages } from '@revealui/db/schema/pages';
import { ragDocuments } from '@revealui/db/schema/rag';
import { siteCollaborators, sites } from '@revealui/db/schema/sites';
import { users } from '@revealui/db/schema/users';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import ragApp from '../rag-index.js';

// Deterministic provider boundary only; routes, ACL, ingestion and pgvector are real.
vi.mock('@revealui/ai/embeddings', () => ({
  generateEmbedding: vi.fn(async () => ({
    vector: Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)),
  })),
}));

vi.mock('@revealui/ai/llm/server', () => ({
  resolveLLMClientForRequest: vi.fn(async () => ({ marker: 'resolved-client' })),
}));

let testDb: TestDb;
let db: DatabaseClient;
function app(userId?: string, role = 'admin', tenantId?: string) {
  const result = new Hono<{
    Variables: { db: DatabaseClient; user?: { id: string; role: string }; tenant?: { id: string } };
  }>();
  result.use('*', async (c, next) => {
    c.set('db', db);
    if (userId) c.set('user', { id: userId, role });
    if (tenantId) c.set('tenant', { id: tenantId });
    await next();
  });
  result.route('/rag', ragApp);
  return result;
}
const path = '/rag/workspaces/private';
beforeAll(async () => {
  testDb = await createTestDb({ enableVector: true });
  db = testDb.drizzle as unknown as DatabaseClient;
  await db.insert(users).values(
    ['owner', 'viewer', 'editor', 'outsider'].map((id) => ({
      id,
      name: id,
      role: 'viewer',
      email: `${id}@example.test`,
      emailVerified: true,
    })),
  );
  await db.insert(sites).values([
    {
      id: 'private',
      ownerId: 'owner',
      name: 'Private',
      slug: 'private',
      visibility: 'private',
      status: 'published',
    },
    { id: 'other', ownerId: 'outsider', name: 'Other', slug: 'other', status: 'published' },
  ]);
  await db.insert(siteCollaborators).values([
    { id: 'viewer-member', siteId: 'private', userId: 'viewer', role: 'viewer' },
    { id: 'editor-member', siteId: 'private', userId: 'editor', role: 'editor' },
  ]);
  await db.insert(pages).values([
    {
      id: 'published',
      siteId: 'private',
      title: 'Published notes',
      slug: 'published',
      path: '/published',
      status: 'published',
      blocks: [{ text: 'Client approved content' }],
    },
    {
      id: 'draft',
      siteId: 'private',
      title: 'Draft notes',
      slug: 'draft',
      path: '/draft',
      blocks: [{ text: 'Internal draft budget' }],
    },
    {
      id: 'cross-site',
      siteId: 'other',
      title: 'Other site',
      slug: 'other',
      path: '/other',
      status: 'published',
      blocks: [],
    },
  ]);
});
afterAll(async () => {
  await testDb?.close();
});

describe('site-backed RAG API authorization and canonical sources', () => {
  it('requires canonical site access, irrespective of shell role or tenant absence', async () => {
    for (const suffix of ['/documents', '/status', '/index/pages']) {
      const method = suffix.startsWith('/index') ? 'POST' : 'GET';
      expect((await app().request(path + suffix, { method })).status).toBe(401);
      expect((await app('outsider', 'admin').request(path + suffix, { method })).status).toBe(403);
    }
    expect((await app('viewer').request(`${path}/index/pages`, { method: 'POST' })).status).toBe(
      403,
    );
  });

  it('rejects unsupported collection/global fetching and indexes every canonical scoped page', async () => {
    expect(
      (await app('owner').request(`${path}/index/invalid.name`, { method: 'POST' })).status,
    ).toBe(400);
    expect((await app('owner').request(`${path}/index/posts`, { method: 'POST' })).status).toBe(
      400,
    );
    const response = await app('editor', 'viewer', 'unrelated-tenant-label').request(
      `${path}/index/pages`,
      { method: 'POST' },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 2, indexed: 2, failed: 0 });
    expect(resolveLLMClientForRequest).toHaveBeenCalledWith(
      'editor',
      expect.anything(),
      expect.objectContaining({ workspaceId: 'private' }),
    );
    const docs = await db.select().from(ragDocuments);
    expect(docs.map((doc) => doc.sourceId).sort()).toEqual(['draft', 'published']);
  });

  it('filters list and status against live publication and content snapshots', async () => {
    const response = await app('viewer').request(`${path}/documents`);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect((await response.json()).total).toBe(1);
    expect((await (await app('editor').request(`${path}/documents`)).json()).total).toBe(2);
    expect((await (await app('viewer').request(`${path}/status`)).json()).indexedDocuments).toBe(1);
    await db
      .update(pages)
      .set({ blocks: [{ text: 'Revised private content' }] })
      .where(eq(pages.id, 'published'));
    expect((await (await app('viewer').request(`${path}/documents`)).json()).total).toBe(0);
    expect((await (await app('viewer').request(`${path}/status`)).json()).totalDocuments).toBe(0);
    await db.update(pages).set({ status: 'draft' }).where(eq(pages.id, 'published'));
    expect((await (await app('viewer').request(`${path}/documents`)).json()).total).toBe(0);
  });

  it('scopes deletions to the authorized site and rechecks revocation', async () => {
    await db.insert(ragDocuments).values({
      id: 'cross-document',
      workspaceId: 'other',
      sourceType: 'text',
      rawContent: 'Other private data',
    });
    expect(
      (await app('owner').request(`${path}/documents/cross-document`, { method: 'DELETE' })).status,
    ).toBe(404);
    expect(
      await db.select().from(ragDocuments).where(eq(ragDocuments.id, 'cross-document')),
    ).toHaveLength(1);
    const [own] = await db
      .select()
      .from(ragDocuments)
      .where(eq(ragDocuments.workspaceId, 'private'));
    expect(
      (await app('viewer').request(`${path}/documents/${own?.id}`, { method: 'DELETE' })).status,
    ).toBe(403);
    expect(
      (await app('editor').request(`${path}/documents/${own?.id}`, { method: 'DELETE' })).status,
    ).toBe(200);
    await db.delete(siteCollaborators).where(eq(siteCollaborators.id, 'viewer-member'));
    expect((await app('viewer').request(`${path}/documents`)).status).toBe(403);
  });

  it('returns 409 when hosted indexing has no account model key', async () => {
    vi.mocked(resolveLLMClientForRequest).mockRejectedValueOnce(
      Object.assign(new Error('No LLM provider is configured for this account.'), {
        code: 'LLM_NOT_CONFIGURED',
        settingsPath: '/settings/api-keys',
      }),
    );
    const response = await app('editor').request(`${path}/index/pages`, { method: 'POST' });
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.code).toBe('LLM_NOT_CONFIGURED');
    expect(body.settingsPath).toBe('/settings/api-keys');
    expect(body.success).toBe(false);
  });
});
