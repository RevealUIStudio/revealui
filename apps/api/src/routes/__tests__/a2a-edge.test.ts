/**
 * A2A edge-case tests (pass 14)
 *
 * Covers untested branches in a2a.ts not reached by a2a.test.ts:
 *   GET  /.well-known/marketplace.json    -  happy path + DB-unavailable fallback
 *   GET  /.well-known/payment-methods.json  -  enabled (200) and disabled (404)
 *   GET  /a2a/agents/:id/tasks            -  401, 400, rows from DB, empty on DB error
 *   GET  /a2a/stream/:taskId              -  task not found (SSE error), terminal task (SSE close)
 *   POST /a2a (JSON-RPC)                  -  quota exceeded returns quota Response
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mock factories ───────────────────────────────────────────────────

const {
  mockGetCard,
  mockListCards,
  mockHas,
  mockGetDef,
  mockRegister,
  mockUnregister,
  mockUpdate,
  mockHandleA2AJsonRpc,
  mockGetTask,
  mockIsFeatureEnabled,
  mockAgentDefinitionSafeParse,
  mockA2AJsonRpcSafeParse,
  mockGetClient,
  mockBuildPaymentMethods,
  mockBuildPaymentRequired,
  mockEncodePaymentRequired,
  mockVerifyPayment,
  mockRequireTaskQuota,
} = vi.hoisted(() => ({
  mockGetCard: vi.fn(),
  mockListCards: vi.fn(),
  mockHas: vi.fn(),
  mockGetDef: vi.fn(),
  mockRegister: vi.fn(),
  mockUnregister: vi.fn(),
  mockUpdate: vi.fn(),
  mockHandleA2AJsonRpc: vi.fn(),
  mockGetTask: vi.fn(),
  mockIsFeatureEnabled: vi.fn(() => true),
  mockAgentDefinitionSafeParse: vi.fn((data: unknown) => ({ success: true, data })),
  mockA2AJsonRpcSafeParse: vi.fn((data: unknown) => ({ success: true, data })),
  mockGetClient: vi.fn(),
  mockBuildPaymentMethods: vi.fn(),
  mockBuildPaymentRequired: vi.fn(),
  mockEncodePaymentRequired: vi.fn(),
  mockVerifyPayment: vi.fn(),
  mockRequireTaskQuota: vi.fn(),
}));

vi.mock('@revealui/ai', () => ({
  agentCardRegistry: {
    getCard: mockGetCard,
    listCards: mockListCards,
    has: mockHas,
    getDef: mockGetDef,
    register: mockRegister,
    unregister: mockUnregister,
    update: mockUpdate,
  },
  handleA2AJsonRpc: mockHandleA2AJsonRpc,
  getTask: mockGetTask,
  RPC_PARSE_ERROR: -32700,
  RPC_INVALID_REQUEST: -32600,
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/core/license', () => ({
  initializeLicense: vi.fn(),
}));

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: vi.fn(
    (_options?: unknown) => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
  requireRole: vi.fn(
    (..._roles: string[]) =>
      async (_c: unknown, next: () => Promise<void>) =>
        next(),
  ),
}));

vi.mock('../../middleware/license.js', () => ({
  requireFeature: vi.fn(
    (_feature: string) => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
  checkLicenseStatus: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock('../../middleware/x402.js', () => ({
  buildPaymentMethods: mockBuildPaymentMethods,
  buildPaymentRequired: mockBuildPaymentRequired,
  encodePaymentRequired: mockEncodePaymentRequired,
  verifyPayment: mockVerifyPayment,
}));

vi.mock('../../middleware/task-quota.js', () => ({
  requireTaskQuota: mockRequireTaskQuota,
}));

vi.mock('@revealui/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@revealui/contracts')>();
  return {
    ...actual,
    AgentDefinitionSchema: { safeParse: mockAgentDefinitionSafeParse },
    A2AJsonRpcRequestSchema: { safeParse: mockA2AJsonRpcSafeParse },
  };
});

vi.mock('@revealui/db/schema', () => ({
  registeredAgents: { id: 'id', definition: 'definition' },
  marketplaceServers: {
    id: 'id',
    name: 'name',
    description: 'description',
    category: 'category',
    pricePerCallUsdc: 'pricePerCallUsdc',
    status: 'status',
  },
  agentActions: {
    id: 'id',
    agentId: 'agentId',
    tool: 'tool',
    params: 'params',
    result: 'result',
    status: 'status',
    startedAt: 'startedAt',
    completedAt: 'completedAt',
    durationMs: 'durationMs',
  },
}));

vi.mock('@revealui/db', () => ({ getClient: mockGetClient }));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq'),
  desc: vi.fn(() => 'desc'),
}));

// ─── Import under test ────────────────────────────────────────────────────────

import { a2aRoutes, wellKnownRoutes } from '../a2a.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWellKnownApp() {
  const app = new Hono();
  app.route('/', wellKnownRoutes);
  return app;
}

function makeA2AApp(user?: { id: string }, entitlements?: { features?: Record<string, boolean> }) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const app = new Hono<{ Variables: { user?: any; entitlements?: any } }>();
  if (user) {
    app.use('*', async (c, next) => {
      c.set('user', user);
      if (entitlements) {
        c.set('entitlements', entitlements);
      }
      await next();
    });
  }
  app.route('/', a2aRoutes);
  return app;
}

function get(path: string) {
  return new Request(`http://localhost${path}`, { method: 'GET' });
}

function post(path: string, body: unknown, headers?: Record<string, string>) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

/** Build a fluent Drizzle-like select chain that resolves to `rows` via `.limit()`. */
// biome-ignore lint/suspicious/noExplicitAny: test helper  -  Drizzle chain typing
function makeSelectChain(rows: unknown[], opts?: { throws?: boolean }): any {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  if (opts?.throws) {
    chain.limit = vi.fn().mockRejectedValue(new Error('DB unavailable'));
  } else {
    chain.limit = vi.fn().mockResolvedValue(rows);
  }
  // Note: bare `await db.select().from(table)` (used by ensureRegistryHydrated) will
  // receive the chain object rather than an array. The hydration try/catch swallows the
  // resulting TypeError, so not providing a .then here is intentional.
  return chain;
}

