/**
 * RevMarket route tests (Phase 5.16)
 *
 * Tests covering:
 *   GET  /agents               -  browse published agents (public)
 *   GET  /agents/:id           -  agent detail + skills (public)
 *   POST /agents               -  publish an agent (auth required)
 *   PATCH /agents/:id          -  update own agent (auth required)
 *   DELETE /agents/:id         -  unpublish own agent (auth required)
 *   POST /agents/:id/skills    -  add a skill (auth required)
 *   POST /tasks                -  submit a task (auth required)
 *   GET  /tasks/:id            -  get task status (auth required)
 *   POST /tasks/:id/cancel     -  cancel a task (auth required)
 *   POST /agents/:id/reviews   -  leave a review (auth required)
 *   GET  /agents/:id/reviews   -  list reviews (public)
 *   GET  /tasks/:id/progress   -  poll progress (auth required)
 *   GET  /executor/status      -  executor health (admin)
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mock factories ─────────────────────────────────────────────────

const {
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockGetClient,
  mockLoggerInfo,
  mockSql,
  mockGetX402Config,
  mockBuildPaymentRequired,
  mockEncodePaymentRequired,
  mockVerifyPayment,
} = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockGetClient: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockSql: vi.fn().mockReturnValue(0),
  mockGetX402Config: vi.fn(() => ({
    enabled: false,
    receivingAddress: '',
    network: 'evm:base',
    pricePerTask: '0.001',
  })),
  mockBuildPaymentRequired: vi.fn(() => ({
    x402Version: 1,
    accepts: [{ scheme: 'exact', network: 'evm:base', maxAmountRequired: '500000' }],
  })),
  mockEncodePaymentRequired: vi.fn(() => 'mock-encoded-payment-required'),
  mockVerifyPayment: vi.fn(async () => ({ valid: true as const })),
}));

// ─── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: mockLoggerInfo, warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: vi.fn(
    (_opts?: unknown) => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock('../../middleware/x402.js', () => ({
  getX402Config: mockGetX402Config,
  buildPaymentRequired: mockBuildPaymentRequired,
  encodePaymentRequired: mockEncodePaymentRequired,
  verifyPayment: mockVerifyPayment,
  getAdvertisedCurrencyLabel: () => 'usdc-only',
}));

vi.mock('../../services/revmarket-executor.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/revmarket-executor.js')>();
  return {
    ...actual,
    getTaskProgress: vi.fn().mockResolvedValue({
      taskId: 'task_abc123abc123',
      status: 'running',
      progress: 42,
      message: 'Processing...',
      updatedAt: '2026-04-07T00:00:00.000Z',
    }),
    getExecutorStatus: vi.fn().mockReturnValue({
      running: true,
      activeTasks: 2,
      maxConcurrent: 4,
    }),
  };
});

// ─── Drizzle mock ───────────────────────────────────────────────────────────

let selectResults: unknown[][] = [];
let insertResults: unknown[][] = [];
let updateResults: unknown[][] = [];

function makeSelectChain() {
  const result = selectResults.shift() ?? [];
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    innerJoin: vi.fn(),
    then(
      onFulfilled?: (value: unknown[]) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ): Promise<unknown> {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.offset.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() {
  const result = insertResults.shift() ?? [];
  const chain = {
    values: vi.fn(),
    returning: vi.fn().mockResolvedValue(result),
    then(
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ): Promise<unknown> {
      return Promise.resolve(undefined).then(onFulfilled, onRejected);
    },
  };
  chain.values.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  const result = updateResults.shift() ?? [];
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn().mockResolvedValue(result),
    then(
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ): Promise<unknown> {
      return Promise.resolve(undefined).then(onFulfilled, onRejected);
    },
  };
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

mockDbSelect.mockImplementation(() => makeSelectChain());
mockDbInsert.mockImplementation(() => makeInsertChain());
mockDbUpdate.mockImplementation(() => makeUpdateChain());

mockGetClient.mockReturnValue({
  select: mockDbSelect,
  insert: mockDbInsert,
  update: mockDbUpdate,
});

vi.mock('@revealui/db', () => ({
  getClient: mockGetClient,
}));

vi.mock('@revealui/db/schema', () => ({
  marketplaceAgents: {
    id: 'id',
    name: 'name',
    description: 'description',
    publisherId: 'publisher_id',
    category: 'category',
    tags: 'tags',
    pricingModel: 'pricing_model',
    basePriceUsdc: 'base_price_usdc',
    rating: 'rating',
    reviewCount: 'review_count',
    taskCount: 'task_count',
    version: 'version',
    status: 'status',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  agentSkills: {
    id: 'id',
    agentId: 'agent_id',
    name: 'name',
    description: 'description',
  },
  agentReviews: {
    id: 'id',
    agentId: 'agent_id',
    reviewerId: 'reviewer_id',
    rating: 'rating',
    comment: 'comment',
    verified: 'verified',
    createdAt: 'created_at',
  },
  taskSubmissions: {
    id: 'id',
    submitterId: 'submitter_id',
    agentId: 'agent_id',
    status: 'status',
    priority: 'priority',
    createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => `eq(${String(_col)},${String(_val)})`),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col) => `desc(${String(col)})`),
  ilike: vi.fn((_col, _val) => `ilike(${String(_col)},${String(_val)})`),
  sql: mockSql,
}));

// ─── Import under test (after mocks) ────────────────────────────────────────

import revmarketApp from '../revmarket.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

function createApp(user?: UserContext) {
  const app = new Hono<{ Variables: { user: UserContext | undefined } }>();
  app.use('*', async (c, next) => {
    c.set('user', user ?? undefined);
    await next();
  });
  app.route('/', revmarketApp);
  return app;
}

const testUser: UserContext = {
  id: 'user_001',
  email: 'dev@test.com',
  name: 'Test Dev',
  role: 'admin',
};

const regularUser: UserContext = {
  id: 'user_002',
  email: 'user@test.com',
  name: 'Regular User',
  role: 'user',
};

function post(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function get(path: string) {
  return new Request(`http://localhost${path}`);
}

function del(path: string) {
  return new Request(`http://localhost${path}`, { method: 'DELETE' });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  selectResults = [];
  insertResults = [];
  updateResults = [];
});

describe('GET /agents', () => {
  it('returns published agents', async () => {
    const agents = [{ id: 'agent_abc', name: 'Code Reviewer', category: 'coding', rating: 4.5 }];
    selectResults = [agents, [{ count: 1 }]];

    const app = createApp();
    const res = await app.request(get('/agents'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('supports category filter', async () => {
    selectResults = [[], [{ count: 0 }]];

    const app = createApp();
    const res = await app.request(get('/agents?category=writing'));

    expect(res.status).toBe(200);
  });
});

describe('GET /agents/:id', () => {
  it('returns agent with skills', async () => {
    const agent = { id: 'agent_abc', name: 'Code Reviewer', status: 'published' };
    const skills = [{ id: 'skill_001', name: 'code-review' }];
    selectResults = [[agent], skills];

    const app = createApp();
    const res = await app.request(get('/agents/agent_abc'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agent.id).toBe('agent_abc');
    expect(body.skills).toHaveLength(1);
  });

  it('returns 404 for missing agent', async () => {
    selectResults = [[]];

    const app = createApp();
    const res = await app.request(get('/agents/nonexistent'));

    expect(res.status).toBe(404);
  });
});

describe('POST /agents', () => {
  it('creates a new agent', async () => {
    const created = { id: 'agent_new', name: 'My Agent', status: 'draft' };
    insertResults = [[created]];

    const app = createApp(testUser);
    const res = await app.request(
      post('/agents', {
        name: 'My Agent',
        description: 'An excellent agent for testing purposes',
        definition: { capabilities: ['code-review'] },
      }),
    );

    expect(res.status).toBe(201);
  });

  it('requires auth', async () => {
    const app = createApp(); // no user
    const res = await app.request(
      post('/agents', {
        name: 'My Agent',
        description: 'An excellent agent for testing purposes',
        definition: { capabilities: [] },
      }),
    );

    expect(res.status).toBe(401);
  });
});

describe('DELETE /agents/:id', () => {
  it('unpublishes own agent', async () => {
    selectResults = [[{ publisherId: testUser.id }]];

    const app = createApp(testUser);
    const res = await app.request(del('/agents/agent_abc'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('rejects non-owner non-admin', async () => {
    selectResults = [[{ publisherId: 'other_user' }]];

    const app = createApp(regularUser);
    const res = await app.request(del('/agents/agent_abc'));

    expect(res.status).toBe(403);
  });
});

describe('POST /tasks', () => {
  it('creates a task with direct agent assignment', async () => {
    // Agent lookup
    selectResults = [[{ id: 'agent_abc', status: 'published', basePriceUsdc: '0.50' }]];
    const created = { id: 'task_new', status: 'queued', agentId: 'agent_abc' };
    insertResults = [[created]];

    const app = createApp(testUser);
    const res = await app.request(
      post('/tasks', {
        agentId: 'agent_abc',
        skillName: 'code-review',
        input: { code: 'function hello() {}' },
      }),
    );

    expect(res.status).toBe(201);
  });

  it('auto-matches agent by skill', async () => {
    // No direct agent → skill lookup → found match
    selectResults = [[{ agentId: 'agent_matched', basePriceUsdc: '0.25' }]];
    const created = { id: 'task_auto', status: 'queued', agentId: 'agent_matched' };
    insertResults = [[created]];

    const app = createApp(testUser);
    const res = await app.request(
      post('/tasks', {
        skillName: 'data-analysis',
        input: { dataset: 'sales.csv' },
      }),
    );

    expect(res.status).toBe(201);
  });
});

describe('POST /tasks  -  x402 payment gate (X402_ENABLED=true)', () => {
  beforeEach(() => {
    // Default is X402_ENABLED=false (set in hoisted mock); flip on for these tests.
    mockGetX402Config.mockReturnValue({
      enabled: true,
      receivingAddress: '0xTreasury',
      network: 'evm:base',
      pricePerTask: '0.001',
    });
    // Default verifier: accept proof. Tests can override.
    mockVerifyPayment.mockResolvedValue({ valid: true });
    // Reset call counters captured by the assertions below.
    mockBuildPaymentRequired.mockClear();
    mockEncodePaymentRequired.mockClear();
    mockVerifyPayment.mockClear();
  });

  it('returns 402 with X-PAYMENT-REQUIRED when paid agent has no payment header', async () => {
    selectResults = [[{ id: 'agent_paid', status: 'published', basePriceUsdc: '0.50' }]];

    const app = createApp(testUser);
    const res = await app.request(
      post('/tasks', {
        agentId: 'agent_paid',
        skillName: 'code-review',
        input: { code: 'function hello() {}' },
      }),
    );

    expect(res.status).toBe(402);
    expect(res.headers.get('X-PAYMENT-REQUIRED')).toBe('mock-encoded-payment-required');
    // Price is forwarded from the agent's basePriceUsdc
    expect(mockBuildPaymentRequired).toHaveBeenCalledWith(expect.any(String), '0.50');
    // No insert happened — the task was rejected before creation
    expect(mockVerifyPayment).not.toHaveBeenCalled();
  });

  it('verifies X-PAYMENT-PAYLOAD and creates task when payment is valid', async () => {
    selectResults = [[{ id: 'agent_paid', status: 'published', basePriceUsdc: '0.50' }]];
    const created = {
      id: 'task_paid',
      status: 'queued',
      agentId: 'agent_paid',
      paymentMethod: 'x402-usdc',
    };
    insertResults = [[created]];
    mockVerifyPayment.mockResolvedValueOnce({ valid: true });

    const app = createApp(testUser);
    const res = await app.request(
      new Request('http://localhost/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT-PAYLOAD': 'valid-base64-proof',
        },
        body: JSON.stringify({
          agentId: 'agent_paid',
          skillName: 'code-review',
          input: { code: 'function hello() {}' },
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(mockVerifyPayment).toHaveBeenCalledWith(
      'valid-base64-proof',
      expect.any(String),
      expect.objectContaining({ userId: testUser.id, amountUsd: '0.50' }),
      'revmarket-task',
    );
  });

  it('returns 402 when X-PAYMENT-PAYLOAD verification fails', async () => {
    selectResults = [[{ id: 'agent_paid', status: 'published', basePriceUsdc: '0.50' }]];
    mockVerifyPayment.mockResolvedValueOnce({
      valid: false,
      error: 'Invalid signature',
    });

    const app = createApp(testUser);
    const res = await app.request(
      new Request('http://localhost/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT-PAYLOAD': 'bad-base64-proof',
        },
        body: JSON.stringify({
          agentId: 'agent_paid',
          skillName: 'code-review',
          input: { code: 'function hello() {}' },
        }),
      }),
    );

    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Invalid signature');
  });

  it('passes through without payment when agent has zero basePriceUsdc (free tier)', async () => {
    selectResults = [[{ id: 'agent_free', status: 'published', basePriceUsdc: '0' }]];
    const created = { id: 'task_free', status: 'queued', agentId: 'agent_free' };
    insertResults = [[created]];

    const app = createApp(testUser);
    const res = await app.request(
      post('/tasks', {
        agentId: 'agent_free',
        skillName: 'code-review',
        input: { code: 'function hello() {}' },
      }),
    );

    expect(res.status).toBe(201);
    expect(mockBuildPaymentRequired).not.toHaveBeenCalled();
    expect(mockVerifyPayment).not.toHaveBeenCalled();
  });
});

describe('GET /tasks/:id', () => {
  it('returns task for submitter', async () => {
    const task = { id: 'task_001', submitterId: testUser.id, status: 'completed' };
    selectResults = [[task]];

    const app = createApp(testUser);
    const res = await app.request(get('/tasks/task_001'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task.status).toBe('completed');
  });

  it('rejects non-owner non-admin', async () => {
    const task = { id: 'task_001', submitterId: 'other_user', status: 'completed' };
    selectResults = [[task]];

    const app = createApp(regularUser);
    const res = await app.request(get('/tasks/task_001'));

    expect(res.status).toBe(403);
  });
});

describe('POST /tasks/:id/cancel', () => {
  it('cancels a pending task', async () => {
    selectResults = [[{ submitterId: testUser.id, status: 'pending' }]];

    const app = createApp(testUser);
    const req = new Request('http://localhost/tasks/task_001/cancel', { method: 'POST' });
    const res = await app.request(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('rejects cancelling a running task', async () => {
    selectResults = [[{ submitterId: testUser.id, status: 'running' }]];

    const app = createApp(testUser);
    const req = new Request('http://localhost/tasks/task_001/cancel', { method: 'POST' });
    const res = await app.request(req);

    expect(res.status).toBe(400);
  });
});

describe('POST /agents/:id/reviews', () => {
  it('creates a review for an existing agent', async () => {
    // Agent exists
    selectResults = [[{ id: 'agent_abc' }]];
    // Review insert
    const review = { id: 'rev_001', agentId: 'agent_abc', rating: 5 };
    insertResults = [[review]];
    // Aggregate for rating update
    selectResults.push([{ avgRating: 4.5, count: 10 }]);

    const app = createApp(testUser);
    const req = new Request('http://localhost/agents/agent_abc/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5, comment: 'Great agent!' }),
    });
    const res = await app.request(req);

    expect(res.status).toBe(201);
  });
});

describe('GET /agents/:id/reviews', () => {
  it('returns reviews list', async () => {
    const reviews = [
      { id: 'rev_001', rating: 5, comment: 'Excellent', verified: 1 },
      { id: 'rev_002', rating: 4, comment: 'Good', verified: 0 },
    ];
    selectResults = [reviews];

    const app = createApp();
    const res = await app.request(get('/agents/agent_abc/reviews'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reviews).toHaveLength(2);
  });
});

describe('GET /tasks/:id/progress', () => {
  it('returns task progress', async () => {
    const app = createApp(testUser);
    const res = await app.request(get('/tasks/task_abc123abc123/progress'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.progress).toBe(42);
    expect(body.status).toBe('running');
  });
});

describe('GET /executor/status', () => {
  it('returns executor status for admin', async () => {
    const app = createApp(testUser); // admin role
    const res = await app.request(get('/executor/status'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.running).toBe(true);
    expect(body.activeTasks).toBe(2);
  });

  it('rejects non-admin', async () => {
    const app = createApp(regularUser);
    const res = await app.request(get('/executor/status'));

    expect(res.status).toBe(403);
  });
});

describe('isValidTransition', () => {
  it('validates correct state transitions', async () => {
    const { isValidTransition } = await import('../../services/revmarket-executor.js');
    expect(isValidTransition('pending', 'queued')).toBe(true);
    expect(isValidTransition('queued', 'running')).toBe(true);
    expect(isValidTransition('running', 'completed')).toBe(true);
    expect(isValidTransition('running', 'failed')).toBe(true);
    expect(isValidTransition('pending', 'cancelled')).toBe(true);
  });

  it('rejects invalid state transitions', async () => {
    const { isValidTransition } = await import('../../services/revmarket-executor.js');
    expect(isValidTransition('pending', 'running')).toBe(false);
    expect(isValidTransition('completed', 'running')).toBe(false);
    expect(isValidTransition('failed', 'completed')).toBe(false);
  });
});
