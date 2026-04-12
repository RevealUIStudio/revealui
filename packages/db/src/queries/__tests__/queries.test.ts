/**
 * Database Query Builder Tests
 *
 * Consolidated tests for all query modules in packages/db/src/queries/.
 * Each query function accepts a DatabaseClient as first argument, so we
 * mock the Drizzle chainable API directly without vi.mock().
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Creates a chainable mock that mirrors Drizzle's fluent query API.
 * Every method returns the chain itself so callers can chain arbitrarily:
 *   db.select().from(table).where(cond).orderBy(col).limit(n).offset(n)
 *
 * The resolved value is controlled by `resolvedValue`.
 */
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
  // The chain is also a thenable that resolves to the value (Drizzle queries
  // are awaitable). We simulate this by making the chain itself return the
  // resolvedValue when awaited via `.then()`.
  chain.then = vi.fn((resolve?: (v: unknown) => unknown) => {
    return Promise.resolve(resolve ? resolve(resolvedValue) : resolvedValue);
  });
  return chain;
}

/**
 * Builds a mock DatabaseClient. Each call to select/insert/update/delete
 * returns a fresh chainable mock whose resolved value can be overridden via
 * the returned controller helpers.
 */
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
    /** Set what `select()...` chains resolve to. */
    setSelectResult(value: unknown) {
      selectResult = value;
    },
    /** Set what `insert()...returning()` chains resolve to. */
    setInsertResult(value: unknown) {
      insertResult = value;
    },
    /** Set what `update()...returning()` chains resolve to. */
    setUpdateResult(value: unknown) {
      updateResult = value;
    },
  };
}

// ============================================================================
// Posts
// ============================================================================

describe('posts queries', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('getAllPosts returns rows with default pagination', async () => {
    const { getAllPosts } = await import('../posts.js');
    const rows = [{ id: '1', title: 'Hello' }];
    mock.setSelectResult(rows);

    const result = await getAllPosts(mock.db);

    expect(result).toEqual(rows);
    expect(mock.db.select).toHaveBeenCalled();
  }, 15_000);

  it('getAllPosts passes status and authorId filters', async () => {
    const { getAllPosts } = await import('../posts.js');
    mock.setSelectResult([]);

    await getAllPosts(mock.db, { status: 'published', authorId: 'user-1' });

    expect(mock.db.select).toHaveBeenCalled();
  }, 15_000);

  it('getAllPosts respects custom limit and offset', async () => {
    const { getAllPosts } = await import('../posts.js');
    mock.setSelectResult([]);

    await getAllPosts(mock.db, { limit: 5, offset: 10 });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getPostById returns first row or null', async () => {
    const { getPostById } = await import('../posts.js');
    const row = { id: 'p1', title: 'Test' };
    mock.setSelectResult([row]);

    const result = await getPostById(mock.db, 'p1');

    expect(result).toEqual(row);
  });

  it('getPostById returns null when no rows', async () => {
    const { getPostById } = await import('../posts.js');
    mock.setSelectResult([]);

    const result = await getPostById(mock.db, 'nonexistent');

    expect(result).toBeNull();
  });

  it('getPostBySlug returns first row or null', async () => {
    const { getPostBySlug } = await import('../posts.js');
    mock.setSelectResult([{ id: 'p1', slug: 'hello' }]);

    const result = await getPostBySlug(mock.db, 'hello');

    expect(result).toEqual({ id: 'p1', slug: 'hello' });
  });

  it('getPostBySlug returns null when not found', async () => {
    const { getPostBySlug } = await import('../posts.js');
    mock.setSelectResult([]);

    const result = await getPostBySlug(mock.db, 'missing');

    expect(result).toBeNull();
  });

  it('createPost inserts and returns the created row', async () => {
    const { createPost } = await import('../posts.js');
    const newPost = { id: 'p1', title: 'New', slug: 'new', authorId: 'u1' };
    mock.setInsertResult([newPost]);

    const result = await createPost(mock.db, newPost as never);

    expect(result).toEqual(newPost);
    expect(mock.db.insert).toHaveBeenCalled();
  });

  it('createPost returns null when returning is empty', async () => {
    const { createPost } = await import('../posts.js');
    mock.setInsertResult([]);

    const result = await createPost(mock.db, {} as never);

    expect(result).toBeNull();
  });

  it('updatePost updates and returns the updated row', async () => {
    const { updatePost } = await import('../posts.js');
    const updated = { id: 'p1', title: 'Updated' };
    mock.setUpdateResult([updated]);

    const result = await updatePost(mock.db, 'p1', { title: 'Updated' } as never);

    expect(result).toEqual(updated);
    expect(mock.db.update).toHaveBeenCalled();
  });

  it('updatePost returns null when row not found', async () => {
    const { updatePost } = await import('../posts.js');
    mock.setUpdateResult([]);

    const result = await updatePost(mock.db, 'nonexistent', {} as never);

    expect(result).toBeNull();
  });

  it('deletePost soft-deletes by calling update on the db', async () => {
    const { deletePost } = await import('../posts.js');

    await deletePost(mock.db, 'p1');

    expect(mock.db.update).toHaveBeenCalled();
  });
});

// ============================================================================
// Pages
// ============================================================================

