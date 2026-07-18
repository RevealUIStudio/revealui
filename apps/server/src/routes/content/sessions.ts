/**
 * Edit session API routes  -  the visual-edit-sessions engine (P1 slice 1).
 *
 * An edit session is a durable draft workspace over live content docs. Editors
 * open a session, patch draft overlays (autosave), then publish atomically or
 * discard. Every action appends to an auditable event log.
 *
 * Phase-1 slice: `doc_type` `page` is fully implemented. `global` / `post`
 * overlays are accepted by the schema but PATCH / publish reject them with a
 * clear 400 until a later slice.
 *
 * SECURITY: every route here exposes DRAFT content, so every route  -  GETs
 * included  -  requires an authenticated user holding the content `update`
 * permission. The `/api/content/*` mount only gates POST/PATCH/DELETE by verb;
 * GET is public-read there, so these routes enforce authz explicitly.
 */

import * as sessionQueries from '@revealui/db/queries/edit-sessions';
import * as siteQueries from '@revealui/db/queries/sites';
import type { EditSession, EditSessionDoc, EditSessionEvent, Page } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { authorizationSystem } from '../../middleware/authorization.js';
import { IdParam } from '../_helpers/content-schemas.js';
import { dateToString, nullableDateToString } from '../_helpers/serialize.js';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

const MAX_REVISIONS_PER_DOC = 50;
const RECENT_EVENTS_LIMIT = 50;
const EVENTS_PAGE_LIMIT = 200;

// =============================================================================
// Authz  -  draft exposure requires an authenticated content editor everywhere
// =============================================================================

interface SessionUser {
  id: string;
  role: string;
}

/** Require an authenticated user holding content:update. Throws 401 / 403. */
function requireContentEditor(user: SessionUser | undefined): SessionUser {
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  if (!authorizationSystem.hasPermission([user.role], 'content', 'update')) {
    throw new HTTPException(403, { message: 'Permission denied: content:update' });
  }
  return user;
}

function actorKindFor(user: SessionUser): 'human' | 'agent' {
  return user.role === 'agent' ? 'agent' : 'human';
}

