/**
 * Tickets System Route Tests
 *
 * Covers Boards, Tickets, Columns, Comments, and Labels CRUD endpoints.
 * Critical focus: access control (IDOR prevention), tenant isolation,
 * and proper HTTP status codes for error conditions.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks (vi.hoisted) ---------------------------------------------------
// vi.mock() factories are hoisted above all const/let by Vitest. Use
// vi.hoisted() so mock objects live in the same hoisted scope, avoiding
// temporal-dead-zone errors.

const { mockBoardQueries, mockTicketQueries, mockCommentQueries, mockLabelQueries } = vi.hoisted(
  () => ({
    mockBoardQueries: {
      getAllBoards: vi.fn(),
      createBoard: vi.fn(),
      getBoardById: vi.fn(),
      updateBoard: vi.fn(),
      deleteBoard: vi.fn(),
      getColumnsByBoard: vi.fn(),
      createColumn: vi.fn(),
      getColumnById: vi.fn(),
      updateColumn: vi.fn(),
      deleteColumn: vi.fn(),
    },
    mockTicketQueries: {
      getTicketsByBoard: vi.fn(),
      createTicket: vi.fn(),
      getTicketById: vi.fn(),
      updateTicket: vi.fn(),
      deleteTicket: vi.fn(),
      moveTicket: vi.fn(),
      getSubtickets: vi.fn(),
    },
    mockCommentQueries: {
      getCommentsByTicket: vi.fn(),
      createComment: vi.fn(),
      getCommentById: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
    },
    mockLabelQueries: {
      getAllLabels: vi.fn(),
      createLabel: vi.fn(),
      getLabelById: vi.fn(),
      updateLabel: vi.fn(),
      deleteLabel: vi.fn(),
      assignLabel: vi.fn(),
      removeLabel: vi.fn(),
      getLabelsForTicket: vi.fn(),
    },
  }),
);

vi.mock('@revealui/db/queries/boards', () => mockBoardQueries);
vi.mock('@revealui/db/queries/tickets', () => mockTicketQueries);
vi.mock('@revealui/db/queries/ticket-comments', () => mockCommentQueries);
vi.mock('@revealui/db/queries/ticket-labels', () => mockLabelQueries);

vi.mock('@revealui/contracts/entities', () => ({
  TICKET_STATUSES: ['open', 'in_progress', 'in_review', 'done', 'closed'],
  TICKET_PRIORITIES: ['urgent', 'high', 'medium', 'low'],
  TICKET_TYPES: ['task', 'bug', 'feature', 'improvement', 'epic'],
}));

vi.mock('../../../lib/type-guards.js', () => ({
  asNonEmptyTuple: (arr: unknown[]) => arr,
}));

// --- Import under test ----------------------------------------------------

import type { DatabaseClient } from '@revealui/db/client';
import ticketsApp from '../tickets/index.js';

// --- Typed mock accessors -------------------------------------------------

const mb = mockBoardQueries;
const mt = mockTicketQueries;
const mc = mockCommentQueries;
const ml = mockLabelQueries;

// --- Fixtures -------------------------------------------------------------

const NOW = new Date().toISOString();

interface UserCtx {
  id: string;
  role: string;
}

const OWNER: UserCtx = { id: 'owner-1', role: 'member' };
const ADMIN: UserCtx = { id: 'admin-1', role: 'admin' };
const OTHER_USER: UserCtx = { id: 'other-user', role: 'member' };

function makeBoard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'board-1',
    name: 'Main Board',
    slug: 'main-board',
    description: null,
    ownerId: null,
    tenantId: null,
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeColumn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'col-1',
    boardId: 'board-1',
    name: 'To Do',
    slug: 'to-do',
    position: 0,
    wipLimit: null,
    color: null,
    isDefault: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    boardId: 'board-1',
    columnId: 'col-1',
    parentTicketId: null,
    ticketNumber: 1,
    title: 'Fix bug',
    description: null,
    status: 'open',
    priority: 'medium',
    type: 'task',
    assigneeId: null,
    reporterId: null,
    dueDate: null,
    estimatedEffort: null,
    sortOrder: 0,
    commentCount: 0,
    attachments: null,
    metadata: null,
    closedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comment-1',
    ticketId: 'ticket-1',
    authorId: null,
    body: { type: 'doc', content: [] },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeLabel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'label-1',
    name: 'bug',
    slug: 'bug',
    color: '#ff0000',
    description: null,
    tenantId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// --- App factory ----------------------------------------------------------

/**
 * Build a test app that injects user, db, and optional tenant into context,
 * mounts the tickets index app, and handles HTTPExceptions.
 */