const MOCK_CARD = {
  id: 'test-agent',
  name: 'Test Agent',
  url: 'http://localhost/a2a',
  version: '1.0',
  capabilities: {},
  skills: [],
};

function resetMocks() {
  vi.clearAllMocks();

  mockGetCard.mockReturnValue(MOCK_CARD);
  mockListCards.mockReturnValue([MOCK_CARD]);
  mockHas.mockReturnValue(false);
  mockGetDef.mockReturnValue(null);
  mockRegister.mockImplementation(() => undefined);
  mockUnregister.mockReturnValue(true);
  mockUpdate.mockImplementation(() => undefined);
  mockIsFeatureEnabled.mockReturnValue(true);
  mockHandleA2AJsonRpc.mockResolvedValue({ jsonrpc: '2.0', id: 1, result: { status: 'ok' } });
  mockBuildPaymentMethods.mockReturnValue(null);
  mockBuildPaymentRequired.mockReturnValue({ x402Version: 1, accepts: [] });
  mockEncodePaymentRequired.mockReturnValue('mock-encoded-payment-required');
  mockVerifyPayment.mockResolvedValue({ valid: true });
  mockRequireTaskQuota.mockResolvedValue(undefined);

  // Default DB: hydration query (registeredAgents) returns []
  const defaultSelectChain = makeSelectChain([]);
  mockGetClient.mockReturnValue({
    select: vi.fn().mockReturnValue(defaultSelectChain),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    // biome-ignore lint/suspicious/noExplicitAny: test mock
  } as any);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /.well-known/marketplace.json', () => {
  beforeEach(resetMocks);

  it('returns marketplace metadata with active servers from DB', async () => {
    const serverRows = [
      {
        id: 'srv-1',
        name: 'GitHub MCP',
        description: 'GitHub integration',
        category: 'devtools',
        pricePerCallUsdc: '0.001',
      },
      {
        id: 'srv-2',
        name: 'Stripe MCP',
        description: 'Stripe integration',
        category: 'payments',
        pricePerCallUsdc: '0.002',
      },
    ];

    const selectChain = makeSelectChain(serverRows);
    mockGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      // biome-ignore lint/suspicious/noExplicitAny: test mock
    } as any);

    const app = makeWellKnownApp();
    const res = await app.request(get('/marketplace.json'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      servers: Array<{ id: string; invokeUrl: string }>;
      version: string;
      revenueShare: { platform: number; developer: number };
    };
    expect(body.version).toBe('1.0');
    expect(body.revenueShare).toEqual({ platform: 0.2, developer: 0.8 });
    expect(body.servers).toHaveLength(2);
    expect(body.servers[0]?.id).toBe('srv-1');
    // invokeUrl is constructed from baseUrl + server id
    expect(body.servers[0]?.invokeUrl).toContain('srv-1/invoke');
  });

  it('returns empty servers array when DB is unavailable', async () => {
    const selectChain = makeSelectChain([], { throws: true });
    mockGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      // biome-ignore lint/suspicious/noExplicitAny: test mock
    } as any);

    const app = makeWellKnownApp();
    const res = await app.request(get('/marketplace.json'));

    // Still 200  -  DB failure is caught and swallowed
    expect(res.status).toBe(200);
    const body = (await res.json()) as { servers: unknown[] };
    expect(body.servers).toHaveLength(0);
  });
});

