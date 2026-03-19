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
const mockDispatch = vi
  .fn()
  .mockResolvedValue({ success: true, output: 'Agent completed the task.' });

vi.mock('@revealui/ai', () => ({
  LLMClient: vi.fn(),
  // createLLMClientFromEnv must be mocked — without it buildDispatcher() catches
  // the "not a function" TypeError and returns null, causing 503 on all success paths.
  createLLMClientFromEnv: vi.fn().mockReturnValue({}),
  TicketAgentDispatcher: vi.fn().mockImplementation(
    class {
      dispatch = mockDispatch;
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

import * as aiModule from '@revealui/ai';
import type { DatabaseClient } from '@revealui/db/client';
import * as boardQueries from '@revealui/db/queries/boards';
import * as ticketQueries from '@revealui/db/queries/tickets';
import agentTasksApp from '../agent-tasks.js';

const mb = vi.mocked(boardQueries);
const mt = vi.mocked(ticketQueries);
const mockCreateLLMClient = vi.mocked(aiModule.createLLMClientFromEnv);

// ---------------------------------------------------------------------------
// Env setup — provide a fake API key so buildDispatcher returns a dispatcher
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
  vi.stubEnv('CMS_URL', 'http://localhost:4000');
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

// Shared insert spy — reset in beforeEach so individual tests can assert on it
const mockDbInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

function createApp() {
  const app = new Hono<{ Variables: { db: DatabaseClient; tenant?: { id: string } } }>();
  app.use('*', async (c, next) => {
    c.set('db', { insert: mockDbInsert } as unknown as DatabaseClient);
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

// biome-ignore lint/suspicious/noExplicitAny: test helper — response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

// ---------------------------------------------------------------------------
// POST / — submit natural language task
// ---------------------------------------------------------------------------

describe('POST / — submit agent task', () => {
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
  });
});

// ---------------------------------------------------------------------------
// POST /:ticketId/dispatch — dispatch agent for existing ticket
// ---------------------------------------------------------------------------

describe('POST /:ticketId/dispatch — dispatch existing ticket', () => {
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
});
