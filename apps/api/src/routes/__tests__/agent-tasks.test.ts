import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB query modules
// ---------------------------------------------------------------------------

vi.mock('@revealui/db/queries/boards', () => ({
  getBoardById: vi.fn(),
}));

vi.mock('@revealui/db/queries/tickets', () => ({
  createTicket: vi.fn(),
  getTicketById: vi.fn(),
  updateTicket: vi.fn(),
}));

vi.mock('@revealui/db/queries/ticket-comments', () => ({
  createComment: vi.fn(),
}));

// Mock cross-DB validation so memory insert passes through without a real DB
vi.mock('@revealui/db/validation/cross-db', () => ({
  safeVectorInsert: vi.fn(async (_db: unknown, insertFn: () => Promise<unknown>) => insertFn()),
}));

// Mock the AI dispatcher so tests don't need a real LLM key.
// TicketAgentDispatcher is used with `new` in the route, so use a class mock.
// vi.hoisted lets mock fns be referenced inside vi.mock factories AND test bodies
// without a static import of @revealui/ai (which is a Pro package absent on CI).
const { mockDispatch, mockCreateLLMClient } = vi.hoisted(() => ({
  mockDispatch: vi.fn().mockResolvedValue({ success: true, output: 'Agent completed the task.' }),
  mockCreateLLMClient: vi.fn().mockReturnValue({}),
}));