describe('GET /.well-known/payment-methods.json', () => {
  beforeEach(resetMocks);

  it('returns 404 when x402 payments are disabled (default)', async () => {
    mockBuildPaymentMethods.mockReturnValue(null);

    const app = makeWellKnownApp();
    const res = await app.request(get('/payment-methods.json'));

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('not enabled');
  });

  it('returns payment methods when x402 is enabled', async () => {
    const methods = {
      x402version: 1,
      accepts: [{ scheme: 'exact', network: 'base-sepolia', maxAmountRequired: '1000' }],
    };
    mockBuildPaymentMethods.mockReturnValue(methods);

    const app = makeWellKnownApp();
    const res = await app.request(get('/payment-methods.json'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ x402version: 1 });
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
  });
});

describe('GET /a2a/agents/:id/tasks', () => {
  beforeEach(resetMocks);

  it('returns 401 when caller is not authenticated', async () => {
    // makeA2AApp() without user → c.get("user") is undefined
    const app = makeA2AApp();
    const res = await app.request(get('/agents/test-agent/tasks'));

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Authentication');
  });

  it('returns 400 for invalid agent ID format', async () => {
    const app = makeA2AApp({ id: 'user-1' });
    // Spaces in ID fail /^[\w-]{1,256}$/ check
    const res = await app.request(get('/agents/invalid%20id/tasks'));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Invalid agent ID format');
  });

  it('returns task history rows from DB', async () => {
    const taskRows = [
      { id: 'action-1', agentId: 'test-agent', tool: 'tasks/send', status: 'completed' },
      { id: 'action-2', agentId: 'test-agent', tool: 'tasks/send', status: 'failed' },
    ];

    const taskChain = makeSelectChain(taskRows);
    mockGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(taskChain),
      // biome-ignore lint/suspicious/noExplicitAny: test mock
    } as any);

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(get('/agents/test-agent/tasks'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: unknown[] };
    expect(body.tasks).toHaveLength(2);
  });

  it('returns empty tasks array when DB query fails', async () => {
    const taskChain = makeSelectChain([], { throws: true });
    mockGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(taskChain),
      // biome-ignore lint/suspicious/noExplicitAny: test mock
    } as any);

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(get('/agents/test-agent/tasks'));

    // DB failure is caught  -  returns empty array instead of 500
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: unknown[] };
    expect(body.tasks).toHaveLength(0);
  });
});

describe('GET /a2a/stream/:taskId  -  SSE stream', () => {
  beforeEach(resetMocks);

  it('sends error event and closes when task is not found', async () => {
    mockGetTask.mockReturnValue(undefined);

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(get('/stream/task-missing'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');

    const text = await res.text();
    const events = text
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => JSON.parse(l.slice(6)) as Record<string, unknown>);

    expect(events).toHaveLength(1);
    expect(events[0]?.error).toContain('task-missing');
  });

  it('sends task data and closes when task is in a terminal state', async () => {
    const completedTask = {
      id: 'task-done',
      status: { state: 'completed' },
      output: 'done',
    };
    mockGetTask.mockReturnValue(completedTask);

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(get('/stream/task-done'));

    expect(res.status).toBe(200);
    const text = await res.text();
    const events = text
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => JSON.parse(l.slice(6)) as Record<string, unknown>);

    expect(events).toHaveLength(1);
    expect(events[0]?.status).toMatchObject({ state: 'completed' });
  });
});