// =============================================================================
// Typed draft patch setter (no regex, prototype-pollution guarded)
// =============================================================================

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isArrayIndex(segment: string): boolean {
  if (segment.length === 0) return false;
  for (let i = 0; i < segment.length; i++) {
    const code = segment.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

function readChild(container: Record<string, unknown> | unknown[], segment: string): unknown {
  if (Array.isArray(container)) {
    return isArrayIndex(segment) ? container[Number(segment)] : undefined;
  }
  return container[segment];
}

function writeChild(
  container: Record<string, unknown> | unknown[],
  segment: string,
  value: unknown,
): void {
  if (Array.isArray(container)) {
    if (!isArrayIndex(segment)) {
      throw new HTTPException(400, { message: `Expected an array index, got '${segment}'` });
    }
    container[Number(segment)] = value;
    return;
  }
  container[segment] = value;
}

/** Set `value` at a dot/array path inside a draft, creating intermediate containers. */
function setAtPath(draft: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  for (const segment of segments) {
    if (segment.length === 0) {
      throw new HTTPException(400, { message: 'Patch path has an empty segment' });
    }
    if (DANGEROUS_KEYS.has(segment)) {
      throw new HTTPException(400, { message: `Illegal path segment: ${segment}` });
    }
  }

  let cursor: Record<string, unknown> | unknown[] = draft;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextIsIndex = isArrayIndex(segments[i + 1]);
    let child = readChild(cursor, segment);
    if (child === null || typeof child !== 'object') {
      child = nextIsIndex ? [] : {};
      writeChild(cursor, segment, child);
    }
    cursor = child as Record<string, unknown> | unknown[];
  }
  writeChild(cursor, segments[segments.length - 1], value);
}

/**
 * Build the initial draft overlay from a live page. This is a FULL editable-doc
 * snapshot (title + blocks + seo all captured), so at publish time the
 * `draft.title/blocks/seo` fallbacks to the live page are belt-and-braces only  -
 * a materialized draft always carries these fields.
 */
function materializePageDraft(page: Page): Record<string, unknown> {
  return {
    id: page.id,
    siteId: page.siteId,
    parentId: page.parentId,
    templateId: page.templateId,
    title: page.title,
    slug: page.slug,
    path: page.path,
    status: page.status,
    blocks: page.blocks ?? [],
    seo: page.seo ?? null,
    version: page.version,
  };
}

/**
 * Undo the page writes from a failed publish attempt (called on a mid-flight
 * guard miss). For each already-written doc, restore its exact prior row, guarded
 * on the version this attempt set. A successful restore leaves the page identical
 * to before the attempt, so a retry's optimistic pre-flight passes and converges.
 * If a restore itself misses (the page moved again), that doc stays live: it is
 * returned so the caller can report it, and its overlay base_version is advanced
 * to the current version so the retry does not phantom-conflict on this session's
 * own write.
 */
async function compensatePublish(
  db: Parameters<typeof sessionQueries.restorePageContent>[0],
  written: Array<{ docId: string; overlayId: string; revisionId: string; original: Page }>,
): Promise<string[]> {
  const stillPublished: string[] = [];
  for (let i = written.length - 1; i >= 0; i--) {
    const w = written[i];
    const restored = await sessionQueries.restorePageContent(db, {
      pageId: w.docId,
      expectedVersion: w.original.version + 1,
      original: w.original,
    });
    if (restored) {
      await sessionQueries.deletePageRevisionById(db, w.revisionId);
    } else {
      stillPublished.push(w.docId);
      const current = await sessionQueries.getLivePage(db, w.docId);
      if (current) {
        await sessionQueries.setSessionDocBaseVersion(db, w.overlayId, current.version);
      }
    }
  }
  return stillPublished;
}

// =============================================================================
// Serializers + response schemas
// =============================================================================

const DateTime = z.string().openapi({ type: 'string', format: 'date-time' });

const SessionSchema = z
  .object({
    id: z.string(),
    siteId: z.string(),
    title: z.string(),
    status: z.string(),
    createdBy: z.string().nullable(),
    createdAt: DateTime,
    updatedAt: DateTime,
    publishedAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('EditSession');

const SessionDocSchema = z
  .object({
    id: z.string(),
    sessionId: z.string(),
    docType: z.string(),
    docId: z.string(),
    draft: z.unknown(),
    baseVersion: z.number(),
    updatedBy: z.string().nullable(),
    updatedAt: DateTime,
  })
  .openapi('EditSessionDoc');

const SessionEventSchema = z
  .object({
    id: z.number(),
    sessionId: z.string(),
    actorId: z.string().nullable(),
    actorKind: z.string(),
    type: z.string(),
    payload: z.unknown().nullable(),
    createdAt: DateTime,
  })
  .openapi('EditSessionEvent');

const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });
const ConflictSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  conflicts: z.array(z.record(z.string(), z.unknown())),
  // Present only when a mid-flight conflict left some docs live and compensation
  // could not fully revert them. Empty/absent means nothing was published.
  partiallyPublished: z.array(z.string()).optional(),
});

function serializeSession(row: EditSession): z.infer<typeof SessionSchema> {
  return {
    id: row.id,
    siteId: row.siteId,
    title: row.title,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: dateToString(row.createdAt),
    updatedAt: dateToString(row.updatedAt),
    publishedAt: nullableDateToString(row.publishedAt),
  };
}

function serializeDoc(row: EditSessionDoc): z.infer<typeof SessionDocSchema> {
  return {
    id: row.id,
    sessionId: row.sessionId,
    docType: row.docType,
    docId: row.docId,
    draft: row.draft,
    baseVersion: row.baseVersion,
    updatedBy: row.updatedBy,
    updatedAt: dateToString(row.updatedAt),
  };
}

function serializeEvent(row: EditSessionEvent): z.infer<typeof SessionEventSchema> {
  return {
    id: row.id,
    sessionId: row.sessionId,
    actorId: row.actorId,
    actorKind: row.actorKind,
    type: row.type,
    payload: row.payload ?? null,
    createdAt: dateToString(row.createdAt),
  };
}

// =============================================================================
// POST /sessions  -  open a session
// =============================================================================