vi.mock('@revealui/ai', () => ({
  LLMClient: vi.fn(),
  // createLLMClientFromEnv must be mocked  -  without it buildDispatcher() catches
  // the "not a function" TypeError and returns null, causing 503 on all success paths.
  createLLMClientFromEnv: mockCreateLLMClient,
  TicketAgentDispatcher: vi.fn().mockImplementation(
    class {
      dispatch = mockDispatch;
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

import type { DatabaseClient } from '@revealui/db/client';
import * as boardQueries from '@revealui/db/queries/boards';
import * as ticketQueries from '@revealui/db/queries/tickets';
import agentTasksApp from '../agent-tasks.js';

const mb = vi.mocked(boardQueries);
const mt = vi.mocked(ticketQueries);

// ---------------------------------------------------------------------------
// Env setup  -  provide a fake API key so buildDispatcher returns a dispatcher
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
  vi.stubEnv('ADMIN_URL', 'http://localhost:4000');
  mockDbInsert.mockClear();
  mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();

function makeBoard(overrides = {}) {
  return {
    id: 'board-1',
    schemaVersion: '1',
    name: 'Main Board',
    slug: 'main-board',
    description: null,
    ownerId: null,
    tenantId: null,
    isDefault: false,
    settings: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeTicket(overrides = {}) {
  return {
    id: 'ticket-1',
    boardId: 'board-1',
    columnId: null,
    parentTicketId: null,
    ticketNumber: 42,
    title: 'Publish blog post',
    description: null,
    status: 'in_progress',
    priority: 'medium',
    type: 'task',
    assigneeId: null,
    reporterId: null,
    dueDate: null,
    estimatedEffort: null,
    sortOrder: 0,
    commentCount: 0,
    attachments: [],
    metadata: {},
    closedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

// Shared insert spy  -  reset in beforeEach so individual tests can assert on it
const mockDbInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

function createApp(
  tenant?: { id: string },
  user: { id: string; role: string } | null = { id: 'test-user', role: 'admin' },
) {
  const app = new Hono<{
    Variables: { db: DatabaseClient; tenant?: { id: string }; user?: { id: string; role: string } };
  }>();
  app.use('*', async (c, next) => {
    c.set('db', { insert: mockDbInsert } as unknown as DatabaseClient);
    if (tenant) c.set('tenant', tenant);
    if (user) c.set('user', user);
    await next();
  });
  app.route('/', agentTasksApp);
  return app;
}

function post(body: unknown) {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  };
}

function dispatchRequest(ticketId: string) {
  return new Request(`http://localhost/${ticketId}/dispatch`, { method: 'POST' });
}

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

// ---------------------------------------------------------------------------
// POST /  -  submit natural language task
// ---------------------------------------------------------------------------

describe('POST /  -  submit agent task', () => {
  it('returns 400 when instruction is missing', async () => {
    const app = createApp();
    const res = await app.request('/', post({ boardId: 'board-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when boardId is missing', async () => {
    const app = createApp();
    const res = await app.request('/', post({ instruction: 'Publish blog post' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when board does not exist', async () => {
    mb.getBoardById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/', post({ instruction: 'Publish blog post', boardId: 'bad' }));
    expect(res.status).toBe(400);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
    expect(body.error).toContain('not found');
  });

  it('returns 400 when ticket creation fails', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.createTicket.mockResolvedValue(undefined as never);
    const app = createApp();
    const res = await app.request(
      '/',
      post({ instruction: 'Publish blog post', boardId: 'board-1' }),
    );
    expect(res.status).toBe(400);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
  });

  it('returns 403 when no LLM key is configured', async () => {
    // Simulate missing API key: createLLMClientFromEnv throws
    mockCreateLLMClient.mockImplementationOnce(() => {
      throw new Error('API key not found');
    });
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.createTicket.mockResolvedValue(makeTicket() as never);
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'open' }) as never);
    const app = createApp();
    const res = await app.request(
      '/',
      post({ instruction: 'Publish blog post', boardId: 'board-1' }),
    );
    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
    expect(body.error).toContain('requires a Pro or Enterprise license');
  });

  it('returns 200 with agent output on success', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.createTicket.mockResolvedValue(makeTicket() as never);
    mt.getTicketById.mockResolvedValue(makeTicket({ status: 'done' }) as never);
    const app = createApp();
    const res = await app.request(
      '/',
      post({ instruction: 'Publish blog post', boardId: 'board-1' }),
    );
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.ticketId).toBe('ticket-1');
    expect(body.ticketNumber).toBe(42);
    expect(body.agentOutput).toBe('Agent completed the task.');
    expect(body.status).toBe('done');
  });

  it('persists agent output to agent_memories table on success', async () => {
    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockDbInsert.mockReturnValueOnce({ values: mockValues });

    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.createTicket.mockResolvedValue(makeTicket() as never);
    mt.getTicketById.mockResolvedValue(makeTicket({ status: 'done' }) as never);
    const app = createApp();
    await app.request('/', post({ instruction: 'Publish blog post', boardId: 'board-1' }));

    // db.insert(agentMemories) must have been called once with the agent output
    expect(mockDbInsert).toHaveBeenCalledOnce();
    const insertedRow = mockValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedRow).toBeDefined();
    expect(insertedRow.content).toBe('Agent completed the task.');
    expect(insertedRow.type).toBe('decision');
    expect(typeof insertedRow.agentId).toBe('string');
    expect(insertedRow.agentId as string).toContain('ticket-agent-');
    expect((insertedRow.metadata as Record<string, unknown>).success).toBe(true);
  });

  it('does not insert agent_memories when agent returns no output', async () => {
    mockDispatch.mockResolvedValueOnce({ success: true, output: null });

    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.createTicket.mockResolvedValue(makeTicket() as never);
    mt.getTicketById.mockResolvedValue(makeTicket({ status: 'done' }) as never);
    const app = createApp();
    await app.request('/', post({ instruction: 'Publish blog post', boardId: 'board-1' }));

    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('marks ticket blocked when agent fails', async () => {
    // Return a failure result for this single call
    mockDispatch.mockResolvedValueOnce({ success: false, output: 'Could not complete.' });

    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.createTicket.mockResolvedValue(makeTicket() as never);
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'blocked' }) as never);
    mt.getTicketById.mockResolvedValue(makeTicket({ status: 'blocked' }) as never);
    const app = createApp();
    const res = await app.request(
      '/',
      post({ instruction: 'Publish blog post', boardId: 'board-1' }),
    );
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.status).toBe('blocked');
    // dispatchWithTimeout calls updateTicket(db, ticket.id, { status: 'blocked' })
    // when the agent dispatch result has success: false
    expect(mt.updateTicket).toHaveBeenCalledWith(expect.anything(), 'ticket-1', {
      status: 'blocked',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /:ticketId/dispatch  -  dispatch agent for existing ticket
// ---------------------------------------------------------------------------

describe('POST /:ticketId/dispatch  -  dispatch existing ticket', () => {
  it('returns 404 when ticket does not exist', async () => {
    mt.getTicketById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/ticket-missing/dispatch', post({}));
    expect(res.status).toBe(404);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Ticket not found');
  });

  it('returns 403 when no LLM key is configured', async () => {
    // Simulate missing API key: createLLMClientFromEnv throws
    mockCreateLLMClient.mockImplementationOnce(() => {
      throw new Error('API key not found');
    });
    mt.getTicketById.mockResolvedValue(makeTicket() as never);
    const app = createApp();
    const res = await app.request('/ticket-1/dispatch', post({}));
    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
    expect(body.error).toContain('requires a Pro or Enterprise license');
  });

  it('returns 200 with agent output on success', async () => {
    mt.getTicketById
      .mockResolvedValueOnce(makeTicket() as never) // initial fetch
      .mockResolvedValueOnce(makeTicket({ status: 'done' }) as never); // final fetch
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'in_progress' }) as never);
    const app = createApp();
    const res = await app.request('/ticket-1/dispatch', post({}));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.ticketId).toBe('ticket-1');
    expect(body.agentOutput).toBe('Agent completed the task.');
    expect(body.status).toBe('done');
  });

  it('returns 404 when ticket belongs to a different tenant (tenant mismatch)', async () => {
    // Ticket found, but the board it belongs to has a different tenantId
    mt.getTicketById.mockResolvedValue(makeTicket({ boardId: 'board-1' }) as never);
    mb.getBoardById.mockResolvedValue(makeBoard({ tenantId: 'other-tenant' }) as never);
    // Caller's tenant is 'my-tenant'  -  does NOT match board's 'other-tenant'
    const app = createApp({ id: 'my-tenant' });
    const res = await app.fetch(dispatchRequest('ticket-1'));
    expect(res.status).toBe(404);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Ticket not found');
  });

  it('returns 200 when tenant matches board tenantId (no false 404)', async () => {
    mt.getTicketById
      .mockResolvedValueOnce(makeTicket({ boardId: 'board-1' }) as never)
      .mockResolvedValueOnce(makeTicket({ status: 'done' }) as never);
    mb.getBoardById.mockResolvedValue(makeBoard({ tenantId: 'my-tenant' }) as never);
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'in_progress' }) as never);
    // Caller is in the same tenant as the board
    const app = createApp({ id: 'my-tenant' });
    const res = await app.fetch(dispatchRequest('ticket-1'));
    expect(res.status).toBe(200);
  });

  it('calls updateTicket with in_progress before dispatching', async () => {
    mt.getTicketById
      .mockResolvedValueOnce(makeTicket() as never)
      .mockResolvedValueOnce(makeTicket({ status: 'done' }) as never);
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'in_progress' }) as never);
    const app = createApp();
    await app.fetch(dispatchRequest('ticket-1'));
    expect(mt.updateTicket).toHaveBeenCalledWith(expect.anything(), 'ticket-1', {
      status: 'in_progress',
    });
  });

  it('returns 403 with error message when dispatch throws (agent failure)', async () => {
    // dispatchWithTimeout returns { success: false, error } when the dispatcher
    // throws  -  not when it returns { success: false }.  Simulate a throw.
    mockDispatch.mockRejectedValueOnce(new Error('Agent internal error'));
    mt.getTicketById.mockResolvedValueOnce(makeTicket() as never);
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'blocked' }) as never);
    const app = createApp();
    const res = await app.fetch(dispatchRequest('ticket-1'));
    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Agent dispatch failed');
  });

  it('falls back to result.success for status when final ticket fetch returns null', async () => {
    mt.getTicketById
      .mockResolvedValueOnce(makeTicket() as never) // initial fetch  -  ticket exists
      .mockResolvedValueOnce(null as never); // final fetch  -  ticket vanished
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'in_progress' }) as never);
    const app = createApp();
    const res = await app.fetch(dispatchRequest('ticket-1'));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    // result.success is true (mockDispatch default), so fallback is 'done'
    expect(body.status).toBe('done');
  });

  it('falls back to blocked when final ticket is null and dispatch result.success is false', async () => {
    // dispatchWithTimeout returns success:true but result.success is false (agent reported failure)
    mockDispatch.mockResolvedValueOnce({ success: false, output: 'Could not complete.' });
    mt.getTicketById
      .mockResolvedValueOnce(makeTicket() as never) // initial fetch
      .mockResolvedValueOnce(null as never); // final fetch  -  null
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'blocked' }) as never);
    const app = createApp();
    const res = await app.fetch(dispatchRequest('ticket-1'));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.status).toBe('blocked');
  });

  it('response status comes from final ticket when available', async () => {
    mt.getTicketById
      .mockResolvedValueOnce(makeTicket() as never)
      .mockResolvedValueOnce(makeTicket({ status: 'done' }) as never);
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'in_progress' }) as never);
    const app = createApp();
    const res = await app.fetch(dispatchRequest('ticket-1'));
    const body = await parseBody(res);
    // 'done' comes from the final ticket fetch, not from a fallback
    expect(body.status).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// dispatchWithTimeout  -  timeout sentinel vs general error distinction