describe('POST /a2a  -  quota enforcement', () => {
  beforeEach(resetMocks);

  it('returns quota Response directly when task quota is exceeded', async () => {
    // Simulate quota middleware returning a 429 Response
    const quotaExceeded = new Response(
      JSON.stringify({ error: 'Task quota exceeded', code: 'QUOTA_EXCEEDED' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
    mockRequireTaskQuota.mockResolvedValue(quotaExceeded);

    const app = makeA2AApp({ id: 'user-1' }, { features: { ai: true } });
    const res = await app.request(
      post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'tasks/send',
        params: { id: 'test-agent', message: { role: 'user', parts: [{ text: 'hi' }] } },
      }),
    );

    expect(res.status).toBe(429);
    // Dispatcher must NOT have been called  -  quota response short-circuits execution
    expect(mockHandleA2AJsonRpc).not.toHaveBeenCalled();
  });
});

// ─── Pass 15  -  edge case expansion ──────────────────────────────────────────

describe('POST /a2a  -  JSON-RPC validation edge cases', () => {
  beforeEach(() => {
    resetMocks();
    // resetMocks clears all mocks; restore safeParse passthroughs
    mockA2AJsonRpcSafeParse.mockImplementation((data: unknown) => ({ success: true, data }));
    mockAgentDefinitionSafeParse.mockImplementation((data: unknown) => ({ success: true, data }));
  });

  it('returns 400 with RPC_INVALID_REQUEST when safeParse fails', async () => {
    // Make safeParse return failure to hit the invalid request branch
    mockA2AJsonRpcSafeParse.mockReturnValue({
      success: false,
      error: { issues: [{ message: 'missing method' }] },
    });

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(post('/', { jsonrpc: '2.0', id: 99 }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      jsonrpc: string;
      id: number;
      error: { code: number; message: string };
    };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(99);
    expect(body.error.code).toBe(-32600);
    expect(body.error.message).toBe('Invalid Request');
    expect(mockHandleA2AJsonRpc).not.toHaveBeenCalled();
  });

  it('uses null as id when body has no id field and safeParse fails', async () => {
    mockA2AJsonRpcSafeParse.mockReturnValue({
      success: false,
      error: { issues: [{ message: 'bad request' }] },
    });

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(post('/', { jsonrpc: '2.0' }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { id: unknown };
    expect(body.id).toBeNull();
  });

  it('returns 403 for tasks/send when ai feature is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(
      post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'tasks/send',
        params: { id: 'test-agent', message: { role: 'user', parts: [{ text: 'hi' }] } },
      }),
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as {
      jsonrpc: string;
      error: { code: number; message: string };
    };
    expect(body.error.code).toBe(-32003);
    expect(body.error.message).toContain('Pro or Enterprise license');
    expect(mockHandleA2AJsonRpc).not.toHaveBeenCalled();
  });

  it('returns 403 for tasks/sendSubscribe when ai feature is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(
      post('/', {
        jsonrpc: '2.0',
        id: 2,
        method: 'tasks/sendSubscribe',
        params: { id: 'test-agent', message: { role: 'user', parts: [{ text: 'stream' }] } },
      }),
    );

    expect(res.status).toBe(403);
    expect(mockHandleA2AJsonRpc).not.toHaveBeenCalled();
  });

  it('allows tasks/get without ai feature gate (read-only method)', async () => {
    // ai feature disabled but tasks/get should bypass the gate
    mockIsFeatureEnabled.mockReturnValue(false);

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(
      post('/', {
        jsonrpc: '2.0',
        id: 3,
        method: 'tasks/get',
        params: { id: 'task-1' },
      }),
    );

    expect(res.status).toBe(200);
    // Dispatcher should be called for read-only methods even when ai is disabled
    expect(mockHandleA2AJsonRpc).toHaveBeenCalledTimes(1);
  });

  it('forwards X-Agent-ID header as agentId to dispatcher', async () => {
    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(
      post(
        '/',
        { jsonrpc: '2.0', id: 6, method: 'tasks/get', params: { id: 'task-1' } },
        { 'X-Agent-ID': 'custom-agent-42' },
      ),
    );

    expect(res.status).toBe(200);
    expect(mockHandleA2AJsonRpc).toHaveBeenCalledTimes(1);
    // Second argument is the agentId from the X-Agent-ID header
    const secondArg = mockHandleA2AJsonRpc.mock.calls[0]?.[1];
    expect(secondArg).toBe('custom-agent-42');
  });
});