app.openapi(
  createRoute({
    method: 'post',
    path: '/sessions',
    tags: ['content'],
    summary: 'Open an edit session',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({ siteId: z.string().min(1), title: z.string().min(1).max(500) }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: SessionSchema }),
          },
        },
        description: 'Session opened',
      },
      404: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Site not found',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = requireContentEditor(c.get('user'));
    const { siteId, title } = c.req.valid('json');

    const site = await siteQueries.getSiteById(db, siteId);
    if (!site) throw new HTTPException(404, { message: 'Site not found' });

    const id = crypto.randomUUID();
    const session = await sessionQueries.createEditSession(db, {
      id,
      siteId,
      title,
      createdBy: user.id,
    });
    if (!session) throw new HTTPException(500, { message: 'Failed to open session' });

    await sessionQueries.insertSessionEvent(db, {
      sessionId: id,
      actorId: user.id,
      actorKind: actorKindFor(user),
      type: 'opened',
      payload: { siteId, title },
    });

    return c.json({ success: true as const, data: serializeSession(session) }, 201);
  },
);

// =============================================================================
// GET /sessions  -  list (filter by status / site)
// =============================================================================

app.openapi(
  createRoute({
    method: 'get',
    path: '/sessions',
    tags: ['content'],
    summary: 'List edit sessions',
    request: {
      query: z.object({
        status: z.enum(['open', 'published', 'discarded']).optional(),
        siteId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(SessionSchema) }),
          },
        },
        description: 'Session list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    requireContentEditor(c.get('user'));
    const { status, siteId } = c.req.valid('query');
    const rows = await sessionQueries.listEditSessions(db, { status, siteId });
    return c.json({ success: true as const, data: rows.map(serializeSession) }, 200);
  },
);

// =============================================================================
// GET /sessions/:id  -  session + docs + recent events
// =============================================================================

app.openapi(
  createRoute({
    method: 'get',
    path: '/sessions/{id}',
    tags: ['content'],
    summary: 'Get an edit session with its docs and recent events',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.object({
                session: SessionSchema,
                docs: z.array(SessionDocSchema),
                events: z.array(SessionEventSchema),
              }),
            }),
          },
        },
        description: 'Session detail',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    requireContentEditor(c.get('user'));
    const { id } = c.req.valid('param');

    const session = await sessionQueries.getEditSessionById(db, id);
    if (!session) throw new HTTPException(404, { message: 'Session not found' });

    const docs = await sessionQueries.getSessionDocs(db, id);
    const recent = await sessionQueries.getRecentSessionEvents(db, id, RECENT_EVENTS_LIMIT);
    recent.reverse(); // chronological for display

    return c.json(
      {
        success: true as const,
        data: {
          session: serializeSession(session),
          docs: docs.map(serializeDoc),
          events: recent.map(serializeEvent),
        },
      },
      200,
    );
  },
);

// =============================================================================
// GET /sessions/:id/events  -  poll for events after a cursor (id-ordered)
// =============================================================================

app.openapi(
  createRoute({
    method: 'get',
    path: '/sessions/{id}/events',
    tags: ['content'],
    summary: 'Poll session events after a cursor',
    request: {
      params: IdParam,
      query: z.object({ after: z.coerce.number().int().nonnegative().optional() }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.array(SessionEventSchema),
              nextCursor: z.number(),
            }),
          },
        },
        description: 'Events after the cursor',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    requireContentEditor(c.get('user'));
    const { id } = c.req.valid('param');
    const { after } = c.req.valid('query');

    const session = await sessionQueries.getEditSessionById(db, id);
    if (!session) throw new HTTPException(404, { message: 'Session not found' });

    const cursor = after ?? 0;
    const events = await sessionQueries.getSessionEventsAfter(db, id, cursor, EVENTS_PAGE_LIMIT);
    const nextCursor = events.length > 0 ? events[events.length - 1].id : cursor;

    return c.json({ success: true as const, data: events.map(serializeEvent), nextCursor }, 200);
  },
);

// =============================================================================
// PATCH /sessions/:id/docs/:docType/:docId  -  field patch (autosave)
// =============================================================================