// ---------------------------------------------------------------------------

describe('dispatchWithTimeout  -  timeout sentinel vs general error', () => {
  it('returns timeout-specific message when dispatch rejects with timeout sentinel', async () => {
    // Simulate the timeout promise firing first by rejecting with the sentinel message
    mockDispatch.mockRejectedValueOnce(new Error('Agent dispatch timed out'));
    mt.getTicketById.mockResolvedValueOnce(makeTicket() as never);
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'blocked' }) as never);
    const app = createApp();
    const res = await app.fetch(dispatchRequest('ticket-1'));
    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Agent timed out after 2 minutes');
  });

  it('returns generic error when dispatch rejects with a non-Error value', async () => {
    // Reject with a plain string  -  dispatchErr instanceof Error is false → isTimeout is false
    mockDispatch.mockRejectedValueOnce('network connection refused');
    mt.getTicketById.mockResolvedValueOnce(makeTicket() as never);
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'blocked' }) as never);
    const app = createApp();
    const res = await app.fetch(dispatchRequest('ticket-1'));
    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Agent dispatch failed');
  });

  it('marks ticket blocked when dispatch times out', async () => {
    mockDispatch.mockRejectedValueOnce(new Error('Agent dispatch timed out'));
    mt.getTicketById.mockResolvedValueOnce(makeTicket() as never);
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'blocked' }) as never);
    const app = createApp();
    await app.fetch(dispatchRequest('ticket-1'));
    expect(mt.updateTicket).toHaveBeenCalledWith(expect.anything(), 'ticket-1', {
      status: 'blocked',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /  -  instruction length boundary + priority propagation
// ---------------------------------------------------------------------------

describe('POST /  -  instruction length and priority', () => {
  it('returns 400 when instruction exceeds 2000 characters', async () => {
    const app = createApp();
    const res = await app.request('/', post({ instruction: 'a'.repeat(2001), boardId: 'board-1' }));
    expect(res.status).toBe(400);
  });

  it('accepts instruction of exactly 2000 characters', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.createTicket.mockResolvedValue(makeTicket() as never);
    mt.getTicketById.mockResolvedValue(makeTicket({ status: 'done' }) as never);
    const app = createApp();
    const res = await app.request('/', post({ instruction: 'a'.repeat(2000), boardId: 'board-1' }));
    expect(res.status).toBe(200);
  });

  it('passes the requested priority to createTicket', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.createTicket.mockResolvedValue(makeTicket({ priority: 'critical' }) as never);
    mt.getTicketById.mockResolvedValue(makeTicket({ status: 'done' }) as never);
    const app = createApp();
    await app.request(
      '/',
      post({ instruction: 'Fix the critical outage', boardId: 'board-1', priority: 'critical' }),
    );
    expect(mt.createTicket).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ priority: 'critical' }),
    );
  });

  it('defaults priority to medium when not specified', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never);
    mt.createTicket.mockResolvedValue(makeTicket() as never);
    mt.getTicketById.mockResolvedValue(makeTicket({ status: 'done' }) as never);
    const app = createApp();
    await app.request('/', post({ instruction: 'Update homepage', boardId: 'board-1' }));
    expect(mt.createTicket).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ priority: 'medium' }),
    );
  });
});