describe('POST /a2a/agents  -  registration edge cases', () => {
  beforeEach(() => {
    resetMocks();
    mockA2AJsonRpcSafeParse.mockImplementation((data: unknown) => ({ success: true, data }));
    mockAgentDefinitionSafeParse.mockImplementation((data: unknown) => ({ success: true, data }));
  });

  it('returns 400 when agent definition fails validation', async () => {
    mockAgentDefinitionSafeParse.mockReturnValue({
      success: false,
      error: { issues: [{ message: 'id is required', path: ['id'] }] },
    });

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(post('/agents', { name: 'Missing ID Agent' }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; issues: unknown[] };
    expect(body.error).toContain('Invalid agent definition');
    expect(body.issues).toBeDefined();
  });

  it('returns 409 when registering a duplicate agent', async () => {
    mockHas.mockReturnValue(true);

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(
      post('/agents', {
        id: 'duplicate-agent',
        name: 'Duplicate',
        description: 'Already exists',
      }),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('already registered');
  });
});

describe('DELETE /a2a/agents/:id  -  edge cases', () => {
  beforeEach(() => {
    resetMocks();
    mockA2AJsonRpcSafeParse.mockImplementation((data: unknown) => ({ success: true, data }));
    mockAgentDefinitionSafeParse.mockImplementation((data: unknown) => ({ success: true, data }));
  });

  it('returns 403 when attempting to retire built-in agent revealui-creator', async () => {
    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(
      new Request('http://localhost/agents/revealui-creator', { method: 'DELETE' }),
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Built-in platform agents cannot be retired');
  });

  it('returns 403 when attempting to retire built-in agent revealui-ticket-agent', async () => {
    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(
      new Request('http://localhost/agents/revealui-ticket-agent', { method: 'DELETE' }),
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Built-in platform agents');
  });

  it('returns 404 when unregister returns false (agent not found)', async () => {
    mockUnregister.mockReturnValue(false);

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(
      new Request('http://localhost/agents/nonexistent-agent', { method: 'DELETE' }),
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('not found');
  });
});

// ─── PR 2 of GAP-149  -  x402 pending-payment flow ──────────────────────────

describe('POST /a2a  -  x402 pending-payment flow', () => {
  beforeEach(() => {
    resetMocks();
    mockA2AJsonRpcSafeParse.mockImplementation((data: unknown) => ({ success: true, data }));
    mockAgentDefinitionSafeParse.mockImplementation((data: unknown) => ({ success: true, data }));
  });

  it('returns 402 with X-PAYMENT-REQUIRED when handler emits pending-payment state', async () => {
    mockHandleA2AJsonRpc.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: {
        id: 'task-pending-1',
        status: { state: 'pending-payment', timestamp: '2026-04-28T00:00:00.000Z' },
        metadata: { pricing: { usdc: '0.05' } },
        history: [],
      },
    });
    mockBuildPaymentRequired.mockReturnValue({
      x402Version: 1,
      accepts: [{ scheme: 'exact', network: 'evm:base', maxAmountRequired: '50000' }],
    });
    mockEncodePaymentRequired.mockReturnValue('encoded-payment-required-base64');

    const app = makeA2AApp({ id: 'user-1' }, { features: { ai: true } });
    const res = await app.request(
      post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'tasks/send',
        params: { id: 'paid-agent', message: { role: 'user', parts: [{ text: 'do work' }] } },
      }),
    );

    expect(res.status).toBe(402);
    expect(res.headers.get('X-PAYMENT-REQUIRED')).toBe('encoded-payment-required-base64');
    expect(mockBuildPaymentRequired).toHaveBeenCalledWith(expect.any(String), '0.05');
    expect(mockVerifyPayment).not.toHaveBeenCalled();
  });

  it('passes paymentVerified=true to handler when X-PAYMENT-PAYLOAD verifies', async () => {
    mockVerifyPayment.mockResolvedValue({ valid: true });
    mockHandleA2AJsonRpc.mockResolvedValue({
      jsonrpc: '2.0',
      id: 2,
      result: {
        id: 'task-completed-1',
        status: { state: 'completed' },
        history: [],
      },
    });

    const app = makeA2AApp({ id: 'user-1' }, { features: { ai: true } });
    const res = await app.request(
      post(
        '/',
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tasks/send',
          params: { id: 'paid-agent', message: { role: 'user', parts: [{ text: 'work' }] } },
        },
        { 'X-PAYMENT-PAYLOAD': 'valid-base64-proof' },
      ),
    );

    expect(res.status).toBe(200);
    expect(mockVerifyPayment).toHaveBeenCalledWith('valid-base64-proof', expect.any(String));
    const callArgs = mockHandleA2AJsonRpc.mock.calls[0];
    expect(callArgs?.[3]).toEqual({ paymentVerified: true });
  });

  it('returns 402 immediately when X-PAYMENT-PAYLOAD fails verification', async () => {
    mockVerifyPayment.mockResolvedValue({ valid: false, error: 'Invalid signature' });
    mockBuildPaymentRequired.mockReturnValue({
      x402Version: 1,
      accepts: [{ scheme: 'exact', network: 'evm:base', maxAmountRequired: '1000' }],
    });
    mockEncodePaymentRequired.mockReturnValue('encoded-fresh-requirements');

    const app = makeA2AApp({ id: 'user-1' }, { features: { ai: true } });
    const res = await app.request(
      post(
        '/',
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tasks/send',
          params: { id: 'paid-agent', message: { role: 'user', parts: [{ text: 'work' }] } },
        },
        { 'X-PAYMENT-PAYLOAD': 'bad-base64-proof' },
      ),
    );

    expect(res.status).toBe(402);
    expect(res.headers.get('X-PAYMENT-REQUIRED')).toBe('encoded-fresh-requirements');
    const body = (await res.json()) as {
      jsonrpc: string;
      id: number;
      error: { code: number; message: string };
    };
    expect(body.error.code).toBe(-32004);
    expect(body.error.message).toContain('Invalid signature');
    expect(mockHandleA2AJsonRpc).not.toHaveBeenCalled();
  });

  it('does NOT verify payment for read-only methods (tasks/get)', async () => {
    mockHandleA2AJsonRpc.mockResolvedValue({
      jsonrpc: '2.0',
      id: 4,
      result: { id: 'task-1' },
    });

    const app = makeA2AApp({ id: 'user-1' });
    const res = await app.request(
      post(
        '/',
        { jsonrpc: '2.0', id: 4, method: 'tasks/get', params: { id: 'task-1' } },
        { 'X-PAYMENT-PAYLOAD': 'irrelevant-for-read-only' },
      ),
    );

    expect(res.status).toBe(200);
    expect(mockVerifyPayment).not.toHaveBeenCalled();
  });

  it('passes paymentVerified=false to handler when no X-PAYMENT-PAYLOAD attached', async () => {
    mockHandleA2AJsonRpc.mockResolvedValue({
      jsonrpc: '2.0',
      id: 5,
      result: { id: 'task-x', status: { state: 'completed' }, history: [] },
    });

    const app = makeA2AApp({ id: 'user-1' }, { features: { ai: true } });
    const res = await app.request(
      post('/', {
        jsonrpc: '2.0',
        id: 5,
        method: 'tasks/send',
        params: { id: 'free-agent', message: { role: 'user', parts: [{ text: 'work' }] } },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockVerifyPayment).not.toHaveBeenCalled();
    const callArgs = mockHandleA2AJsonRpc.mock.calls[0];
    expect(callArgs?.[3]).toEqual({ paymentVerified: false });
  });
});