describe('pages queries', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('getPagesBySite returns pages for a site', async () => {
    const { getPagesBySite } = await import('../pages.js');
    const rows = [{ id: 'pg1', siteId: 's1', path: '/about' }];
    mock.setSelectResult(rows);

    const result = await getPagesBySite(mock.db, 's1');

    expect(result).toEqual(rows);
  });

  it('getPagesBySite filters by status when provided', async () => {
    const { getPagesBySite } = await import('../pages.js');
    mock.setSelectResult([]);

    await getPagesBySite(mock.db, 's1', { status: 'published' });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getPageById returns page or null', async () => {
    const { getPageById } = await import('../pages.js');
    mock.setSelectResult([{ id: 'pg1' }]);

    const result = await getPageById(mock.db, 'pg1');

    expect(result).toEqual({ id: 'pg1' });
  });

  it('getPageById returns null when not found', async () => {
    const { getPageById } = await import('../pages.js');
    mock.setSelectResult([]);

    const result = await getPageById(mock.db, 'missing');

    expect(result).toBeNull();
  });

  it('getPageByPath returns page by siteId and path', async () => {
    const { getPageByPath } = await import('../pages.js');
    const page = { id: 'pg1', siteId: 's1', path: '/home' };
    mock.setSelectResult([page]);

    const result = await getPageByPath(mock.db, 's1', '/home');

    expect(result).toEqual(page);
  });

  it('getPageByPath returns null when not found', async () => {
    const { getPageByPath } = await import('../pages.js');
    mock.setSelectResult([]);

    const result = await getPageByPath(mock.db, 's1', '/nonexistent');

    expect(result).toBeNull();
  });

  it('createPage inserts and returns the page', async () => {
    const { createPage } = await import('../pages.js');
    const data = { id: 'pg1', siteId: 's1', path: '/new', title: 'New' };
    mock.setInsertResult([data]);

    const result = await createPage(mock.db, data as never);

    expect(result).toEqual(data);
    // pageCount is maintained by DB trigger  -  no app-level update expected
    expect(mock.db.update).not.toHaveBeenCalled();
  });

  it('updatePage updates and returns the page', async () => {
    const { updatePage } = await import('../pages.js');
    const updated = { id: 'pg1', title: 'Updated' };
    mock.setUpdateResult([updated]);

    const result = await updatePage(mock.db, 'pg1', { title: 'Updated' } as never);

    expect(result).toEqual(updated);
  });

  it('updatePage returns null when not found', async () => {
    const { updatePage } = await import('../pages.js');
    mock.setUpdateResult([]);

    const result = await updatePage(mock.db, 'missing', {} as never);

    expect(result).toBeNull();
  });

  it('deletePage soft-deletes a page', async () => {
    const { deletePage } = await import('../pages.js');
    mock.setSelectResult([{ id: 'pg1', siteId: 's1' }]);

    await deletePage(mock.db, 'pg1');

    expect(mock.db.select).toHaveBeenCalled();
    // only the soft-delete update; pageCount handled by DB trigger
    expect(mock.db.update).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Sites
// ============================================================================

describe('sites queries', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('getAllSites returns sites with default pagination', async () => {
    const { getAllSites } = await import('../sites.js');
    const rows = [{ id: 's1', name: 'My Site' }];
    mock.setSelectResult(rows);

    const result = await getAllSites(mock.db);

    expect(result).toEqual(rows);
  });

  it('getAllSites filters by ownerId and status', async () => {
    const { getAllSites } = await import('../sites.js');
    mock.setSelectResult([]);

    await getAllSites(mock.db, { ownerId: 'u1', status: 'active' });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getAllSites respects limit and offset', async () => {
    const { getAllSites } = await import('../sites.js');
    mock.setSelectResult([]);

    await getAllSites(mock.db, { limit: 10, offset: 20 });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getSiteById returns site or null', async () => {
    const { getSiteById } = await import('../sites.js');
    mock.setSelectResult([{ id: 's1' }]);

    expect(await getSiteById(mock.db, 's1')).toEqual({ id: 's1' });
  });

  it('getSiteById returns null when not found', async () => {
    const { getSiteById } = await import('../sites.js');
    mock.setSelectResult([]);

    expect(await getSiteById(mock.db, 'missing')).toBeNull();
  });

  it('getSiteBySlug returns site or null', async () => {
    const { getSiteBySlug } = await import('../sites.js');
    mock.setSelectResult([{ id: 's1', slug: 'my-site' }]);

    expect(await getSiteBySlug(mock.db, 'my-site')).toEqual({ id: 's1', slug: 'my-site' });
  });

  it('getSiteBySlug returns null when not found', async () => {
    const { getSiteBySlug } = await import('../sites.js');
    mock.setSelectResult([]);

    expect(await getSiteBySlug(mock.db, 'missing')).toBeNull();
  });

  it('createSite inserts and returns the site', async () => {
    const { createSite } = await import('../sites.js');
    const data = { id: 's1', name: 'New', slug: 'new', ownerId: 'u1' };
    mock.setInsertResult([data]);

    expect(await createSite(mock.db, data as never)).toEqual(data);
  });

  it('updateSite updates and returns the site', async () => {
    const { updateSite } = await import('../sites.js');
    const updated = { id: 's1', name: 'Updated' };
    mock.setUpdateResult([updated]);

    expect(await updateSite(mock.db, 's1', { name: 'Updated' } as never)).toEqual(updated);
  });

  it('updateSite returns null when not found', async () => {
    const { updateSite } = await import('../sites.js');
    mock.setUpdateResult([]);

    expect(await updateSite(mock.db, 'missing', {} as never)).toBeNull();
  });

  it('deleteSite calls update for soft-delete', async () => {
    const { deleteSite } = await import('../sites.js');

    await deleteSite(mock.db, 's1');

    expect(mock.db.update).toHaveBeenCalled();
  });
});

// ============================================================================
// Media
// ============================================================================

describe('media queries', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('getAllMedia returns media with defaults', async () => {
    const { getAllMedia } = await import('../media.js');
    const rows = [{ id: 'm1', filename: 'photo.jpg' }];
    mock.setSelectResult(rows);

    const result = await getAllMedia(mock.db);

    expect(result).toEqual(rows);
  });

  it('getAllMedia filters by mimeType prefix', async () => {
    const { getAllMedia } = await import('../media.js');
    mock.setSelectResult([]);

    await getAllMedia(mock.db, { mimeType: 'image/' });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getAllMedia respects limit and offset', async () => {
    const { getAllMedia } = await import('../media.js');
    mock.setSelectResult([]);

    await getAllMedia(mock.db, { limit: 5, offset: 10 });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getMediaById returns media or null', async () => {
    const { getMediaById } = await import('../media.js');
    mock.setSelectResult([{ id: 'm1' }]);

    expect(await getMediaById(mock.db, 'm1')).toEqual({ id: 'm1' });
  });

  it('getMediaById returns null when not found', async () => {
    const { getMediaById } = await import('../media.js');
    mock.setSelectResult([]);

    expect(await getMediaById(mock.db, 'missing')).toBeNull();
  });

  it('createMedia inserts and returns the media', async () => {
    const { createMedia } = await import('../media.js');
    const data = { id: 'm1', filename: 'photo.jpg', mimeType: 'image/jpeg' };
    mock.setInsertResult([data]);

    expect(await createMedia(mock.db, data as never)).toEqual(data);
  });

  it('createMedia returns null when returning is empty', async () => {
    const { createMedia } = await import('../media.js');
    mock.setInsertResult([]);

    expect(await createMedia(mock.db, {} as never)).toBeNull();
  });

  it('updateMedia updates and returns the media', async () => {
    const { updateMedia } = await import('../media.js');
    const updated = { id: 'm1', alt: 'Updated alt' };
    mock.setUpdateResult([updated]);

    expect(await updateMedia(mock.db, 'm1', { alt: 'Updated alt' } as never)).toEqual(updated);
  });

  it('updateMedia returns null when not found', async () => {
    const { updateMedia } = await import('../media.js');
    mock.setUpdateResult([]);

    expect(await updateMedia(mock.db, 'missing', {} as never)).toBeNull();
  });

  it('deleteMedia soft-deletes by calling update on the db', async () => {
    const { deleteMedia } = await import('../media.js');

    await deleteMedia(mock.db, 'm1');

    expect(mock.db.update).toHaveBeenCalled();
  });
});

// ============================================================================
// Tickets
// ============================================================================

describe('tickets queries', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('getTicketsByBoard returns tickets for a board', async () => {
    const { getTicketsByBoard } = await import('../tickets.js');
    const rows = [{ id: 't1', boardId: 'b1', title: 'Bug fix' }];
    mock.setSelectResult(rows);

    const result = await getTicketsByBoard(mock.db, 'b1');

    expect(result).toEqual(rows);
  });

  it('getTicketsByBoard applies all filters', async () => {
    const { getTicketsByBoard } = await import('../tickets.js');
    mock.setSelectResult([]);

    await getTicketsByBoard(mock.db, 'b1', {
      status: 'open',
      priority: 'high',
      type: 'bug',
      assigneeId: 'u1',
      columnId: 'col1',
    });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getTicketsByBoard works without filters', async () => {
    const { getTicketsByBoard } = await import('../tickets.js');
    mock.setSelectResult([]);

    await getTicketsByBoard(mock.db, 'b1');

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getTicketById returns ticket or null', async () => {
    const { getTicketById } = await import('../tickets.js');
    mock.setSelectResult([{ id: 't1' }]);

    expect(await getTicketById(mock.db, 't1')).toEqual({ id: 't1' });
  });

  it('getTicketById returns null when not found', async () => {
    const { getTicketById } = await import('../tickets.js');
    mock.setSelectResult([]);

    expect(await getTicketById(mock.db, 'missing')).toBeNull();
  });

  it('getTicketByNumber returns ticket by board and number', async () => {
    const { getTicketByNumber } = await import('../tickets.js');
    const ticket = { id: 't1', boardId: 'b1', ticketNumber: 42 };
    mock.setSelectResult([ticket]);

    expect(await getTicketByNumber(mock.db, 'b1', 42)).toEqual(ticket);
  });

  it('getTicketByNumber returns null when not found', async () => {
    const { getTicketByNumber } = await import('../tickets.js');
    mock.setSelectResult([]);

    expect(await getTicketByNumber(mock.db, 'b1', 999)).toBeNull();
  });

  it('createTicket uses atomic insert with subquery for ticket number', async () => {
    const { createTicket } = await import('../tickets.js');
    const createdTicket = { id: 't1', ticketNumber: 6, title: 'New' };

    // Atomic: only insert, no separate select for MAX
    mock.setInsertResult([createdTicket]);

    const result = await createTicket(mock.db, {
      id: 't1',
      boardId: 'b1',
      title: 'New',
    });

    expect(result).toEqual(createdTicket);
    expect(mock.db.select).not.toHaveBeenCalled();
    expect(mock.db.insert).toHaveBeenCalled();
  });

  it('updateTicket updates and returns the ticket', async () => {
    const { updateTicket } = await import('../tickets.js');
    const updated = { id: 't1', title: 'Updated' };
    mock.setUpdateResult([updated]);

    expect(await updateTicket(mock.db, 't1', { title: 'Updated' })).toEqual(updated);
  });

  it('updateTicket returns null when not found', async () => {
    const { updateTicket } = await import('../tickets.js');
    mock.setUpdateResult([]);

    expect(await updateTicket(mock.db, 'missing', {})).toBeNull();
  });

  it('deleteTicket calls delete on the db', async () => {
    const { deleteTicket } = await import('../tickets.js');

    await deleteTicket(mock.db, 't1');

    expect(mock.db.delete).toHaveBeenCalled();
  });

  it('moveTicket updates column and sort order', async () => {
    const { moveTicket } = await import('../tickets.js');
    const moved = { id: 't1', columnId: 'col2', sortOrder: 3 };
    mock.setUpdateResult([moved]);

    const result = await moveTicket(mock.db, 't1', 'col2', 3);

    expect(result).toEqual(moved);
    expect(mock.db.update).toHaveBeenCalled();
  });

  it('moveTicket returns null when ticket not found', async () => {
    const { moveTicket } = await import('../tickets.js');
    mock.setUpdateResult([]);

    expect(await moveTicket(mock.db, 'missing', 'col1', 0)).toBeNull();
  });

  it('getSubtickets returns child tickets', async () => {
    const { getSubtickets } = await import('../tickets.js');
    const children = [{ id: 'sub1' }, { id: 'sub2' }];
    mock.setSelectResult(children);

    const result = await getSubtickets(mock.db, 't1');

    expect(result).toEqual(children);
  });

  it('getSubtickets returns empty array when none exist', async () => {
    const { getSubtickets } = await import('../tickets.js');
    mock.setSelectResult([]);

    expect(await getSubtickets(mock.db, 't1')).toEqual([]);
  });

  it('getTicketsByColumn returns tickets in a column', async () => {
    const { getTicketsByColumn } = await import('../tickets.js');
    const rows = [{ id: 't1', columnId: 'col1' }];
    mock.setSelectResult(rows);

    expect(await getTicketsByColumn(mock.db, 'col1')).toEqual(rows);
  });

  it('getOverdueTickets returns overdue tickets for a board', async () => {
    const { getOverdueTickets } = await import('../tickets.js');
    const overdue = [{ id: 't1', dueDate: '2024-01-01' }];
    mock.setSelectResult(overdue);

    expect(await getOverdueTickets(mock.db, 'b1')).toEqual(overdue);
  });
});