function createApp(user: UserCtx | null = ADMIN, tenant?: { id: string }) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper -- Variables shape varies per endpoint
  const app = new Hono<{ Variables: any }>();
  app.use('*', async (c, next) => {
    c.set('db', {} as DatabaseClient);
    if (user) c.set('user', user);
    if (tenant) c.set('tenant', tenant);
    await next();
  });
  app.route('/', ticketsApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

// --- Request helpers ------------------------------------------------------

function post(body: unknown) {
  return {
    method: 'POST' as const,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  };
}

function patch(body: unknown) {
  return {
    method: 'PATCH' as const,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test helper -- response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

// --- Reset mocks between tests --------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ==========================================================================
// Board tests
// ==========================================================================

describe('Boards', () => {
  it('GET /boards -- returns board list', async () => {
    mb.getAllBoards.mockResolvedValue([makeBoard()] as never);
    const app = createApp();
    const res = await app.request('/boards');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('board-1');
  });

  it('POST /boards -- creates a board and sets ownerId from session user', async () => {
    mb.createBoard.mockResolvedValue(makeBoard({ ownerId: OWNER.id }) as never);
    const app = createApp(OWNER);
    const res = await app.request('/boards', post({ name: 'Main Board', slug: 'main-board' }));
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(mb.createBoard).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ownerId: OWNER.id }),
    );
  });

  it('GET /boards/:id -- returns board by ID', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    const app = createApp();
    const res = await app.request('/boards/board-1');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.id).toBe('board-1');
  });

  it('GET /boards/:id -- 404 when board does not exist', async () => {
    mb.getBoardById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/boards/no-board');
    expect(res.status).toBe(404);
  });

  it('GET /boards/:id -- owner/admin access: 403 for non-owner non-admin', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard({ ownerId: OWNER.id }) as never);
    const app = createApp(OTHER_USER);
    const res = await app.request('/boards/board-1');
    expect(res.status).toBe(403);
  });

  it('GET /boards/:id -- admin bypasses ownership check', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard({ ownerId: OWNER.id }) as never);
    const app = createApp(ADMIN);
    const res = await app.request('/boards/board-1');
    expect(res.status).toBe(200);
  });

  it('PATCH /boards/:id -- updates board', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mb.updateBoard.mockResolvedValue(makeBoard({ name: 'Updated' }) as never);
    const app = createApp();
    const res = await app.request('/boards/board-1', patch({ name: 'Updated' }));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.name).toBe('Updated');
  });

  it('PATCH /boards/:id -- 404 when board does not exist', async () => {
    mb.getBoardById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/boards/no-board', patch({ name: 'x' }));
    expect(res.status).toBe(404);
  });

  it('PATCH /boards/:id -- 404 when updateBoard returns null', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mb.updateBoard.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/boards/board-1', patch({ name: 'x' }));
    expect(res.status).toBe(404);
  });

  it('PATCH /boards/:id -- 403 for non-owner non-admin', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard({ ownerId: OWNER.id }) as never);
    const app = createApp(OTHER_USER);
    const res = await app.request('/boards/board-1', patch({ name: 'Hack' }));
    expect(res.status).toBe(403);
  });

  it('DELETE /boards/:id -- deletes board', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mb.deleteBoard.mockResolvedValue(undefined as never);
    const app = createApp();
    const res = await app.request('/boards/board-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Board deleted');
  });

  it('DELETE /boards/:id -- 403 for non-owner non-admin', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard({ ownerId: OWNER.id }) as never);
    const app = createApp(OTHER_USER);
    const res = await app.request('/boards/board-1', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('DELETE /boards/:id -- 404 for missing board', async () => {
    mb.getBoardById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/boards/no-board', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('GET /boards/:id -- tenant isolation: 403 when board tenant differs from request tenant', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard({ tenantId: 'tenant-a' }) as never);
    const app = createApp(ADMIN, { id: 'tenant-b' });
    const res = await app.request('/boards/board-1');
    expect(res.status).toBe(403);
  });
});

