/**
 * Edit session engine  -  integration tests against a REAL migrated schema
 * (PGlite) and the real Hono session routes.
 *
 * Covers the P1 slice-1 lifecycle and its invariants:
 *   - open -> patch (materializes draft + base_version) -> patch -> publish
 *     (page written, version bumped, revision snapshot, session published,
 *     events complete + in order)
 *   - publish after an out-of-band page edit -> 409 with per-doc detail, no write
 *   - discard
 *   - maxPerDoc=50 revision pruning
 *   - prototype-pollution segment rejection
 *   - authz: anonymous + non-editor rejected on EVERY route (GETs included)
 *   - mutations on a non-open session -> 409
 */

import type { DatabaseClient } from '@revealui/db/client';
import * as schema from '@revealui/db/schema';
import { OpenAPIHono } from '@revealui/openapi';
import { asc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestDb,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';
import type { ContentVariables } from '../content/index.js';
import sessionsRoutes from '../content/sessions.js';

let testDb: TestDb;

interface UserCtx {
  id: string;
  role: string;
}

const EDITOR: UserCtx = { id: 'user-editor', role: 'editor' };
const VIEWER: UserCtx = { id: 'user-viewer', role: 'viewer' };

const SITE_ID = 'site-1';
const PAGE_ID = 'page-1';

function createApp(user: UserCtx | null) {
  const app = new OpenAPIHono<{ Variables: ContentVariables }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    c.set('db', testDb.drizzle as unknown as DatabaseClient);
    await next();
  });
  app.route('/', sessionsRoutes);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

async function seedBase(): Promise<void> {
  const db = testDb.drizzle;
  await db.insert(schema.users).values([
    { id: EDITOR.id, name: 'Editor', email: 'editor@example.com', role: 'editor' },
    { id: VIEWER.id, name: 'Viewer', email: 'viewer@example.com', role: 'viewer' },
  ]);
  await db.insert(schema.sites).values({
    id: SITE_ID,
    ownerId: EDITOR.id,
    name: 'Site One',
    slug: 'site-one',
    status: 'published',
  });
  await db.insert(schema.pages).values({
    id: PAGE_ID,
    siteId: SITE_ID,
    title: 'Original Title',
    slug: 'home',
    path: '/',
    status: 'published',
    version: 1,
    blocks: [{ type: 'text', text: 'hello' }],
    seo: { description: 'orig' },
  });
}