app.openapi(
  createRoute({
    method: 'patch',
    path: '/sessions/{id}/docs/{docType}/{docId}',
    tags: ['content'],
    summary: 'Patch a draft field in an edit session',
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: 'id', in: 'path' } }),
        docType: z.string().openapi({ param: { name: 'docType', in: 'path' } }),
        docId: z.string().openapi({ param: { name: 'docId', in: 'path' } }),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({ path: z.string().min(1), value: z.unknown() }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: SessionDocSchema }),
          },
        },
        description: 'Draft patched',
      },
      400: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Bad request' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
      409: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Session not open',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = requireContentEditor(c.get('user'));
    const { id, docType, docId } = c.req.valid('param');
    const { path, value } = c.req.valid('json');

    const session = await sessionQueries.getEditSessionById(db, id);
    if (!session) throw new HTTPException(404, { message: 'Session not found' });
    if (session.status !== 'open') {
      throw new HTTPException(409, { message: 'Session is not open' });
    }
    if (docType !== 'page') {
      throw new HTTPException(400, {
        message: `Editing '${docType}' docs is supported in a later slice`,
      });
    }

    let doc = await sessionQueries.getSessionDoc(db, id, docType, docId);
    if (!doc) {
      // First patch on this doc: materialize the overlay from the live page.
      const page = await sessionQueries.getLivePage(db, docId);
      if (!page) throw new HTTPException(404, { message: 'Page not found' });
      doc = await sessionQueries.insertSessionDoc(db, {
        id: crypto.randomUUID(),
        sessionId: id,
        docType,
        docId,
        draft: materializePageDraft(page),
        baseVersion: page.version,
        updatedBy: user.id,
      });
      if (!doc) throw new HTTPException(500, { message: 'Failed to materialize draft' });
    }

    const nextDraft = structuredClone(doc.draft);
    setAtPath(nextDraft, path, value);

    const updated = await sessionQueries.updateSessionDocDraft(db, doc.id, {
      draft: nextDraft,
      updatedBy: user.id,
    });
    if (!updated) throw new HTTPException(500, { message: 'Failed to save draft' });

    await sessionQueries.insertSessionEvent(db, {
      sessionId: id,
      actorId: user.id,
      actorKind: actorKindFor(user),
      type: 'patched',
      payload: { docType, docId, path },
    });

    return c.json({ success: true as const, data: serializeDoc(updated) }, 200);
  },
);

// =============================================================================
// POST /sessions/:id/publish  -  optimistic, all-or-nothing publish
// =============================================================================