// ==========================================================================
// Ticket tests
// ==========================================================================

describe('Tickets', () => {
  it('GET /boards/:boardId/tickets -- returns ticket list for board', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.getTicketsByBoard.mockResolvedValue([makeTicket()] as never);
    const app = createApp();
    const res = await app.request('/boards/board-1/tickets');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.data[0].id).toBe('ticket-1');
  });

  it('GET /boards/:boardId/tickets -- 404 when board not found', async () => {
    mb.getBoardById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/boards/missing-board/tickets');
    expect(res.status).toBe(404);
  });

  it('GET /boards/:boardId/tickets -- 403 for non-owner non-admin on private board', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard({ ownerId: OWNER.id }) as never);
    mt.getTicketsByBoard.mockResolvedValue([] as never);
    const app = createApp(OTHER_USER);
    const res = await app.request('/boards/board-1/tickets');
    expect(res.status).toBe(403);
  });

  it('POST /boards/:boardId/tickets -- creates ticket', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.createTicket.mockResolvedValue(makeTicket() as never);
    const app = createApp();
    const res = await app.request('/boards/board-1/tickets', post({ title: 'Fix bug' }));
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Fix bug');
  });

  it('POST /boards/:boardId/tickets -- 400 when title is missing', async () => {
    const app = createApp();
    const res = await app.request('/boards/board-1/tickets', post({}));
    expect(res.status).toBe(400);
  });

  it('GET /tickets/:id -- returns ticket by ID', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    const app = createApp();
    const res = await app.request('/tickets/ticket-1');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.title).toBe('Fix bug');
  });

  it('GET /tickets/:id -- 404 for missing ticket', async () => {
    mt.getTicketById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/tickets/missing');
    expect(res.status).toBe(404);
  });

  it('PATCH /tickets/:id -- updates ticket', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'closed' }) as never);
    const app = createApp();
    const res = await app.request('/tickets/ticket-1', patch({ status: 'closed' }));
    expect(res.status).toBe(200);
  });

  it('PATCH /tickets/:id -- 404 when ticket not found', async () => {
    mt.getTicketById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/tickets/no-ticket', patch({ status: 'closed' }));
    expect(res.status).toBe(404);
  });

  it('PATCH /tickets/:id -- 404 when updateTicket returns null', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.updateTicket.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/tickets/ticket-1', patch({ status: 'closed' }));
    expect(res.status).toBe(404);
  });

  it('PATCH /tickets/:id -- dueDate: null clears the field', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.updateTicket.mockResolvedValue(makeTicket({ dueDate: null }) as never);
    const app = createApp();
    await app.request('/tickets/ticket-1', patch({ dueDate: null }));
    expect(mt.updateTicket).toHaveBeenCalledWith(
      expect.anything(),
      'ticket-1',
      expect.objectContaining({ dueDate: null }),
    );
  });

  it('DELETE /tickets/:id -- deletes ticket (admin user)', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.deleteTicket.mockResolvedValue(undefined as never);
    const app = createApp(ADMIN);
    const res = await app.request('/tickets/ticket-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.message).toBe('Ticket deleted');
  });

  it('DELETE /tickets/:id -- deletes ticket (board owner)', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard({ ownerId: OWNER.id }) as never);
    mt.deleteTicket.mockResolvedValue(undefined as never);
    const app = createApp(OWNER);
    const res = await app.request('/tickets/ticket-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
  });

  it('DELETE /tickets/:id -- 403 for non-owner non-admin', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard({ ownerId: 'someone-else' }) as never);
    const app = createApp(OTHER_USER);
    const res = await app.request('/tickets/ticket-1', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('POST /tickets/:id/move -- moves ticket to column', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.moveTicket.mockResolvedValue(makeTicket({ columnId: 'col-2' }) as never);
    const app = createApp();
    const res = await app.request(
      '/tickets/ticket-1/move',
      post({ columnId: 'col-2', sortOrder: 0 }),
    );
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.columnId).toBe('col-2');
  });

  it('POST /tickets/:id/move -- 404 when ticket not found', async () => {
    mt.getTicketById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/tickets/bad/move', post({ columnId: 'col-1', sortOrder: 0 }));
    expect(res.status).toBe(404);
  });

  it('POST /tickets/:id/move -- 404 when moveTicket returns null (ticket vanished)', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.moveTicket.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request(
      '/tickets/ticket-1/move',
      post({ columnId: 'col-2', sortOrder: 0 }),
    );
    expect(res.status).toBe(404);
    const body = await parseBody(res);
    expect(body.error).toContain('Ticket not found');
  });

  it('GET /tickets/:id/subtasks -- returns subtasks', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.getSubtickets.mockResolvedValue([
      makeTicket({ id: 'sub-1', parentTicketId: 'ticket-1' }),
    ] as never);
    const app = createApp();
    const res = await app.request('/tickets/ticket-1/subtasks');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data[0].parentTicketId).toBe('ticket-1');
  });
});

