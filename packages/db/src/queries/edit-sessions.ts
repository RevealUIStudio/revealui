/**
 * Edit session database queries
 *
 * Typed data-access for the visual-edit-sessions engine: sessions, draft
 * overlays, the append-only event log, and the publish-path page writes.
 *
 * The publish path deliberately owns its own snapshot write (direct insert into
 * `page_revisions`) rather than routing through core's snapshot operation, per
 * the note in `core/collections/operations/snapshot.ts`.
 */

import { and, asc, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import {
  type EditSession,
  type EditSessionDoc,
  type EditSessionEvent,
  editSessionDocs,
  editSessionEvents,
  editSessions,
} from '../schema/edit-sessions.js';
import { type Page, pageRevisions, pages } from '../schema/pages.js';

// =============================================================================
// Sessions
// =============================================================================

export async function createEditSession(
  db: Database,
  data: { id: string; siteId: string; title: string; createdBy: string | null },
): Promise<EditSession | null> {
  const result = await db.insert(editSessions).values(data).returning();
  return result[0] ?? null;
}

export async function getEditSessionById(db: Database, id: string): Promise<EditSession | null> {
  const result = await db.select().from(editSessions).where(eq(editSessions.id, id)).limit(1);
  return result[0] ?? null;
}

export async function listEditSessions(
  db: Database,
  filter: { status?: string; siteId?: string } = {},
): Promise<EditSession[]> {
  const conditions = [
    ...(filter.status ? [eq(editSessions.status, filter.status)] : []),
    ...(filter.siteId ? [eq(editSessions.siteId, filter.siteId)] : []),
  ];
  const query = db.select().from(editSessions);
  const scoped = conditions.length > 0 ? query.where(and(...conditions)) : query;
  return scoped.orderBy(desc(editSessions.createdAt));
}

export async function setEditSessionStatus(
  db: Database,
  id: string,
  data: { status: string; publishedAt?: Date | null },
): Promise<EditSession | null> {
  const result = await db
    .update(editSessions)
    .set({ status: data.status, publishedAt: data.publishedAt ?? null, updatedAt: new Date() })
    .where(eq(editSessions.id, id))
    .returning();
  return result[0] ?? null;
}

// =============================================================================
// Draft overlays
// =============================================================================

export async function getSessionDoc(
  db: Database,
  sessionId: string,
  docType: string,
  docId: string,
): Promise<EditSessionDoc | null> {
  const result = await db
    .select()
    .from(editSessionDocs)
    .where(
      and(
        eq(editSessionDocs.sessionId, sessionId),
        eq(editSessionDocs.docType, docType),
        eq(editSessionDocs.docId, docId),
      ),
    )
    .limit(1);
  return result[0] ?? null;
}

export async function getSessionDocs(db: Database, sessionId: string): Promise<EditSessionDoc[]> {
  return db
    .select()
    .from(editSessionDocs)
    .where(eq(editSessionDocs.sessionId, sessionId))
    .orderBy(asc(editSessionDocs.docType), asc(editSessionDocs.docId));
}

export async function insertSessionDoc(
  db: Database,
  data: {
    id: string;
    sessionId: string;
    docType: string;
    docId: string;
    draft: Record<string, unknown>;
    baseVersion: number;
    updatedBy: string | null;
  },
): Promise<EditSessionDoc | null> {
  const result = await db.insert(editSessionDocs).values(data).returning();
  return result[0] ?? null;
}

export async function updateSessionDocDraft(
  db: Database,
  id: string,
  data: { draft: Record<string, unknown>; updatedBy: string | null },
): Promise<EditSessionDoc | null> {
  const result = await db
    .update(editSessionDocs)
    .set({ draft: data.draft, updatedBy: data.updatedBy, updatedAt: new Date() })
    .where(eq(editSessionDocs.id, id))
    .returning();
  return result[0] ?? null;
}

// =============================================================================
// Events (append-only)
// =============================================================================

export async function insertSessionEvent(
  db: Database,
  data: {
    sessionId: string;
    actorId: string | null;
    actorKind: string;
    type: string;
    payload?: Record<string, unknown> | null;
  },
): Promise<EditSessionEvent | null> {
  const result = await db
    .insert(editSessionEvents)
    .values({
      sessionId: data.sessionId,
      actorId: data.actorId,
      actorKind: data.actorKind,
      type: data.type,
      payload: data.payload ?? null,
    })
    .returning();
  return result[0] ?? null;
}

/** Most-recent events first (route reverses to chronological for display). */
export async function getRecentSessionEvents(
  db: Database,
  sessionId: string,
  limit: number,
): Promise<EditSessionEvent[]> {
  return db
    .select()
    .from(editSessionEvents)
    .where(eq(editSessionEvents.sessionId, sessionId))
    .orderBy(desc(editSessionEvents.id))
    .limit(limit);
}

/** Events strictly after `afterId`, id-ordered ascending. */
export async function getSessionEventsAfter(
  db: Database,
  sessionId: string,
  afterId: number,
  limit: number,
): Promise<EditSessionEvent[]> {
  return db
    .select()
    .from(editSessionEvents)
    .where(and(eq(editSessionEvents.sessionId, sessionId), gt(editSessionEvents.id, afterId)))
    .orderBy(asc(editSessionEvents.id))
    .limit(limit);
}

// =============================================================================
// Publish-path page writes (edit-session-owned snapshot path)
// =============================================================================

export async function getLivePage(db: Database, pageId: string): Promise<Page | null> {
  const result = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, pageId), isNull(pages.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Optimistically write a draft over a live page: only succeeds when the page's
 * current version still equals `expectedVersion`, bumping it by one. Returns the
 * updated row, or null when the guard missed (a concurrent writer moved on).
 */
export async function publishDraftToPage(
  db: Database,
  data: {
    pageId: string;
    expectedVersion: number;
    title: string;
    blocks: unknown[] | null;
    seo: unknown;
    publishedAt: Date;
  },
): Promise<Page | null> {
  const result = await db
    .update(pages)
    .set({
      title: data.title,
      blocks: data.blocks,
      seo: data.seo,
      version: data.expectedVersion + 1,
      status: 'published',
      publishedAt: data.publishedAt,
      updatedAt: new Date(),
    })
    .where(and(eq(pages.id, data.pageId), eq(pages.version, data.expectedVersion)))
    .returning();
  return result[0] ?? null;
}

export async function nextPageRevisionNumber(db: Database, pageId: string): Promise<number> {
  const rows = await db
    .select({ n: pageRevisions.revisionNumber })
    .from(pageRevisions)
    .where(eq(pageRevisions.pageId, pageId))
    .orderBy(desc(pageRevisions.revisionNumber))
    .limit(1);
  return (rows[0]?.n ?? 0) + 1;
}

export async function insertPageRevision(
  db: Database,
  data: {
    id: string;
    pageId: string;
    createdBy: string | null;
    revisionNumber: number;
    title: string;
    blocks: unknown[] | null;
    seo: unknown;
    changeDescription: string | null;
  },
): Promise<void> {
  await db.insert(pageRevisions).values(data);
}

/** Retain the newest `keep` revisions for a page; delete any older ones. */
export async function prunePageRevisions(
  db: Database,
  pageId: string,
  keep: number,
): Promise<number> {
  const stale = await db
    .select({ id: pageRevisions.id })
    .from(pageRevisions)
    .where(eq(pageRevisions.pageId, pageId))
    .orderBy(desc(pageRevisions.revisionNumber))
    .offset(keep);
  if (stale.length === 0) return 0;
  await db.delete(pageRevisions).where(
    inArray(
      pageRevisions.id,
      stale.map((r) => r.id),
    ),
  );
  return stale.length;
}

/**
 * Compensating write for a mid-flight publish conflict: restore a page to its
 * exact pre-publish row (content + status + publishedAt + the ORIGINAL version),
 * guarded on the version this session set. Resetting the version to the original
 * means a clean compensation leaves the page byte-identical to before the attempt
 * (nothing published), so a later retry's optimistic pre-flight passes without a
 * phantom conflict. Returns the row, or null if the guard missed (page moved
 * again  -  that doc stays published and the caller reports it).
 */
export async function restorePageContent(
  db: Database,
  data: { pageId: string; expectedVersion: number; original: Page },
): Promise<Page | null> {
  const result = await db
    .update(pages)
    .set({
      title: data.original.title,
      blocks: data.original.blocks,
      seo: data.original.seo,
      status: data.original.status,
      publishedAt: data.original.publishedAt,
      version: data.original.version,
      updatedAt: new Date(),
    })
    .where(and(eq(pages.id, data.pageId), eq(pages.version, data.expectedVersion)))
    .returning();
  return result[0] ?? null;
}

export async function deletePageRevisionById(db: Database, revisionId: string): Promise<void> {
  await db.delete(pageRevisions).where(eq(pageRevisions.id, revisionId));
}

/**
 * Advance an overlay's `base_version` to a page's current version. Used when a
 * mid-flight conflict leaves a doc published (compensation missed): the overlay
 * must track the version this session already produced so a retry's pre-flight
 * does not report a phantom conflict on the session's own write.
 */
export async function setSessionDocBaseVersion(
  db: Database,
  docId: string,
  baseVersion: number,
): Promise<EditSessionDoc | null> {
  const result = await db
    .update(editSessionDocs)
    .set({ baseVersion, updatedAt: new Date() })
    .where(eq(editSessionDocs.id, docId))
    .returning();
  return result[0] ?? null;
}