app.openapi(
  createRoute({
    method: 'post',
    path: '/sessions/{id}/publish',
    tags: ['content'],
    summary: 'Publish an edit session',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: SessionSchema,
              publishedDocs: z.number(),
            }),
          },
        },
        description: 'Session published',
      },
      400: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Unsupported doc type',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
      409: {
        content: { 'application/json': { schema: ConflictSchema } },
        description: 'Version conflict or session not open',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = requireContentEditor(c.get('user'));
    const { id } = c.req.valid('param');

    const session = await sessionQueries.getEditSessionById(db, id);
    if (!session) throw new HTTPException(404, { message: 'Session not found' });
    if (session.status !== 'open') {
      throw new HTTPException(409, { message: 'Session is not open' });
    }

    const docs = await sessionQueries.getSessionDocs(db, id);

    const unsupported = docs.find((d) => d.docType !== 'page');
    if (unsupported) {
      throw new HTTPException(400, {
        message: `Publishing '${unsupported.docType}' docs is supported in a later slice`,
      });
    }

    const publishedAt = new Date();

    // Phase 1  -  read + verify every doc's base version before any write.
    // Any conflict fails the whole publish with per-doc detail (no partial publish).
    const live = new Map<string, Page>();
    const conflicts: Array<Record<string, unknown>> = [];
    for (const doc of docs) {
      const page = await sessionQueries.getLivePage(db, doc.docId);
      if (!page) {
        conflicts.push({ docType: doc.docType, docId: doc.docId, reason: 'not_found' });
        continue;
      }
      if (page.version !== doc.baseVersion) {
        conflicts.push({
          docType: doc.docType,
          docId: doc.docId,
          reason: 'version_conflict',
          baseVersion: doc.baseVersion,
          currentVersion: page.version,
        });
        continue;
      }
      live.set(doc.docId, page);
    }
    if (conflicts.length > 0) {
      return c.json({ success: false as const, error: 'publish_conflict', conflicts }, 409);
    }

    // Phase 2  -  guarded writes. Each update is version-guarded (WHERE version =
    // baseVersion); a guard miss means a writer slipped in after the read phase.
    // On a mid-flight miss we compensate the docs already written this attempt
    // (restore their exact prior row + delete the revision we inserted) so the
    // publish stays all-or-nothing. If a compensation write itself misses, that
    // doc stays live and is reported via `partiallyPublished`, and its overlay
    // base_version is advanced so a later retry does not phantom-conflict.
    const written: Array<{ docId: string; overlayId: string; revisionId: string; original: Page }> =
      [];
    for (const doc of docs) {
      const draft = doc.draft;
      const basePage = live.get(doc.docId) as Page;
      const title = typeof draft.title === 'string' ? draft.title : basePage.title;
      const blocks = Array.isArray(draft.blocks) ? (draft.blocks as unknown[]) : null;
      const seo = draft.seo ?? null;

      const updatedPage = await sessionQueries.publishDraftToPage(db, {
        pageId: doc.docId,
        expectedVersion: doc.baseVersion,
        title,
        blocks,
        seo,
        publishedAt,
      });
      if (!updatedPage) {
        const partiallyPublished = await compensatePublish(db, written);
        return c.json(
          {
            success: false as const,
            error: 'publish_conflict',
            conflicts: [{ docType: doc.docType, docId: doc.docId, reason: 'version_conflict' }],
            ...(partiallyPublished.length > 0 ? { partiallyPublished } : {}),
          },
          409,
        );
      }

      const revisionNumber = await sessionQueries.nextPageRevisionNumber(db, doc.docId);
      const revisionId = crypto.randomUUID();
      await sessionQueries.insertPageRevision(db, {
        id: revisionId,
        pageId: doc.docId,
        createdBy: user.id,
        revisionNumber,
        title: updatedPage.title,
        blocks: updatedPage.blocks ?? null,
        seo: updatedPage.seo ?? null,
        changeDescription: `Published via edit session ${id}`,
      });
      await sessionQueries.prunePageRevisions(db, doc.docId, MAX_REVISIONS_PER_DOC);
      written.push({ docId: doc.docId, overlayId: doc.id, revisionId, original: basePage });
    }

    const publishedSession = await sessionQueries.setEditSessionStatus(db, id, {
      status: 'published',
      publishedAt,
    });
    if (!publishedSession) throw new HTTPException(500, { message: 'Failed to publish session' });

    await sessionQueries.insertSessionEvent(db, {
      sessionId: id,
      actorId: user.id,
      actorKind: actorKindFor(user),
      type: 'published',
      payload: { docCount: docs.length },
    });

    return c.json(
      {
        success: true as const,
        data: serializeSession(publishedSession),
        publishedDocs: docs.length,
      },
      200,
    );
  },
);

// =============================================================================
// POST /sessions/:id/discard  -  discard (overlay rows retained for audit)
// =============================================================================
// A POST (not DELETE) so discard rides the content `update` permission like
// open / patch / publish. The `/api/content/*` mount maps DELETE -> content
// `delete` (admin only), which is wrong for abandoning your own draft.

app.openapi(
  createRoute({
    method: 'post',
    path: '/sessions/{id}/discard',
    tags: ['content'],
    summary: 'Discard an edit session',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: SessionSchema }),
          },
        },
        description: 'Session discarded',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
      409: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Session not open',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = requireContentEditor(c.get('user'));
    const { id } = c.req.valid('param');

    const session = await sessionQueries.getEditSessionById(db, id);
    if (!session) throw new HTTPException(404, { message: 'Session not found' });
    if (session.status !== 'open') {
      throw new HTTPException(409, { message: 'Session is not open' });
    }

    const discarded = await sessionQueries.setEditSessionStatus(db, id, {
      status: 'discarded',
      publishedAt: session.publishedAt,
    });
    if (!discarded) throw new HTTPException(500, { message: 'Failed to discard session' });

    await sessionQueries.insertSessionEvent(db, {
      sessionId: id,
      actorId: user.id,
      actorKind: actorKindFor(user),
      type: 'discarded',
      payload: null,
    });

    return c.json({ success: true as const, data: serializeSession(discarded) }, 200);
  },
);

export default app;