// ==========================================================================
// Column tests
// ==========================================================================

describe('Columns', () => {
  it('GET /boards/:boardId/columns -- returns columns for board', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mb.getColumnsByBoard.mockResolvedValue([makeColumn()] as never);
    const app = createApp();
    const res = await app.request('/boards/board-1/columns');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data[0].boardId).toBe('board-1');
  });

  it('POST /boards/:boardId/columns -- creates column', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mb.createColumn.mockResolvedValue(makeColumn() as never);
    const app = createApp();
    const res = await app.request(
      '/boards/board-1/columns',
      post({ name: 'To Do', slug: 'to-do', position: 0 }),
    );
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.data.name).toBe('To Do');
  });

  it('PATCH /columns/:id -- updates column', async () => {
    mb.getColumnById.mockResolvedValue(makeColumn() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mb.updateColumn.mockResolvedValue(makeColumn({ name: 'In Progress' }) as never);
    const app = createApp();
    const res = await app.request('/columns/col-1', patch({ name: 'In Progress' }));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.name).toBe('In Progress');
  });

  it('PATCH /columns/:id -- 404 for missing column', async () => {
    mb.getColumnById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/columns/no-col', patch({ name: 'x' }));
    expect(res.status).toBe(404);
  });

  it('PATCH /columns/:id -- 404 when updateColumn returns null', async () => {
    mb.getColumnById.mockResolvedValue(makeColumn() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mb.updateColumn.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/columns/col-1', patch({ name: 'x' }));
    expect(res.status).toBe(404);
  });

  it('DELETE /columns/:id -- deletes column', async () => {
    mb.getColumnById.mockResolvedValue(makeColumn() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mb.deleteColumn.mockResolvedValue(undefined as never);
    const app = createApp();
    const res = await app.request('/columns/col-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.message).toBe('Column deleted');
  });

  it('PATCH /columns/:id -- 404 when parent board is deleted', async () => {
    mb.getColumnById.mockResolvedValue(makeColumn() as never);
    mb.getBoardById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/columns/col-1', patch({ name: 'x' }));
    expect(res.status).toBe(404);
  });

  it('DELETE /columns/:id -- 404 when parent board is deleted', async () => {
    mb.getColumnById.mockResolvedValue(makeColumn() as never);
    mb.getBoardById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/columns/col-1', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('PATCH /columns/:id -- 403 for non-owner non-admin', async () => {
    mb.getColumnById.mockResolvedValue(makeColumn() as never);
    mb.getBoardById.mockResolvedValue(makeBoard({ ownerId: OWNER.id }) as never);
    const app = createApp(OTHER_USER);
    const res = await app.request('/columns/col-1', patch({ name: 'x' }));
    expect(res.status).toBe(403);
  });

  it('DELETE /columns/:id -- 403 for non-owner non-admin', async () => {
    mb.getColumnById.mockResolvedValue(makeColumn() as never);
    mb.getBoardById.mockResolvedValue(makeBoard({ ownerId: OWNER.id }) as never);
    const app = createApp(OTHER_USER);
    const res = await app.request('/columns/col-1', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('PATCH /columns/:id -- tenant isolation: 403 for wrong tenant', async () => {
    mb.getColumnById.mockResolvedValue(makeColumn() as never);
    mb.getBoardById.mockResolvedValue(makeBoard({ tenantId: 'tenant-a' }) as never);
    const app = createApp(OTHER_USER, { id: 'tenant-b' });
    const res = await app.request('/columns/col-1', patch({ name: 'x' }));
    expect(res.status).toBe(403);
  });
});

// ==========================================================================
// Comment tests
// ==========================================================================

describe('Comments', () => {
  it('GET /tickets/:id/comments -- returns comment list', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mc.getCommentsByTicket.mockResolvedValue([makeComment()] as never);
    const app = createApp();
    const res = await app.request('/tickets/ticket-1/comments');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data[0].ticketId).toBe('ticket-1');
  });

  it('POST /tickets/:id/comments -- creates comment', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mc.createComment.mockResolvedValue(makeComment() as never);
    const app = createApp();
    const res = await app.request('/tickets/ticket-1/comments', post({ body: { type: 'doc' } }));
    expect(res.status).toBe(201);
  });

  it('POST /tickets/:id/comments -- forces authorId to session user (ignores client-supplied)', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mc.createComment.mockResolvedValue(makeComment({ authorId: OWNER.id }) as never);
    const app = createApp(OWNER);
    const res = await app.request(
      '/tickets/ticket-1/comments',
      post({ body: { type: 'doc' }, authorId: 'attacker-id' }),
    );
    expect(res.status).toBe(201);
    expect(mc.createComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ authorId: OWNER.id }),
    );
  });

  it('PATCH /comments/:id -- updates comment', async () => {
    mc.getCommentById.mockResolvedValue(makeComment() as never);
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mc.updateComment.mockResolvedValue(makeComment() as never);
    const app = createApp();
    const res = await app.request('/comments/comment-1', patch({ body: { type: 'doc' } }));
    expect(res.status).toBe(200);
  });

  it('PATCH /comments/:id -- 404 for missing comment', async () => {
    mc.getCommentById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/comments/no-comment', patch({ body: { type: 'doc' } }));
    expect(res.status).toBe(404);
  });

  it('PATCH /comments/:id -- 404 when updateComment returns null', async () => {
    mc.getCommentById.mockResolvedValue(makeComment() as never);
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mc.updateComment.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/comments/comment-1', patch({ body: { type: 'doc' } }));
    expect(res.status).toBe(404);
  });

  it('PATCH /comments/:id -- 403 for non-author non-admin', async () => {
    mc.getCommentById.mockResolvedValue(makeComment({ authorId: 'author-1' }) as never);
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    const app = createApp(OTHER_USER);
    const res = await app.request('/comments/comment-1', patch({ body: { type: 'doc' } }));
    expect(res.status).toBe(403);
  });

  it('PATCH /comments/:id -- admin bypasses author check', async () => {
    mc.getCommentById.mockResolvedValue(makeComment({ authorId: 'author-1' }) as never);
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mc.updateComment.mockResolvedValue(makeComment() as never);
    const app = createApp(ADMIN);
    const res = await app.request('/comments/comment-1', patch({ body: { type: 'doc' } }));
    expect(res.status).toBe(200);
  });

  it('DELETE /comments/:id -- deletes comment', async () => {
    mc.getCommentById.mockResolvedValue(makeComment() as never);
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mc.deleteComment.mockResolvedValue(undefined as never);
    const app = createApp();
    const res = await app.request('/comments/comment-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.message).toBe('Comment deleted');
  });

  it('DELETE /comments/:id -- 404 for missing comment', async () => {
    mc.getCommentById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/comments/no-comment', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('DELETE /comments/:id -- 403 for non-author non-admin', async () => {
    mc.getCommentById.mockResolvedValue(makeComment({ authorId: 'author-1' }) as never);
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    const app = createApp(OTHER_USER);
    const res = await app.request('/comments/comment-1', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });
});

