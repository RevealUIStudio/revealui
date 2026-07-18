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
import { and, asc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Race-injection control for the mid-flight publish tests. Default (both unset)
// passes every query straight through to the real implementation, so all other
// tests exercise the genuine engine. Only the mid-flight tests set these.
const raceControl = vi.hoisted(() => ({
  bumpBeforePublish: null as { pageId: string; toVersion: number } | null,
  failRestore: false,
}));

vi.mock('@revealui/db/queries/edit-sessions', async () => {
  const actual = await vi.importActual<typeof import('@revealui/db/queries/edit-sessions')>(
    '@revealui/db/queries/edit-sessions',
  );
  const schemaMod =
    await vi.importActual<typeof import('@revealui/db/schema')>('@revealui/db/schema');
  const { eq: eqOp } = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    async publishDraftToPage(
      db: Parameters<typeof actual.publishDraftToPage>[0],
      data: Parameters<typeof actual.publishDraftToPage>[1],
    ) {
      const bump = raceControl.bumpBeforePublish;
      if (bump && bump.pageId === data.pageId) {
        // A concurrent writer wins the race between the pre-flight read and this
        // doc's guarded write, so the guard below misses.
        raceControl.bumpBeforePublish = null;
        await db
          .update(schemaMod.pages)
          .set({ version: bump.toVersion })
          .where(eqOp(schemaMod.pages.id, data.pageId));
      }
      return actual.publishDraftToPage(db, data);
    },
    async restorePageContent(
      db: Parameters<typeof actual.restorePageContent>[0],
      data: Parameters<typeof actual.restorePageContent>[1],
    ) {
      if (raceControl.failRestore) return null;
      return actual.restorePageContent(db, data);
    },
  };
});

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
const PAGE_B = 'page-2';

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
  await db.insert(schema.pages).values([
    {
      id: PAGE_ID,
      siteId: SITE_ID,
      title: 'Original Title',
      slug: 'home',
      path: '/',
      status: 'published',
      version: 1,
      blocks: [{ type: 'text', text: 'hello' }],
      seo: { description: 'orig' },
    },
    {
      id: PAGE_B,
      siteId: SITE_ID,
      title: 'Second Page',
      slug: 'about',
      path: '/about',
      status: 'published',
      version: 1,
      blocks: [{ type: 'text', text: 'about' }],
      seo: { description: 'about-orig' },
    },
  ]);
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
  return patchDoc(app, sessionId, PAGE_ID, path, value);
}