async function openSession(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await app.request('/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ siteId: SITE_ID, title: 'My edits' }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function patch(
  app: ReturnType<typeof createApp>,
  sessionId: string,
  path: string,
  value: unknown,
): Promise<Response> {
  return app.request(`/sessions/${sessionId}/docs/page/${PAGE_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, value }),
  });
}

beforeEach(async () => {
  testDb = await createTestDb();
  await seedBase();
});

afterAll(async () => {
  await testDb?.close();
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('open -> patch -> patch -> publish', () => {
  it('materializes a draft with base_version, applies patches, and publishes atomically', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);

    // First patch materializes the overlay from the live page.
    const p1 = await patch(app, sessionId, 'title', 'New Title');
    expect(p1.status).toBe(200);
    const doc1 = (await p1.json()) as { data: { baseVersion: number; draft: { title: string } } };
    expect(doc1.data.baseVersion).toBe(1);
    expect(doc1.data.draft.title).toBe('New Title');

    // Second patch applies to the stored draft (nested array path).
    const p2 = await patch(app, sessionId, 'blocks.0.text', 'updated body');
    expect(p2.status).toBe(200);
    const doc2 = (await p2.json()) as {
      data: { draft: { title: string; blocks: Array<{ text: string }> } };
    };
    expect(doc2.data.draft.title).toBe('New Title');
    expect(doc2.data.draft.blocks[0].text).toBe('updated body');

    // Publish.
    const pub = await app.request(`/sessions/${sessionId}/publish`, { method: 'POST' });
    expect(pub.status).toBe(200);
    const pubBody = (await pub.json()) as { data: { status: string }; publishedDocs: number };
    expect(pubBody.data.status).toBe('published');
    expect(pubBody.publishedDocs).toBe(1);

    // Page written + version bumped.
    const page = (
      await testDb.drizzle.select().from(schema.pages).where(eq(schema.pages.id, PAGE_ID))
    )[0];
    expect(page.title).toBe('New Title');
    expect(page.version).toBe(2);
    expect(page.status).toBe('published');
    expect((page.blocks as Array<{ text: string }>)[0].text).toBe('updated body');

    // Revision snapshot exists.
    const revisions = await testDb.drizzle
      .select()
      .from(schema.pageRevisions)
      .where(eq(schema.pageRevisions.pageId, PAGE_ID));
    expect(revisions).toHaveLength(1);
    expect(revisions[0].title).toBe('New Title');

    // Session published.
    const session = (
      await testDb.drizzle
        .select()
        .from(schema.editSessions)
        .where(eq(schema.editSessions.id, sessionId))
    )[0];
    expect(session.status).toBe('published');
    expect(session.publishedAt).not.toBeNull();

    // Events complete and in order.
    const events = await testDb.drizzle
      .select()
      .from(schema.editSessionEvents)
      .where(eq(schema.editSessionEvents.sessionId, sessionId))
      .orderBy(asc(schema.editSessionEvents.id));
    expect(events.map((e) => e.type)).toEqual(['opened', 'patched', 'patched', 'published']);
    expect(events.every((e) => e.actorKind === 'human')).toBe(true);
  });

  it('GET /sessions/:id returns the session, its docs, and chronological events', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    await patch(app, sessionId, 'title', 'Draft Title');

    const res = await app.request(`/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        session: { status: string };
        docs: Array<{ docId: string; baseVersion: number }>;
        events: Array<{ type: string }>;
      };
    };
    expect(body.data.session.status).toBe('open');
    expect(body.data.docs).toHaveLength(1);
    expect(body.data.docs[0].docId).toBe(PAGE_ID);
    expect(body.data.events.map((e) => e.type)).toEqual(['opened', 'patched']);
  });

  it('GET /sessions/:id/events polls after a cursor', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    await patch(app, sessionId, 'title', 'A');

    const all = await app.request(`/sessions/${sessionId}/events?after=0`);
    const allBody = (await all.json()) as { data: Array<{ id: number }>; nextCursor: number };
    expect(allBody.data.map((e) => e.id)).toHaveLength(2);
    const cursor = allBody.data[0].id;

    const after = await app.request(`/sessions/${sessionId}/events?after=${cursor}`);
    const afterBody = (await after.json()) as { data: Array<{ type: string }>; nextCursor: number };
    expect(afterBody.data.map((e) => e.type)).toEqual(['patched']);
    expect(afterBody.nextCursor).toBe(allBody.nextCursor);
  });

  it('GET /sessions lists and filters by status', async () => {
    const app = createApp(EDITOR);
    const openId = await openSession(app);
    const discardId = await openSession(app);
    await app.request(`/sessions/${discardId}`, { method: 'DELETE' });

    const openList = await app.request('/sessions?status=open');
    const openBody = (await openList.json()) as { data: Array<{ id: string }> };
    expect(openBody.data.map((s) => s.id)).toContain(openId);
    expect(openBody.data.map((s) => s.id)).not.toContain(discardId);
  });
});

// ---------------------------------------------------------------------------
// Conflict  -  publish after an out-of-band page edit
// ---------------------------------------------------------------------------

describe('publish after external edit', () => {
  it('returns 409 with per-doc detail and does not write', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    await patch(app, sessionId, 'title', 'Draft Title');

    // Out-of-band edit bumps the live page version.
    await testDb.drizzle
      .update(schema.pages)
      .set({ version: 5, title: 'Externally Edited' })
      .where(eq(schema.pages.id, PAGE_ID));

    const pub = await app.request(`/sessions/${sessionId}/publish`, { method: 'POST' });
    expect(pub.status).toBe(409);
    const body = (await pub.json()) as {
      error: string;
      conflicts: Array<{
        docId: string;
        reason: string;
        baseVersion: number;
        currentVersion: number;
      }>;
    };
    expect(body.error).toBe('publish_conflict');
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0]).toMatchObject({
      docId: PAGE_ID,
      reason: 'version_conflict',
      baseVersion: 1,
      currentVersion: 5,
    });

    // No partial publish: the page keeps the external edit, not the draft.
    const page = (
      await testDb.drizzle.select().from(schema.pages).where(eq(schema.pages.id, PAGE_ID))
    )[0];
    expect(page.title).toBe('Externally Edited');
    expect(page.version).toBe(5);
    const session = (
      await testDb.drizzle
        .select()
        .from(schema.editSessions)
        .where(eq(schema.editSessions.id, sessionId))
    )[0];
    expect(session.status).toBe('open');
  });
});

// ---------------------------------------------------------------------------
// Discard
// ---------------------------------------------------------------------------