// ==========================================================================
// Label tests
// ==========================================================================

describe('Labels', () => {
  it('GET /labels -- returns label list', async () => {
    ml.getAllLabels.mockResolvedValue([makeLabel()] as never);
    const app = createApp();
    const res = await app.request('/labels');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data[0].name).toBe('bug');
  });

  it('POST /labels -- creates label', async () => {
    ml.createLabel.mockResolvedValue(makeLabel() as never);
    const app = createApp();
    const res = await app.request('/labels', post({ name: 'bug', slug: 'bug' }));
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
  });

  it('PATCH /labels/:id -- updates label', async () => {
    ml.getLabelById.mockResolvedValue(makeLabel() as never);
    ml.updateLabel.mockResolvedValue(makeLabel({ name: 'feature' }) as never);
    const app = createApp();
    const res = await app.request('/labels/label-1', patch({ name: 'feature' }));
    expect(res.status).toBe(200);
  });

  it('PATCH /labels/:id -- 404 for missing label', async () => {
    ml.getLabelById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/labels/no-label', patch({ name: 'x' }));
    expect(res.status).toBe(404);
  });

  it('PATCH /labels/:id -- 404 when updateLabel returns null', async () => {
    ml.getLabelById.mockResolvedValue(makeLabel() as never);
    ml.updateLabel.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/labels/label-1', patch({ name: 'x' }));
    expect(res.status).toBe(404);
  });

  it('DELETE /labels/:id -- deletes label', async () => {
    ml.getLabelById.mockResolvedValue(makeLabel() as never);
    ml.deleteLabel.mockResolvedValue(undefined as never);
    const app = createApp();
    const res = await app.request('/labels/label-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
  });

  it('DELETE /labels/:id -- 404 for missing label', async () => {
    ml.getLabelById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/labels/no-label', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('PATCH /labels/:id -- tenant isolation: 403 for wrong tenant', async () => {
    ml.getLabelById.mockResolvedValue(makeLabel({ tenantId: 'tenant-a' }) as never);
    const app = createApp(ADMIN, { id: 'tenant-b' });
    const res = await app.request('/labels/label-1', patch({ name: 'exploit' }));
    expect(res.status).toBe(403);
  });

  it('DELETE /labels/:id -- tenant isolation: 403 for wrong tenant', async () => {
    ml.getLabelById.mockResolvedValue(makeLabel({ tenantId: 'tenant-a' }) as never);
    const app = createApp(ADMIN, { id: 'tenant-b' });
    const res = await app.request('/labels/label-1', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('POST /tickets/:id/labels -- assigns label to ticket', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    ml.assignLabel.mockResolvedValue({
      id: 'assign-1',
      ticketId: 'ticket-1',
      labelId: 'label-1',
      assignedAt: new Date(),
    } as never);
    const app = createApp();
    const res = await app.request('/tickets/ticket-1/labels', post({ labelId: 'label-1' }));
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.data.labelId).toBe('label-1');
  });

  it('GET /tickets/:id/labels -- returns labels for ticket', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    ml.getLabelsForTicket.mockResolvedValue([makeLabel()] as never);
    const app = createApp();
    const res = await app.request('/tickets/ticket-1/labels');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data[0].name).toBe('bug');
  });

  it('DELETE /tickets/:id/labels/:labelId -- removes label from ticket', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    ml.removeLabel.mockResolvedValue(undefined as never);
    const app = createApp();
    const res = await app.request('/tickets/ticket-1/labels/label-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.message).toBe('Label removed from ticket');
  });

  it('POST /tickets/:id/labels -- 500 when assignLabel returns null (plain Error, not HTTPException)', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    ml.assignLabel.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/tickets/ticket-1/labels', post({ labelId: 'label-1' }));
    expect(res.status).toBe(500);
  });
});