async function patchDoc(
  app: ReturnType<typeof createApp>,
  sessionId: string,
  docId: string,
  path: string,
  value: unknown,
): Promise<Response> {
  return app.request(`/sessions/${sessionId}/docs/page/${docId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, value }),
  });
}

beforeEach(async () => {
  raceControl.bumpBeforePublish = null;
  raceControl.failRestore = false;
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
    await app.request(`/sessions/${discardId}/discard`, { method: 'POST' });

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
// Mid-flight publish conflict (a writer wins the race after the pre-flight)
// ---------------------------------------------------------------------------

describe('mid-flight publish conflict', () => {
  async function openTwoDocSession(app: ReturnType<typeof createApp>): Promise<string> {
    const sessionId = await openSession(app);
    // page-1 sorts before page-2, so page-1 publishes first in the loop.
    await patchDoc(app, sessionId, PAGE_ID, 'title', 'A-new');
    await patchDoc(app, sessionId, PAGE_B, 'title', 'B-new');
    return sessionId;
  }

  it('compensates already-written docs and returns a clean 409 (nothing published)', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openTwoDocSession(app);

    // page-1 publishes; then a concurrent writer wins on page-2, so its guarded
    // write misses mid-flight.
    raceControl.bumpBeforePublish = { pageId: PAGE_B, toVersion: 4 };

    const pub = await app.request(`/sessions/${sessionId}/publish`, { method: 'POST' });
    expect(pub.status).toBe(409);
    const body = (await pub.json()) as {
      error: string;
      conflicts: Array<{ docId: string }>;
      partiallyPublished?: string[];
    };
    expect(body.error).toBe('publish_conflict');
    expect(body.conflicts.map((cft) => cft.docId)).toEqual([PAGE_B]);
    expect(body.partiallyPublished ?? []).toEqual([]); // nothing left live

    // page-1 was published then compensated back to its exact prior row.
    const pageA = (
      await testDb.drizzle.select().from(schema.pages).where(eq(schema.pages.id, PAGE_ID))
    )[0];
    expect(pageA.title).toBe('Original Title');
    expect(pageA.version).toBe(1);
    // The revision inserted during the failed attempt was deleted.
    const revs = await testDb.drizzle
      .select()
      .from(schema.pageRevisions)
      .where(eq(schema.pageRevisions.pageId, PAGE_ID));
    expect(revs).toHaveLength(0);

    // Session remains open (publish did not complete).
    const session = (
      await testDb.drizzle
        .select()
        .from(schema.editSessions)
        .where(eq(schema.editSessions.id, sessionId))
    )[0];
    expect(session.status).toBe('open');
  });

  it('reports partiallyPublished when compensation fails, then a retry converges with no wedge', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openTwoDocSession(app);

    // page-1 publishes; page-2 conflicts mid-flight; and compensation of page-1
    // is forced to miss, so page-1 stays live.
    raceControl.bumpBeforePublish = { pageId: PAGE_B, toVersion: 4 };
    raceControl.failRestore = true;

    const pub = await app.request(`/sessions/${sessionId}/publish`, { method: 'POST' });
    expect(pub.status).toBe(409);
    const body = (await pub.json()) as {
      conflicts: Array<{ docId: string }>;
      partiallyPublished?: string[];
    };
    expect(body.conflicts.map((cft) => cft.docId)).toEqual([PAGE_B]);
    expect(body.partiallyPublished).toEqual([PAGE_ID]);

    // page-1 is live with the draft; its overlay base_version was advanced to the
    // page's current version so a retry does not phantom-conflict on it.
    const pageA = (
      await testDb.drizzle.select().from(schema.pages).where(eq(schema.pages.id, PAGE_ID))
    )[0];
    expect(pageA.title).toBe('A-new');
    const overlayA = (
      await testDb.drizzle
        .select()
        .from(schema.editSessionDocs)
        .where(
          and(
            eq(schema.editSessionDocs.sessionId, sessionId),
            eq(schema.editSessionDocs.docId, PAGE_ID),
          ),
        )
    )[0];
    expect(overlayA.baseVersion).toBe(pageA.version);

    // Resolve the page-2 conflict: reconcile its overlay base_version to the live
    // version (what a client does after reviewing the concurrent change), clear the
    // injected failures, and retry. Publish must now converge with no wedge.
    const pageBLive = (
      await testDb.drizzle.select().from(schema.pages).where(eq(schema.pages.id, PAGE_B))
    )[0];
    await testDb.drizzle
      .update(schema.editSessionDocs)
      .set({ baseVersion: pageBLive.version })
      .where(
        and(
          eq(schema.editSessionDocs.sessionId, sessionId),
          eq(schema.editSessionDocs.docId, PAGE_B),
        ),
      );
    raceControl.bumpBeforePublish = null;
    raceControl.failRestore = false;

    const retry = await app.request(`/sessions/${sessionId}/publish`, { method: 'POST' });
    expect(retry.status).toBe(200);
    const session = (
      await testDb.drizzle
        .select()
        .from(schema.editSessions)
        .where(eq(schema.editSessions.id, sessionId))
    )[0];
    expect(session.status).toBe('published');
    const pageBFinal = (
      await testDb.drizzle.select().from(schema.pages).where(eq(schema.pages.id, PAGE_B))
    )[0];
    expect(pageBFinal.title).toBe('B-new');
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

    const res = await app.request(`/sessions/${sessionId}/discard`, { method: 'POST' });
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
    expect((await app.request(`/sessions/${sessionId}/discard`, { method: 'POST' })).status).toBe(
      409,
    );
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
      { method: 'POST', url: `/sessions/${sessionId}/discard` },
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