// ============================================================================
// Ticket Comments
// ============================================================================

describe('ticket-comments queries', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('getCommentById returns comment or null', async () => {
    const { getCommentById } = await import('../ticket-comments.js');
    const comment = { id: 'c1', body: 'Hello' };
    mock.setSelectResult([comment]);

    expect(await getCommentById(mock.db, 'c1')).toEqual(comment);
  });

  it('getCommentById returns null when not found', async () => {
    const { getCommentById } = await import('../ticket-comments.js');
    mock.setSelectResult([]);

    expect(await getCommentById(mock.db, 'missing')).toBeNull();
  });

  it('getCommentsByTicket returns all comments for a ticket', async () => {
    const { getCommentsByTicket } = await import('../ticket-comments.js');
    const comments = [{ id: 'c1' }, { id: 'c2' }];
    mock.setSelectResult(comments);

    expect(await getCommentsByTicket(mock.db, 't1')).toEqual(comments);
  });

  it('getCommentsByTicket returns empty array when none', async () => {
    const { getCommentsByTicket } = await import('../ticket-comments.js');
    mock.setSelectResult([]);

    expect(await getCommentsByTicket(mock.db, 't1')).toEqual([]);
  });

  it('createComment inserts comment and increments ticket count', async () => {
    const { createComment } = await import('../ticket-comments.js');
    const data = { id: 'c1', ticketId: 't1', body: 'Test comment' };
    mock.setInsertResult([data]);

    const result = await createComment(mock.db, data);

    expect(result).toEqual(data);
    expect(mock.db.insert).toHaveBeenCalled();
    expect(mock.db.update).toHaveBeenCalled();
  });

  it('updateComment updates body and returns the comment', async () => {
    const { updateComment } = await import('../ticket-comments.js');
    const updated = { id: 'c1', body: 'Updated body' };
    mock.setUpdateResult([updated]);

    expect(await updateComment(mock.db, 'c1', { body: 'Updated body' })).toEqual(updated);
  });

  it('updateComment returns null when not found', async () => {
    const { updateComment } = await import('../ticket-comments.js');
    mock.setUpdateResult([]);

    expect(await updateComment(mock.db, 'missing', { body: 'x' })).toBeNull();
  });

  it('deleteComment deletes comment and decrements ticket count', async () => {
    const { deleteComment } = await import('../ticket-comments.js');
    // First select fetches the ticketId, then delete runs, then update decrements
    mock.setSelectResult([{ ticketId: 't1' }]);

    await deleteComment(mock.db, 'c1');

    expect(mock.db.select).toHaveBeenCalled();
    expect(mock.db.delete).toHaveBeenCalled();
    expect(mock.db.update).toHaveBeenCalled();
  });

  it('deleteComment skips decrement when comment not found', async () => {
    const { deleteComment } = await import('../ticket-comments.js');
    mock.setSelectResult([]);

    await deleteComment(mock.db, 'nonexistent');

    expect(mock.db.delete).toHaveBeenCalled();
    // update should not be called since comment[0] is undefined
    expect(mock.db.update).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Ticket Labels
// ============================================================================

describe('ticket-labels queries', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('getLabelById returns label or null', async () => {
    const { getLabelById } = await import('../ticket-labels.js');
    const label = { id: 'l1', name: 'bug', color: '#ff0000' };
    mock.setSelectResult([label]);

    expect(await getLabelById(mock.db, 'l1')).toEqual(label);
  });

  it('getLabelById returns null when not found', async () => {
    const { getLabelById } = await import('../ticket-labels.js');
    mock.setSelectResult([]);

    expect(await getLabelById(mock.db, 'missing')).toBeNull();
  });

  it('getAllLabels returns all labels', async () => {
    const { getAllLabels } = await import('../ticket-labels.js');
    const labels = [
      { id: 'l1', name: 'bug' },
      { id: 'l2', name: 'feature' },
    ];
    mock.setSelectResult(labels);

    expect(await getAllLabels(mock.db)).toEqual(labels);
  });

  it('getAllLabels filters by tenantId when provided', async () => {
    const { getAllLabels } = await import('../ticket-labels.js');
    mock.setSelectResult([]);

    await getAllLabels(mock.db, 'tenant-1');

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('createLabel inserts and returns the label', async () => {
    const { createLabel } = await import('../ticket-labels.js');
    const data = { id: 'l1', name: 'bug', slug: 'bug', color: '#ff0000' };
    mock.setInsertResult([data]);

    expect(await createLabel(mock.db, data)).toEqual(data);
  });

  it('updateLabel updates and returns the label', async () => {
    const { updateLabel } = await import('../ticket-labels.js');
    const updated = { id: 'l1', name: 'Bug (critical)' };
    mock.setUpdateResult([updated]);

    expect(await updateLabel(mock.db, 'l1', { name: 'Bug (critical)' })).toEqual(updated);
  });

  it('updateLabel returns null when not found', async () => {
    const { updateLabel } = await import('../ticket-labels.js');
    mock.setUpdateResult([]);

    expect(await updateLabel(mock.db, 'missing', { name: 'x' })).toBeNull();
  });

  it('deleteLabel calls delete on the db', async () => {
    const { deleteLabel } = await import('../ticket-labels.js');

    await deleteLabel(mock.db, 'l1');

    expect(mock.db.delete).toHaveBeenCalled();
  });

  it('assignLabel inserts a label assignment', async () => {
    const { assignLabel } = await import('../ticket-labels.js');
    const data = { id: 'a1', ticketId: 't1', labelId: 'l1' };
    mock.setInsertResult([data]);

    expect(await assignLabel(mock.db, data)).toEqual(data);
  });

  it('removeLabel deletes a label assignment', async () => {
    const { removeLabel } = await import('../ticket-labels.js');

    await removeLabel(mock.db, 't1', 'l1');

    expect(mock.db.delete).toHaveBeenCalled();
  });

  it('getLabelsForTicket returns labels via join', async () => {
    const { getLabelsForTicket } = await import('../ticket-labels.js');
    const labels = [{ label: { id: 'l1', name: 'bug' } }, { label: { id: 'l2', name: 'urgent' } }];
    mock.setSelectResult(labels);

    const result = await getLabelsForTicket(mock.db, 't1');

    // The function maps (a) => a.label
    expect(result).toEqual([
      { id: 'l1', name: 'bug' },
      { id: 'l2', name: 'urgent' },
    ]);
  });

  it('getLabelsForTicket returns empty array when none assigned', async () => {
    const { getLabelsForTicket } = await import('../ticket-labels.js');
    mock.setSelectResult([]);

    expect(await getLabelsForTicket(mock.db, 't1')).toEqual([]);
  });
});

// ============================================================================
// Boards
// ============================================================================

describe('boards queries', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('getAllBoards returns all boards', async () => {
    const { getAllBoards } = await import('../boards.js');
    const rows = [{ id: 'b1', name: 'Sprint Board' }];
    mock.setSelectResult(rows);

    expect(await getAllBoards(mock.db)).toEqual(rows);
  });

  it('getAllBoards filters by tenantId when provided', async () => {
    const { getAllBoards } = await import('../boards.js');
    mock.setSelectResult([]);

    await getAllBoards(mock.db, 'tenant-1');

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getBoardById returns board or null', async () => {
    const { getBoardById } = await import('../boards.js');
    mock.setSelectResult([{ id: 'b1' }]);

    expect(await getBoardById(mock.db, 'b1')).toEqual({ id: 'b1' });
  });

  it('getBoardById returns null when not found', async () => {
    const { getBoardById } = await import('../boards.js');
    mock.setSelectResult([]);

    expect(await getBoardById(mock.db, 'missing')).toBeNull();
  });

  it('getBoardBySlug returns board by slug', async () => {
    const { getBoardBySlug } = await import('../boards.js');
    mock.setSelectResult([{ id: 'b1', slug: 'sprint' }]);

    expect(await getBoardBySlug(mock.db, 'sprint')).toEqual({ id: 'b1', slug: 'sprint' });
  });

  it('getBoardBySlug filters by tenantId when provided', async () => {
    const { getBoardBySlug } = await import('../boards.js');
    mock.setSelectResult([]);

    await getBoardBySlug(mock.db, 'sprint', 'tenant-1');

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getBoardBySlug returns null when not found', async () => {
    const { getBoardBySlug } = await import('../boards.js');
    mock.setSelectResult([]);

    expect(await getBoardBySlug(mock.db, 'missing')).toBeNull();
  });

  it('createBoard inserts board and creates default columns', async () => {
    const { createBoard } = await import('../boards.js');
    const board = { id: 'b1', name: 'New Board', slug: 'new-board' };
    mock.setInsertResult([board]);

    const result = await createBoard(mock.db, board);

    expect(result).toEqual(board);
    // insert called twice: once for board, once for columns
    expect(mock.db.insert).toHaveBeenCalledTimes(2);
  });

  it('createBoard does not create columns if board insert returns empty', async () => {
    const { createBoard } = await import('../boards.js');
    mock.setInsertResult([]);

    // If result[0] is undefined, board is undefined, no columns created
    const result = await createBoard(mock.db, {
      id: 'b1',
      name: 'Test',
      slug: 'test',
    });

    expect(result).toBeUndefined();
    // insert called once for the board, but not for columns
    expect(mock.db.insert).toHaveBeenCalledTimes(1);
  });

  it('updateBoard updates and returns the board', async () => {
    const { updateBoard } = await import('../boards.js');
    const updated = { id: 'b1', name: 'Updated Board' };
    mock.setUpdateResult([updated]);

    expect(await updateBoard(mock.db, 'b1', { name: 'Updated Board' })).toEqual(updated);
  });

  it('updateBoard returns null when not found', async () => {
    const { updateBoard } = await import('../boards.js');
    mock.setUpdateResult([]);

    expect(await updateBoard(mock.db, 'missing', {})).toBeNull();
  });

  it('deleteBoard calls delete on the db', async () => {
    const { deleteBoard } = await import('../boards.js');

    await deleteBoard(mock.db, 'b1');

    expect(mock.db.delete).toHaveBeenCalled();
  });

  it('getColumnById returns column or null', async () => {
    const { getColumnById } = await import('../boards.js');
    mock.setSelectResult([{ id: 'col1', name: 'To Do' }]);

    expect(await getColumnById(mock.db, 'col1')).toEqual({ id: 'col1', name: 'To Do' });
  });

  it('getColumnById returns null when not found', async () => {
    const { getColumnById } = await import('../boards.js');
    mock.setSelectResult([]);

    expect(await getColumnById(mock.db, 'missing')).toBeNull();
  });

  it('getColumnsByBoard returns columns for a board', async () => {
    const { getColumnsByBoard } = await import('../boards.js');
    const cols = [{ id: 'col1' }, { id: 'col2' }];
    mock.setSelectResult(cols);

    expect(await getColumnsByBoard(mock.db, 'b1')).toEqual(cols);
  });

  it('createColumn inserts and returns the column', async () => {
    const { createColumn } = await import('../boards.js');
    const data = { id: 'col1', boardId: 'b1', name: 'Done', slug: 'done', position: 4 };
    mock.setInsertResult([data]);

    expect(await createColumn(mock.db, data)).toEqual(data);
  });

  it('updateColumn updates and returns the column', async () => {
    const { updateColumn } = await import('../boards.js');
    const updated = { id: 'col1', name: 'Updated' };
    mock.setUpdateResult([updated]);

    expect(await updateColumn(mock.db, 'col1', { name: 'Updated' })).toEqual(updated);
  });

  it('updateColumn returns null when not found', async () => {
    const { updateColumn } = await import('../boards.js');
    mock.setUpdateResult([]);

    expect(await updateColumn(mock.db, 'missing', {})).toBeNull();
  });

  it('deleteColumn calls delete on the db', async () => {
    const { deleteColumn } = await import('../boards.js');

    await deleteColumn(mock.db, 'col1');

    expect(mock.db.delete).toHaveBeenCalled();
  });
});

// ============================================================================
// Code Provenance
// ============================================================================

describe('code-provenance queries', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
  });

  it('getProvenanceByFile returns provenance records for a file', async () => {
    const { getProvenanceByFile } = await import('../code-provenance.js');
    const rows = [{ id: 'p1', filePath: 'src/index.ts' }];
    mock.setSelectResult(rows);

    expect(await getProvenanceByFile(mock.db, 'src/index.ts')).toEqual(rows);
  });

  it('getProvenanceById returns record or null', async () => {
    const { getProvenanceById } = await import('../code-provenance.js');
    mock.setSelectResult([{ id: 'p1' }]);

    expect(await getProvenanceById(mock.db, 'p1')).toEqual({ id: 'p1' });
  });

  it('getProvenanceById returns null when not found', async () => {
    const { getProvenanceById } = await import('../code-provenance.js');
    mock.setSelectResult([]);

    expect(await getProvenanceById(mock.db, 'missing')).toBeNull();
  });

  it('getProvenanceByCommit returns records for a commit hash', async () => {
    const { getProvenanceByCommit } = await import('../code-provenance.js');
    const rows = [{ id: 'p1', gitCommitHash: 'abc123' }];
    mock.setSelectResult(rows);

    expect(await getProvenanceByCommit(mock.db, 'abc123')).toEqual(rows);
  });

  it('getUnreviewedProvenance returns unreviewed records', async () => {
    const { getUnreviewedProvenance } = await import('../code-provenance.js');
    const rows = [{ id: 'p1', reviewStatus: 'unreviewed' }];
    mock.setSelectResult(rows);

    expect(await getUnreviewedProvenance(mock.db)).toEqual(rows);
  });

  it('getUnreviewedProvenance applies authorType and filePathPrefix filters', async () => {
    const { getUnreviewedProvenance } = await import('../code-provenance.js');
    mock.setSelectResult([]);

    await getUnreviewedProvenance(mock.db, {
      authorType: 'ai',
      filePathPrefix: 'packages/',
    });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getAllProvenance returns all records with defaults', async () => {
    const { getAllProvenance } = await import('../code-provenance.js');
    const rows = [{ id: 'p1' }];
    mock.setSelectResult(rows);

    expect(await getAllProvenance(mock.db)).toEqual(rows);
  });

  it('getAllProvenance applies all filters', async () => {
    const { getAllProvenance } = await import('../code-provenance.js');
    mock.setSelectResult([]);

    await getAllProvenance(mock.db, {
      authorType: 'human',
      reviewStatus: 'approved',
      filePathPrefix: 'src/',
      limit: 50,
      offset: 10,
    });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getAllProvenance caps limit at 500', async () => {
    const { getAllProvenance } = await import('../code-provenance.js');
    mock.setSelectResult([]);

    // Internally: Math.min(1000, 500) = 500
    await getAllProvenance(mock.db, { limit: 1000 });

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('getAllProvenance uses default limit of 100 when not specified', async () => {
    const { getAllProvenance } = await import('../code-provenance.js');
    mock.setSelectResult([]);

    await getAllProvenance(mock.db);

    expect(mock.db.select).toHaveBeenCalled();
  });

  it('createProvenance inserts and returns the record', async () => {
    const { createProvenance } = await import('../code-provenance.js');
    const data = { id: 'p1', filePath: 'src/index.ts', authorType: 'human' };
    mock.setInsertResult([data]);

    expect(await createProvenance(mock.db, data)).toEqual(data);
  });

  it('createProvenance defaults metadata to empty object', async () => {
    const { createProvenance } = await import('../code-provenance.js');
    const data = { id: 'p1', filePath: 'src/index.ts', authorType: 'ai' };
    mock.setInsertResult([{ ...data, metadata: {} }]);

    const result = await createProvenance(mock.db, data);

    expect(result).toEqual({ ...data, metadata: {} });
    expect(mock.db.insert).toHaveBeenCalled();
  });

  it('updateProvenance updates and returns the record', async () => {
    const { updateProvenance } = await import('../code-provenance.js');
    const updated = { id: 'p1', reviewStatus: 'approved' };
    mock.setUpdateResult([updated]);

    expect(await updateProvenance(mock.db, 'p1', { reviewStatus: 'approved' })).toEqual(updated);
  });

  it('updateProvenance returns null when not found', async () => {
    const { updateProvenance } = await import('../code-provenance.js');
    mock.setUpdateResult([]);

    expect(await updateProvenance(mock.db, 'missing', {})).toBeNull();
  });

  it('updateReviewStatus updates review fields', async () => {
    const { updateReviewStatus } = await import('../code-provenance.js');
    const updated = { id: 'p1', reviewStatus: 'approved', reviewedBy: 'user-1' };
    mock.setUpdateResult([updated]);

    expect(await updateReviewStatus(mock.db, 'p1', 'approved', 'user-1')).toEqual(updated);
  });

  it('updateReviewStatus sets reviewedBy to null when not provided', async () => {
    const { updateReviewStatus } = await import('../code-provenance.js');
    mock.setUpdateResult([{ id: 'p1', reviewStatus: 'approved', reviewedBy: null }]);

    const result = await updateReviewStatus(mock.db, 'p1', 'approved');

    expect(result).toEqual({ id: 'p1', reviewStatus: 'approved', reviewedBy: null });
  });

  it('updateReviewStatus returns null when not found', async () => {
    const { updateReviewStatus } = await import('../code-provenance.js');
    mock.setUpdateResult([]);

    expect(await updateReviewStatus(mock.db, 'missing', 'approved')).toBeNull();
  });

  it('deleteProvenance calls delete on the db', async () => {
    const { deleteProvenance } = await import('../code-provenance.js');

    await deleteProvenance(mock.db, 'p1');

    expect(mock.db.delete).toHaveBeenCalled();
  });

  it('getProvenanceStats returns grouped stats', async () => {
    const { getProvenanceStats } = await import('../code-provenance.js');
    const byAuthorType = [
      { authorType: 'human', count: 10, totalLines: 500 },
      { authorType: 'ai', count: 5, totalLines: 200 },
    ];
    const _byReviewStatus = [
      { reviewStatus: 'approved', count: 8 },
      { reviewStatus: 'unreviewed', count: 7 },
    ];
    // getProvenanceStats calls select() twice, both resolve from the same mock
    // First call returns byAuthorType, second returns byReviewStatus
    // Since our mock returns the same value for all selects, we test the shape
    mock.setSelectResult(byAuthorType);

    const result = await getProvenanceStats(mock.db);

    expect(result).toHaveProperty('byAuthorType');
    expect(result).toHaveProperty('byReviewStatus');
    expect(mock.db.select).toHaveBeenCalledTimes(2);
  });

  it('getReviewsForProvenance returns reviews for a provenance record', async () => {
    const { getReviewsForProvenance } = await import('../code-provenance.js');
    const reviews = [{ id: 'r1', status: 'approved' }];
    mock.setSelectResult(reviews);

    expect(await getReviewsForProvenance(mock.db, 'p1')).toEqual(reviews);
  });

  it('createReview inserts and returns the review', async () => {
    const { createReview } = await import('../code-provenance.js');
    const data = {
      id: 'r1',
      provenanceId: 'p1',
      reviewType: 'manual',
      status: 'approved',
    };
    mock.setInsertResult([data]);

    expect(await createReview(mock.db, data)).toEqual(data);
  });

  it('createReview defaults metadata to empty object', async () => {
    const { createReview } = await import('../code-provenance.js');
    const data = {
      id: 'r1',
      provenanceId: 'p1',
      reviewType: 'automated',
      status: 'flagged',
    };
    mock.setInsertResult([{ ...data, metadata: {} }]);

    const result = await createReview(mock.db, data);

    expect(result).toEqual({ ...data, metadata: {} });
  });
});

// ============================================================================
// Module Exports Verification
// ============================================================================

describe('query module exports', () => {
  it('posts module exports all expected functions', async () => {
    const mod = await import('../posts.js');
    expect(typeof mod.getAllPosts).toBe('function');
    expect(typeof mod.getPostById).toBe('function');
    expect(typeof mod.getPostBySlug).toBe('function');
    expect(typeof mod.createPost).toBe('function');
    expect(typeof mod.updatePost).toBe('function');
    expect(typeof mod.deletePost).toBe('function');
  });

  it('pages module exports all expected functions', async () => {
    const mod = await import('../pages.js');
    expect(typeof mod.getPagesBySite).toBe('function');
    expect(typeof mod.getPageById).toBe('function');
    expect(typeof mod.getPageByPath).toBe('function');
    expect(typeof mod.createPage).toBe('function');
    expect(typeof mod.updatePage).toBe('function');
    expect(typeof mod.deletePage).toBe('function');
  });

  it('sites module exports all expected functions', async () => {
    const mod = await import('../sites.js');
    expect(typeof mod.getAllSites).toBe('function');
    expect(typeof mod.getSiteById).toBe('function');
    expect(typeof mod.getSiteBySlug).toBe('function');
    expect(typeof mod.createSite).toBe('function');
    expect(typeof mod.updateSite).toBe('function');
    expect(typeof mod.deleteSite).toBe('function');
  });

  it('media module exports all expected functions', async () => {
    const mod = await import('../media.js');
    expect(typeof mod.getAllMedia).toBe('function');
    expect(typeof mod.getMediaById).toBe('function');
    expect(typeof mod.createMedia).toBe('function');
    expect(typeof mod.updateMedia).toBe('function');
    expect(typeof mod.deleteMedia).toBe('function');
  });

  it('tickets module exports all expected functions', async () => {
    const mod = await import('../tickets.js');
    expect(typeof mod.getTicketsByBoard).toBe('function');
    expect(typeof mod.getTicketById).toBe('function');
    expect(typeof mod.getTicketByNumber).toBe('function');
    expect(typeof mod.createTicket).toBe('function');
    expect(typeof mod.updateTicket).toBe('function');
    expect(typeof mod.deleteTicket).toBe('function');
    expect(typeof mod.moveTicket).toBe('function');
    expect(typeof mod.getSubtickets).toBe('function');
    expect(typeof mod.getTicketsByColumn).toBe('function');
    expect(typeof mod.getOverdueTickets).toBe('function');
  });

  it('ticket-comments module exports all expected functions', async () => {
    const mod = await import('../ticket-comments.js');
    expect(typeof mod.getCommentById).toBe('function');
    expect(typeof mod.getCommentsByTicket).toBe('function');
    expect(typeof mod.createComment).toBe('function');
    expect(typeof mod.updateComment).toBe('function');
    expect(typeof mod.deleteComment).toBe('function');
  });

  it('ticket-labels module exports all expected functions', async () => {
    const mod = await import('../ticket-labels.js');
    expect(typeof mod.getLabelById).toBe('function');
    expect(typeof mod.getAllLabels).toBe('function');
    expect(typeof mod.createLabel).toBe('function');
    expect(typeof mod.updateLabel).toBe('function');
    expect(typeof mod.deleteLabel).toBe('function');
    expect(typeof mod.assignLabel).toBe('function');
    expect(typeof mod.removeLabel).toBe('function');
    expect(typeof mod.getLabelsForTicket).toBe('function');
  });

  it('boards module exports all expected functions', async () => {
    const mod = await import('../boards.js');
    expect(typeof mod.getAllBoards).toBe('function');
    expect(typeof mod.getBoardById).toBe('function');
    expect(typeof mod.getBoardBySlug).toBe('function');
    expect(typeof mod.createBoard).toBe('function');
    expect(typeof mod.updateBoard).toBe('function');
    expect(typeof mod.deleteBoard).toBe('function');
    expect(typeof mod.getColumnById).toBe('function');
    expect(typeof mod.getColumnsByBoard).toBe('function');
    expect(typeof mod.createColumn).toBe('function');
    expect(typeof mod.updateColumn).toBe('function');
    expect(typeof mod.deleteColumn).toBe('function');
  });

  it('code-provenance module exports all expected functions', async () => {
    const mod = await import('../code-provenance.js');
    expect(typeof mod.getProvenanceByFile).toBe('function');
    expect(typeof mod.getProvenanceById).toBe('function');
    expect(typeof mod.getProvenanceByCommit).toBe('function');
    expect(typeof mod.getUnreviewedProvenance).toBe('function');
    expect(typeof mod.getAllProvenance).toBe('function');
    expect(typeof mod.createProvenance).toBe('function');
    expect(typeof mod.updateProvenance).toBe('function');
    expect(typeof mod.updateReviewStatus).toBe('function');
    expect(typeof mod.deleteProvenance).toBe('function');
    expect(typeof mod.getProvenanceStats).toBe('function');
    expect(typeof mod.getReviewsForProvenance).toBe('function');
    expect(typeof mod.createReview).toBe('function');
  });
});
