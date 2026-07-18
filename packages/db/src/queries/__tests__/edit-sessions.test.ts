/**
 * Edit Session Query Tests
 *
 * Mirrors the mocking approach in `queries.test.ts`: a chainable mock of
 * Drizzle's fluent API, with per-verb resolved values set per test.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mock Helpers (same shape as queries.test.ts)
// ============================================================================

function createChainMock(resolvedValue: unknown = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'set',
    'values',
    'returning',
    'innerJoin',
    'groupBy',
  ];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = vi.fn((resolve?: (v: unknown) => unknown) => {
    return Promise.resolve(resolve ? resolve(resolvedValue) : resolvedValue);
  });
  return chain;
}

function createMockDb() {
  let selectResult: unknown = [];
  let insertResult: unknown = [];
  let updateResult: unknown = [];

  const db = {
    select: vi.fn((_fields?: unknown) => createChainMock(selectResult)),
    insert: vi.fn(() => createChainMock(insertResult)),
    update: vi.fn(() => createChainMock(updateResult)),
    delete: vi.fn(() => createChainMock(undefined)),
  };

  return {
    // biome-ignore lint/suspicious/noExplicitAny: mock db client needs to be cast
    db: db as any,
    setSelectResult(value: unknown) {
      selectResult = value;
    },
    setInsertResult(value: unknown) {
      insertResult = value;
    },
    setUpdateResult(value: unknown) {
      updateResult = value;
    },
  };
}

// ============================================================================
// Sessions
// ============================================================================

describe('edit-sessions queries: sessions', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('createEditSession inserts and returns the created row', async () => {
    const { createEditSession } = await import('../edit-sessions.js');
    const session = { id: 'es1', siteId: 's1', title: 'Homepage edit', createdBy: 'u1' };
    mock.setInsertResult([session]);

    const result = await createEditSession(mock.db, session);

    expect(result).toEqual(session);
    expect(mock.db.insert).toHaveBeenCalled();
  });

  it('createEditSession returns null when returning is empty', async () => {
    const { createEditSession } = await import('../edit-sessions.js');
    mock.setInsertResult([]);

    const result = await createEditSession(mock.db, {
      id: 'es1',
      siteId: 's1',
      title: 'x',
      createdBy: null,
    });

    expect(result).toBeNull();
  });

  it('getEditSessionById returns the session or null', async () => {
    const { getEditSessionById } = await import('../edit-sessions.js');
    mock.setSelectResult([{ id: 'es1' }]);

    expect(await getEditSessionById(mock.db, 'es1')).toEqual({ id: 'es1' });
  });

  it('getEditSessionById returns null when not found', async () => {
    const { getEditSessionById } = await import('../edit-sessions.js');
    mock.setSelectResult([]);

    expect(await getEditSessionById(mock.db, 'missing')).toBeNull();
  });

  it('listEditSessions returns all sessions with no filter', async () => {
    const { listEditSessions } = await import('../edit-sessions.js');
    const rows = [{ id: 'es1' }, { id: 'es2' }];
    mock.setSelectResult(rows);

    const result = await listEditSessions(mock.db);

    expect(result).toEqual(rows);
    expect(mock.db.select).toHaveBeenCalled();
  });

  it('listEditSessions filters by status only', async () => {
    const { listEditSessions } = await import('../edit-sessions.js');
    mock.setSelectResult([]);

    await listEditSessions(mock.db, { status: 'open' });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('listEditSessions filters by siteId only', async () => {
    const { listEditSessions } = await import('../edit-sessions.js');
    mock.setSelectResult([]);

    await listEditSessions(mock.db, { siteId: 's1' });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('listEditSessions filters by both status and siteId', async () => {
    const { listEditSessions } = await import('../edit-sessions.js');
    mock.setSelectResult([]);

    await listEditSessions(mock.db, { status: 'published', siteId: 's1' });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('setEditSessionStatus updates status and returns the row', async () => {
    const { setEditSessionStatus } = await import('../edit-sessions.js');
    const updated = { id: 'es1', status: 'published' };
    mock.setUpdateResult([updated]);

    const result = await setEditSessionStatus(mock.db, 'es1', { status: 'published' });

    expect(result).toEqual(updated);
    expect(mock.db.update).toHaveBeenCalled();
  });

  it('setEditSessionStatus accepts an explicit publishedAt', async () => {
    const { setEditSessionStatus } = await import('../edit-sessions.js');
    const publishedAt = new Date('2026-07-18T00:00:00Z');
    mock.setUpdateResult([{ id: 'es1', status: 'published', publishedAt }]);

    const result = await setEditSessionStatus(mock.db, 'es1', {
      status: 'published',
      publishedAt,
    });

    expect(result).toEqual({ id: 'es1', status: 'published', publishedAt });
  });

  it('setEditSessionStatus defaults publishedAt to null when omitted', async () => {
    const { setEditSessionStatus } = await import('../edit-sessions.js');
    mock.setUpdateResult([{ id: 'es1', status: 'discarded', publishedAt: null }]);

    const result = await setEditSessionStatus(mock.db, 'es1', { status: 'discarded' });

    expect(result).toEqual({ id: 'es1', status: 'discarded', publishedAt: null });
  });

  it('setEditSessionStatus returns null when the session does not exist', async () => {
    const { setEditSessionStatus } = await import('../edit-sessions.js');
    mock.setUpdateResult([]);

    const result = await setEditSessionStatus(mock.db, 'missing', { status: 'open' });

    expect(result).toBeNull();
  });
});

// ============================================================================
// Draft overlays
// ============================================================================

describe('edit-sessions queries: draft overlays', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('getSessionDoc returns the overlay or null', async () => {
    const { getSessionDoc } = await import('../edit-sessions.js');
    const doc = { id: 'd1', sessionId: 'es1', docType: 'page', docId: 'p1' };
    mock.setSelectResult([doc]);

    expect(await getSessionDoc(mock.db, 'es1', 'page', 'p1')).toEqual(doc);
  });

  it('getSessionDoc returns null when the doc has no overlay yet', async () => {
    const { getSessionDoc } = await import('../edit-sessions.js');
    mock.setSelectResult([]);

    expect(await getSessionDoc(mock.db, 'es1', 'page', 'p1')).toBeNull();
  });

  it('getSessionDocs returns all overlays for a session', async () => {
    const { getSessionDocs } = await import('../edit-sessions.js');
    const docs = [
      { id: 'd1', docType: 'page', docId: 'p1' },
      { id: 'd2', docType: 'post', docId: 'p2' },
    ];
    mock.setSelectResult(docs);

    expect(await getSessionDocs(mock.db, 'es1')).toEqual(docs);
  });

  it('getSessionDocs returns an empty array when no docs have been touched', async () => {
    const { getSessionDocs } = await import('../edit-sessions.js');
    mock.setSelectResult([]);

    expect(await getSessionDocs(mock.db, 'es1')).toEqual([]);
  });

  it('insertSessionDoc materializes a draft overlay (debut)', async () => {
    const { insertSessionDoc } = await import('../edit-sessions.js');
    const doc = {
      id: 'd1',
      sessionId: 'es1',
      docType: 'page',
      docId: 'p1',
      draft: { title: 'Draft' },
      baseVersion: 1,
      updatedBy: 'u1',
    };
    mock.setInsertResult([doc]);

    const result = await insertSessionDoc(mock.db, doc);

    expect(result).toEqual(doc);
    expect(mock.db.insert).toHaveBeenCalled();
  });

  it('insertSessionDoc returns null when returning is empty', async () => {
    const { insertSessionDoc } = await import('../edit-sessions.js');
    mock.setInsertResult([]);

    const result = await insertSessionDoc(mock.db, {
      id: 'd1',
      sessionId: 'es1',
      docType: 'page',
      docId: 'p1',
      draft: {},
      baseVersion: 1,
      updatedBy: null,
    });

    expect(result).toBeNull();
  });

  it('updateSessionDocDraft updates an existing overlay (upsert path)', async () => {
    const { updateSessionDocDraft } = await import('../edit-sessions.js');
    const updated = { id: 'd1', draft: { title: 'Updated' } };
    mock.setUpdateResult([updated]);

    const result = await updateSessionDocDraft(mock.db, 'd1', {
      draft: { title: 'Updated' },
      updatedBy: 'u1',
    });

    expect(result).toEqual(updated);
    expect(mock.db.update).toHaveBeenCalled();
  });

  it('updateSessionDocDraft returns null when the overlay does not exist', async () => {
    const { updateSessionDocDraft } = await import('../edit-sessions.js');
    mock.setUpdateResult([]);

    const result = await updateSessionDocDraft(mock.db, 'missing', {
      draft: {},
      updatedBy: null,
    });

    expect(result).toBeNull();
  });
});

// ============================================================================
// Events (append-only)
// ============================================================================

describe('edit-sessions queries: events', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('insertSessionEvent appends an event with a payload', async () => {
    const { insertSessionEvent } = await import('../edit-sessions.js');
    const event = {
      id: 1,
      sessionId: 'es1',
      actorId: 'u1',
      actorKind: 'human',
      type: 'patched',
      payload: { docId: 'p1' },
    };
    mock.setInsertResult([event]);

    const result = await insertSessionEvent(mock.db, {
      sessionId: 'es1',
      actorId: 'u1',
      actorKind: 'human',
      type: 'patched',
      payload: { docId: 'p1' },
    });

    expect(result).toEqual(event);
  });

  it('insertSessionEvent defaults payload to null when omitted', async () => {
    const { insertSessionEvent } = await import('../edit-sessions.js');
    const event = {
      id: 2,
      sessionId: 'es1',
      actorId: null,
      actorKind: 'agent',
      type: 'opened',
      payload: null,
    };
    mock.setInsertResult([event]);

    const result = await insertSessionEvent(mock.db, {
      sessionId: 'es1',
      actorId: null,
      actorKind: 'agent',
      type: 'opened',
    });

    expect(result).toEqual(event);
  });

  it('insertSessionEvent returns null when returning is empty', async () => {
    const { insertSessionEvent } = await import('../edit-sessions.js');
    mock.setInsertResult([]);

    const result = await insertSessionEvent(mock.db, {
      sessionId: 'es1',
      actorId: null,
      actorKind: 'agent',
      type: 'opened',
    });

    expect(result).toBeNull();
  });

  it('getRecentSessionEvents returns the most recent events up to the limit', async () => {
    const { getRecentSessionEvents } = await import('../edit-sessions.js');
    const events = [{ id: 3 }, { id: 2 }, { id: 1 }];
    mock.setSelectResult(events);

    const result = await getRecentSessionEvents(mock.db, 'es1', 3);

    expect(result).toEqual(events);
    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getRecentSessionEvents returns an empty array when the session has no events', async () => {
    const { getRecentSessionEvents } = await import('../edit-sessions.js');
    mock.setSelectResult([]);

    expect(await getRecentSessionEvents(mock.db, 'es1', 20)).toEqual([]);
  });

  it('getSessionEventsAfter returns events strictly after the given id', async () => {
    const { getSessionEventsAfter } = await import('../edit-sessions.js');
    const events = [{ id: 5 }, { id: 6 }];
    mock.setSelectResult(events);

    const result = await getSessionEventsAfter(mock.db, 'es1', 4, 50);

    expect(result).toEqual(events);
  });

  it('getSessionEventsAfter returns an empty array when there is nothing newer', async () => {
    const { getSessionEventsAfter } = await import('../edit-sessions.js');
    mock.setSelectResult([]);

    expect(await getSessionEventsAfter(mock.db, 'es1', 999, 50)).toEqual([]);
  });
});

// ============================================================================
// Publish-path page writes
// ============================================================================

describe('edit-sessions queries: publish-path page writes', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('getLivePage returns the page when it exists and is not deleted', async () => {
    const { getLivePage } = await import('../edit-sessions.js');
    const page = { id: 'p1', deletedAt: null };
    mock.setSelectResult([page]);

    expect(await getLivePage(mock.db, 'p1')).toEqual(page);
  });

  it('getLivePage returns null when the page is missing or deleted', async () => {
    const { getLivePage } = await import('../edit-sessions.js');
    mock.setSelectResult([]);

    expect(await getLivePage(mock.db, 'missing')).toBeNull();
  });

  it('publishDraftToPage bumps the version when the optimistic guard matches', async () => {
    const { publishDraftToPage } = await import('../edit-sessions.js');
    const published = { id: 'p1', version: 3, status: 'published' };
    mock.setUpdateResult([published]);

    const result = await publishDraftToPage(mock.db, {
      pageId: 'p1',
      expectedVersion: 2,
      title: 'New title',
      blocks: [{ type: 'text' }],
      seo: { title: 'SEO' },
      publishedAt: new Date('2026-07-18T00:00:00Z'),
    });

    expect(result).toEqual(published);
    expect(mock.db.update).toHaveBeenCalled();
  });

  it('publishDraftToPage returns null when a concurrent writer already moved the version', async () => {
    const { publishDraftToPage } = await import('../edit-sessions.js');
    mock.setUpdateResult([]);

    const result = await publishDraftToPage(mock.db, {
      pageId: 'p1',
      expectedVersion: 2,
      title: 'New title',
      blocks: null,
      seo: null,
      publishedAt: new Date('2026-07-18T00:00:00Z'),
    });

    expect(result).toBeNull();
  });

  it('nextPageRevisionNumber returns one past the latest revision', async () => {
    const { nextPageRevisionNumber } = await import('../edit-sessions.js');
    mock.setSelectResult([{ n: 4 }]);

    expect(await nextPageRevisionNumber(mock.db, 'p1')).toBe(5);
  });

  it('nextPageRevisionNumber starts at 1 when the page has no revisions yet', async () => {
    const { nextPageRevisionNumber } = await import('../edit-sessions.js');
    mock.setSelectResult([]);

    expect(await nextPageRevisionNumber(mock.db, 'p1')).toBe(1);
  });

  it('insertPageRevision inserts a revision row', async () => {
    const { insertPageRevision } = await import('../edit-sessions.js');

    await insertPageRevision(mock.db, {
      id: 'rev1',
      pageId: 'p1',
      createdBy: 'u1',
      revisionNumber: 1,
      title: 'Title',
      blocks: [],
      seo: null,
      changeDescription: 'Initial publish',
    });

    expect(mock.db.insert).toHaveBeenCalled();
  });

  it('prunePageRevisions deletes stale revisions beyond the retention count', async () => {
    const { prunePageRevisions } = await import('../edit-sessions.js');
    mock.setSelectResult([{ id: 'rev1' }, { id: 'rev2' }]);

    const result = await prunePageRevisions(mock.db, 'p1', 5);

    expect(result).toBe(2);
    expect(mock.db.delete).toHaveBeenCalled();
  });

  it('prunePageRevisions is a no-op when there is nothing to prune', async () => {
    const { prunePageRevisions } = await import('../edit-sessions.js');
    mock.setSelectResult([]);

    const result = await prunePageRevisions(mock.db, 'p1', 5);

    expect(result).toBe(0);
    expect(mock.db.delete).not.toHaveBeenCalled();
  });

  it('restorePageContent restores the page when the compensation guard matches', async () => {
    const { restorePageContent } = await import('../edit-sessions.js');
    const original = {
      id: 'p1',
      title: 'Original',
      blocks: [],
      seo: null,
      status: 'published',
      publishedAt: new Date('2026-07-17T00:00:00Z'),
      version: 2,
    };
    const restored = { ...original };
    mock.setUpdateResult([restored]);

    const result = await restorePageContent(mock.db, {
      pageId: 'p1',
      expectedVersion: 3,
      original: original as never,
    });

    expect(result).toEqual(restored);
    expect(mock.db.update).toHaveBeenCalled();
  });

  it('restorePageContent returns null when the version guard misses (page moved again)', async () => {
    const { restorePageContent } = await import('../edit-sessions.js');
    mock.setUpdateResult([]);

    const result = await restorePageContent(mock.db, {
      pageId: 'p1',
      expectedVersion: 3,
      original: { id: 'p1', title: 'Original', version: 2 } as never,
    });

    expect(result).toBeNull();
  });

  it('deletePageRevisionById deletes the revision', async () => {
    const { deletePageRevisionById } = await import('../edit-sessions.js');

    await deletePageRevisionById(mock.db, 'rev1');

    expect(mock.db.delete).toHaveBeenCalled();
  });

  it('setSessionDocBaseVersion advances the overlay base version', async () => {
    const { setSessionDocBaseVersion } = await import('../edit-sessions.js');
    const updated = { id: 'd1', baseVersion: 5 };
    mock.setUpdateResult([updated]);

    const result = await setSessionDocBaseVersion(mock.db, 'd1', 5);

    expect(result).toEqual(updated);
    expect(mock.db.update).toHaveBeenCalled();
  });

  it('setSessionDocBaseVersion returns null when the overlay does not exist', async () => {
    const { setSessionDocBaseVersion } = await import('../edit-sessions.js');
    mock.setUpdateResult([]);

    const result = await setSessionDocBaseVersion(mock.db, 'missing', 5);

    expect(result).toBeNull();
  });
});

// ============================================================================
// Module Exports Verification
// ============================================================================

describe('edit-sessions module exports', () => {
  it('exports all expected query functions', async () => {
    const mod = await import('../edit-sessions.js');
    expect(typeof mod.createEditSession).toBe('function');
    expect(typeof mod.getEditSessionById).toBe('function');
    expect(typeof mod.listEditSessions).toBe('function');
    expect(typeof mod.setEditSessionStatus).toBe('function');
    expect(typeof mod.getSessionDoc).toBe('function');
    expect(typeof mod.getSessionDocs).toBe('function');
    expect(typeof mod.insertSessionDoc).toBe('function');
    expect(typeof mod.updateSessionDocDraft).toBe('function');
    expect(typeof mod.insertSessionEvent).toBe('function');
    expect(typeof mod.getRecentSessionEvents).toBe('function');
    expect(typeof mod.getSessionEventsAfter).toBe('function');
    expect(typeof mod.getLivePage).toBe('function');
    expect(typeof mod.publishDraftToPage).toBe('function');
    expect(typeof mod.nextPageRevisionNumber).toBe('function');
    expect(typeof mod.insertPageRevision).toBe('function');
    expect(typeof mod.prunePageRevisions).toBe('function');
    expect(typeof mod.restorePageContent).toBe('function');
    expect(typeof mod.deletePageRevisionById).toBe('function');
    expect(typeof mod.setSessionDocBaseVersion).toBe('function');
  });
});