describe('discard', () => {
  it('marks the session discarded, writes an event, and retains overlay rows', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    await patch(app, sessionId, 'title', 'Draft Title');

    const res = await app.request(`/sessions/${sessionId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe('discarded');

    // Overlay row retained for audit.
    const docs = await testDb.drizzle
      .select()
      .from(schema.editSessionDocs)
      .where(eq(schema.editSessionDocs.sessionId, sessionId));
    expect(docs).toHaveLength(1);

    const events = await testDb.drizzle
      .select()
      .from(schema.editSessionEvents)
      .where(eq(schema.editSessionEvents.sessionId, sessionId))
      .orderBy(asc(schema.editSessionEvents.id));
    expect(events.map((e) => e.type)).toEqual(['opened', 'patched', 'discarded']);
  });
});

// ---------------------------------------------------------------------------
// Revision pruning
// ---------------------------------------------------------------------------

describe('maxPerDoc=50 revision pruning', () => {
  it('keeps the newest 50 revisions for the published page', async () => {
    // Pre-seed 50 existing revisions so the publish makes the 51st.
    await testDb.drizzle.insert(schema.pageRevisions).values(
      Array.from({ length: 50 }, (_, i) => ({
        id: `rev-${i + 1}`,
        pageId: PAGE_ID,
        revisionNumber: i + 1,
        title: `Rev ${i + 1}`,
        blocks: [],
        seo: null,
      })),
    );

    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    await patch(app, sessionId, 'title', 'Newest');
    const pub = await app.request(`/sessions/${sessionId}/publish`, { method: 'POST' });
    expect(pub.status).toBe(200);

    const revisions = await testDb.drizzle
      .select()
      .from(schema.pageRevisions)
      .where(eq(schema.pageRevisions.pageId, PAGE_ID))
      .orderBy(asc(schema.pageRevisions.revisionNumber));
    expect(revisions).toHaveLength(50);
    // The oldest (revisionNumber 1) was pruned; the newest is number 51.
    expect(revisions[0].revisionNumber).toBe(2);
    expect(revisions[revisions.length - 1].revisionNumber).toBe(51);
  });
});

// ---------------------------------------------------------------------------
// Prototype pollution
// ---------------------------------------------------------------------------

describe('prototype-pollution guard', () => {
  it('rejects dangerous path segments with 400', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);

    for (const badPath of ['__proto__.polluted', 'constructor.x', 'a.prototype.b']) {
      const res = await patch(app, sessionId, badPath, 'x');
      expect(res.status).toBe(400);
    }

    // The base object prototype was not polluted.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Non-open session mutations
// ---------------------------------------------------------------------------

describe('mutations on a non-open session', () => {
  it('rejects patch, publish, and discard with 409 once published', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    await patch(app, sessionId, 'title', 'x');
    const pub = await app.request(`/sessions/${sessionId}/publish`, { method: 'POST' });
    expect(pub.status).toBe(200);

    expect((await patch(app, sessionId, 'title', 'y')).status).toBe(409);
    expect((await app.request(`/sessions/${sessionId}/publish`, { method: 'POST' })).status).toBe(
      409,
    );
    expect((await app.request(`/sessions/${sessionId}`, { method: 'DELETE' })).status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Authorization  -  every route rejects anonymous + non-editor (GETs included)
// ---------------------------------------------------------------------------

describe('authorization on every session route', () => {
  interface Case {
    method: string;
    url: string;
    body?: unknown;
  }

  function routeCases(sessionId: string): Case[] {
    return [
      { method: 'POST', url: '/sessions', body: { siteId: SITE_ID, title: 't' } },
      { method: 'GET', url: '/sessions' },
      { method: 'GET', url: `/sessions/${sessionId}` },
      { method: 'GET', url: `/sessions/${sessionId}/events` },
      {
        method: 'PATCH',
        url: `/sessions/${sessionId}/docs/page/${PAGE_ID}`,
        body: { path: 'title', value: 'x' },
      },
      { method: 'POST', url: `/sessions/${sessionId}/publish` },
      { method: 'DELETE', url: `/sessions/${sessionId}` },
    ];
  }

  async function callAll(user: UserCtx | null): Promise<number[]> {
    const setup = createApp(EDITOR);
    const sessionId = await openSession(setup);
    const app = createApp(user);
    const statuses: number[] = [];
    for (const rc of routeCases(sessionId)) {
      const res = await app.request(rc.url, {
        method: rc.method,
        headers: rc.body ? { 'content-type': 'application/json' } : undefined,
        body: rc.body ? JSON.stringify(rc.body) : undefined,
      });
      statuses.push(res.status);
    }
    return statuses;
  }

  it('rejects anonymous with 401 on every route including GETs', async () => {
    const statuses = await callAll(null);
    expect(statuses.every((s) => s === 401)).toBe(true);
  });

  it('rejects a non-editor (viewer) with 403 on every route including GETs', async () => {
    const statuses = await callAll(VIEWER);
    expect(statuses.every((s) => s === 403)).toBe(true);
  });
});
