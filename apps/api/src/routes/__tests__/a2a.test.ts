/**
 * A2A Route Tests
 *
 * Covers:
 *   Well-known discovery:
 *     GET /.well-known/agent.json
 *     GET /.well-known/agents/:id/agent.json
 *   A2A task API:
 *     GET  /a2a/agents
 *     GET  /a2a/agents/:id
 *     GET  /a2a/agents/:id/def   (requires 'ai' feature)
 *     POST /a2a/agents           (requires 'ai' feature)
 *     PUT  /a2a/agents/:id       (requires 'ai' feature)
 *     DELETE /a2a/agents/:id     (requires 'ai' feature)
 *     POST /a2a                  (JSON-RPC dispatcher)
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks — vi.hoisted() ensures these are available inside vi.mock factories ─

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
}));

vi.mock('@revealui/ai/llm/server', () => ({
  createLLMClientForUser: vi.fn(),
  LLMClient: class LLMClient {},
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

vi.mock('@revealui/core/license', () => ({
  initializeLicense: vi.fn(),
}));

// Mock auth middleware — passes through by default (auth enforced in integration tests)
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

// Mock license middleware — requireFeature delegates to mockIsFeatureEnabled at request time
vi.mock('../../middleware/license.js', () => ({
  requireFeature: vi.fn(
    (feature: string) =>
      async (
        c: { json: (data: unknown, status: number) => unknown },
        next: () => Promise<void>,
      ) => {
        if (!mockIsFeatureEnabled(feature)) {
          return c.json(
            { error: `Feature '${feature}' requires a Pro or Enterprise license.` },
            403,
          );
        }
        return next();
      },
  ),
  checkLicenseStatus: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
}));

// Contracts — real Zod schemas replaced with pass-through mocks
vi.mock('@revealui/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@revealui/contracts')>();
  return {
    ...actual,
    AgentDefinitionSchema: {
      safeParse: mockAgentDefinitionSafeParse,
    },
    A2AJsonRpcRequestSchema: {
      safeParse: mockA2AJsonRpcSafeParse,
    },
  };
});

// DB mock — fluent Drizzle chain
let _dbResult: unknown[] = [];

const mockDbChain = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const selectChain = {
  from: vi.fn(),
  then(
    onFulfilled?: (value: unknown[]) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ): Promise<unknown> {
    return Promise.resolve(_dbResult).then(onFulfilled, onRejected);
  },
};
selectChain.from.mockReturnValue(selectChain);

const insertChain = { values: vi.fn().mockResolvedValue(undefined) };
const updateChain = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
updateChain.set.mockReturnValue(updateChain);
const deleteChain = { where: vi.fn().mockResolvedValue(undefined) };

mockGetClient.mockReturnValue(mockDbChain);

vi.mock('@revealui/db', () => ({
  getClient: mockGetClient,
}));

vi.mock('@revealui/db/schema', () => ({
  registeredAgents: { id: 'registeredAgents.id', definition: 'registeredAgents.definition' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => `eq(${String(_col)},${String(_val)})`),
}));

// ─── Import under test (after mocks) ─────────────────────────────────────────

import { a2aRoutes, wellKnownRoutes } from '../a2a.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWellKnownApp() {
  const app = new Hono();
  app.route('/', wellKnownRoutes);
  return app;
}

function makeA2AApp() {
  const app = new Hono();
  app.route('/', a2aRoutes);
  return app;
}

function get(path: string) {
  return new Request(`http://localhost${path}`, { method: 'GET' });
}

function post(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function put(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function del(path: string) {
  return new Request(`http://localhost${path}`, { method: 'DELETE' });
}

const MOCK_CARD = {
  id: 'test-agent',
  name: 'Test Agent',
  url: 'http://localhost/a2a',
  version: '1.0',
  capabilities: {},
  skills: [],
};

const MOCK_DEF = {
  id: 'test-agent',
  name: 'Test Agent',
  description: 'A test agent',
  systemPrompt: 'You are helpful.',
  tools: [],
  capabilities: {},
};

function resetMocks() {
  vi.clearAllMocks();
  _dbResult = [];

  mockDbChain.select.mockReturnValue(selectChain);
  mockDbChain.insert.mockReturnValue(insertChain);
  mockDbChain.update.mockReturnValue(updateChain);
  mockDbChain.delete.mockReturnValue(deleteChain);

  mockGetCard.mockReturnValue(MOCK_CARD);
  mockListCards.mockReturnValue([MOCK_CARD]);
  mockHas.mockReturnValue(false);
  mockGetDef.mockReturnValue(MOCK_DEF);
  mockRegister.mockImplementation(() => undefined);
  mockUnregister.mockReturnValue(true);
  mockUpdate.mockImplementation(() => undefined);
  mockIsFeatureEnabled.mockReturnValue(true);
  mockHandleA2AJsonRpc.mockResolvedValue({
    jsonrpc: '2.0',
    id: 1,
    result: { status: 'ok' },
  });
}

// ─── Well-known discovery ─────────────────────────────────────────────────────

describe('GET /.well-known/agent.json', () => {
  beforeEach(resetMocks);

  it('returns the platform creator agent card', async () => {
    const app = makeWellKnownApp();
    const res = await app.request(get('/agent.json'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_CARD;
    expect(body.id).toBe(MOCK_CARD.id);
    expect(mockGetCard).toHaveBeenCalledWith('revealui-creator', expect.any(String));
  });

  it('returns 404 when the creator agent is not registered', async () => {
    mockGetCard.mockReturnValue(null);
    const app = makeWellKnownApp();
    const res = await app.request(get('/agent.json'));
    expect(res.status).toBe(404);
  });

  it('sets Cache-Control header', async () => {
    const app = makeWellKnownApp();
    const res = await app.request(get('/agent.json'));
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
  });
});

describe('GET /.well-known/agents/:id/agent.json', () => {
  beforeEach(resetMocks);

  it('returns a specific agent card by ID', async () => {
    const app = makeWellKnownApp();
    const res = await app.request(get('/agents/test-agent/agent.json'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_CARD;
    expect(body.id).toBe(MOCK_CARD.id);
    expect(mockGetCard).toHaveBeenCalledWith('test-agent', expect.any(String));
  });

  it('returns 404 when agent is not found', async () => {
    mockGetCard.mockReturnValue(null);
    const app = makeWellKnownApp();
    const res = await app.request(get('/agents/unknown/agent.json'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('unknown');
  });
});

// ─── GET /agents ──────────────────────────────────────────────────────────────

describe('GET /agents', () => {
  beforeEach(resetMocks);

  it('lists all registered agent cards', async () => {
    const app = makeA2AApp();
    const res = await app.request(get('/agents'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agents: (typeof MOCK_CARD)[] };
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0]?.id).toBe(MOCK_CARD.id);
  });

  it('returns empty agents array when registry is empty', async () => {
    mockListCards.mockReturnValue([]);
    const app = makeA2AApp();
    const res = await app.request(get('/agents'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agents: unknown[] };
    expect(body.agents).toHaveLength(0);
  });
});

// ─── GET /agents/:id ──────────────────────────────────────────────────────────

describe('GET /agents/:id', () => {
  beforeEach(resetMocks);

  it('returns a single agent card', async () => {
    const app = makeA2AApp();
    const res = await app.request(get('/agents/test-agent'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_CARD;
    expect(body.id).toBe(MOCK_CARD.id);
  });

  it('returns 404 for unknown agent', async () => {
    mockGetCard.mockReturnValue(null);
    const app = makeA2AApp();
    const res = await app.request(get('/agents/ghost'));
    expect(res.status).toBe(404);
  });
});

// ─── GET /agents/:id/def ──────────────────────────────────────────────────────

describe('GET /agents/:id/def', () => {
  beforeEach(resetMocks);

  it('returns the full agent definition', async () => {
    mockGetDef.mockReturnValue(MOCK_DEF);
    const app = makeA2AApp();
    const res = await app.request(get('/agents/test-agent/def'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { def: typeof MOCK_DEF };
    expect(body.def.id).toBe(MOCK_DEF.id);
    expect(body.def.systemPrompt).toBe(MOCK_DEF.systemPrompt);
  });

  it('returns 404 when agent definition is not found', async () => {
    mockGetDef.mockReturnValue(null);
    const app = makeA2AApp();
    const res = await app.request(get('/agents/ghost/def'));
    expect(res.status).toBe(404);
  });
});

// ─── POST /agents ─────────────────────────────────────────────────────────────

describe('POST /agents', () => {
  beforeEach(resetMocks);

  it('registers a new agent and returns 201 with the card', async () => {
    mockHas.mockReturnValue(false);
    mockGetCard.mockReturnValue(MOCK_CARD);

    const app = makeA2AApp();
    const res = await app.request(post('/agents', MOCK_DEF));

    expect(res.status).toBe(201);
    const body = (await res.json()) as { card: typeof MOCK_CARD };
    expect(body.card.id).toBe(MOCK_CARD.id);
    expect(mockRegister).toHaveBeenCalledWith(MOCK_DEF);
  });

  it('returns 409 when agent ID is already registered', async () => {
    mockHas.mockReturnValue(true);
    const app = makeA2AApp();
    const res = await app.request(post('/agents', MOCK_DEF));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('already registered');
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('returns 403 when ai feature is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);
    const app = makeA2AApp();
    const res = await app.request(post('/agents', MOCK_DEF));
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid JSON', async () => {
    const app = makeA2AApp();
    const req = new Request('http://localhost/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await app.request(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when AgentDefinitionSchema validation fails', async () => {
    mockAgentDefinitionSafeParse.mockReturnValueOnce({
      success: false,
      error: { issues: [{ message: 'id is required', path: ['id'] }] },
    } as never);

    const app = makeA2AApp();
    const res = await app.request(post('/agents', {}));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; issues: unknown[] };
    expect(body.error).toBe('Invalid agent definition');
    expect(body.issues).toHaveLength(1);
  });
});

// ─── PUT /agents/:id ──────────────────────────────────────────────────────────

describe('PUT /agents/:id', () => {
  beforeEach(resetMocks);

  it('updates mutable fields and returns the updated card', async () => {
    mockHas.mockReturnValue(true);
    mockGetDef.mockReturnValue(MOCK_DEF);
    mockGetCard.mockReturnValue({ ...MOCK_CARD, name: 'Updated Name' });

    const app = makeA2AApp();
    const res = await app.request(put('/agents/test-agent', { name: 'Updated Name' }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { card: typeof MOCK_CARD };
    expect(body.card.name).toBe('Updated Name');
    expect(mockUpdate).toHaveBeenCalledWith('test-agent', { name: 'Updated Name' });
  });

  it('returns 404 for an unknown agent', async () => {
    mockHas.mockReturnValue(false);
    const app = makeA2AApp();
    const res = await app.request(put('/agents/ghost', { name: 'X' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid JSON body', async () => {
    mockHas.mockReturnValue(true);
    const app = makeA2AApp();
    const req = new Request('http://localhost/agents/test-agent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad-json',
    });
    const res = await app.request(req);
    expect(res.status).toBe(400);
  });

  it('persists update to DB for custom agents', async () => {
    mockHas.mockReturnValue(true);
    mockGetDef.mockReturnValue(MOCK_DEF);
    mockGetCard.mockReturnValue(MOCK_CARD);

    const app = makeA2AApp();
    await app.request(put('/agents/test-agent', { description: 'New desc' }));

    expect(mockDbChain.update).toHaveBeenCalled();
  });

  it('skips DB update for built-in agents', async () => {
    mockHas.mockReturnValue(true);
    mockGetDef.mockReturnValue({ ...MOCK_DEF, id: 'revealui-creator' });
    mockGetCard.mockReturnValue({ ...MOCK_CARD, id: 'revealui-creator' });

    const app = makeA2AApp();
    await app.request(put('/agents/revealui-creator', { name: 'X' }));

    expect(mockDbChain.update).not.toHaveBeenCalled();
  });
});

// ─── DELETE /agents/:id ───────────────────────────────────────────────────────

describe('DELETE /agents/:id', () => {
  beforeEach(resetMocks);

  it('retires a custom agent and returns success', async () => {
    mockUnregister.mockReturnValue(true);
    const app = makeA2AApp();
    const res = await app.request(del('/agents/test-agent'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
    expect(mockUnregister).toHaveBeenCalledWith('test-agent');
  });

  it('returns 404 when agent is not found', async () => {
    mockUnregister.mockReturnValue(false);
    const app = makeA2AApp();
    const res = await app.request(del('/agents/ghost'));
    expect(res.status).toBe(404);
  });

  it('returns 403 for built-in agents (revealui-creator)', async () => {
    const app = makeA2AApp();
    const res = await app.request(del('/agents/revealui-creator'));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Built-in');
    expect(mockUnregister).not.toHaveBeenCalled();
  });

  it('returns 403 for built-in agents (revealui-ticket-agent)', async () => {
    const app = makeA2AApp();
    const res = await app.request(del('/agents/revealui-ticket-agent'));
    expect(res.status).toBe(403);
    expect(mockUnregister).not.toHaveBeenCalled();
  });

  it('removes agent from DB after unregistering', async () => {
    mockUnregister.mockReturnValue(true);
    const app = makeA2AApp();
    await app.request(del('/agents/test-agent'));
    expect(mockDbChain.delete).toHaveBeenCalled();
  });
});

// ─── POST /a2a (JSON-RPC dispatcher) ──────────────────────────────────────────

describe('POST /a2a (JSON-RPC dispatcher)', () => {
  beforeEach(resetMocks);

  it('dispatches tasks/get and returns result', async () => {
    mockHandleA2AJsonRpc.mockResolvedValue({
      jsonrpc: '2.0',
      id: 42,
      result: { taskId: 'task-1', status: { state: 'completed' } },
    });

    const app = makeA2AApp();
    const res = await app.request(
      post('/', { jsonrpc: '2.0', id: 42, method: 'tasks/get', params: { id: 'task-1' } }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: number; result: unknown };
    expect(body.id).toBe(42);
    expect(mockHandleA2AJsonRpc).toHaveBeenCalled();
  });

  it('gates tasks/send behind the ai feature flag', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const app = makeA2AApp();
    const res = await app.request(
      post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'tasks/send',
        params: { id: 'test-agent', message: { role: 'user', parts: [{ text: 'hi' }] } },
      }),
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: number; message: string } };
    expect(body.error.message).toContain('Pro or Enterprise');
  });

  it('allows tasks/get without ai feature', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const app = makeA2AApp();
    const res = await app.request(
      post('/', { jsonrpc: '2.0', id: 1, method: 'tasks/get', params: { id: 'task-1' } }),
    );

    // Should reach dispatcher (not blocked by feature gate)
    expect(mockHandleA2AJsonRpc).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('returns error for invalid JSON body', async () => {
    const app = makeA2AApp();
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });
    const res = await app.request(req);
    // OpenAPI framework rejects malformed JSON before the handler runs
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns JSON-RPC invalid request for malformed request object', async () => {
    mockA2AJsonRpcSafeParse.mockReturnValueOnce({
      success: false,
      error: { issues: [{ message: 'method is required' }] },
    } as never);

    const app = makeA2AApp();
    const res = await app.request(post('/', { jsonrpc: '2.0' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32600); // RPC_INVALID_REQUEST
  });

  it('calls dispatcher with the parsed RPC request and optional agent ID', async () => {
    const app = makeA2AApp();
    // Send request without X-Agent-ID — dispatcher should receive (req, undefined)
    const res = await app.request(
      post('/', { jsonrpc: '2.0', id: 99, method: 'tasks/cancel', params: { id: 'task-1' } }),
    );
    expect(res.status).toBe(200);
    expect(mockHandleA2AJsonRpc).toHaveBeenCalledTimes(1);
    // First arg is the parsed RPC request object
    const [rpcArg] = mockHandleA2AJsonRpc.mock.calls[0] ?? [];
    expect(rpcArg).toMatchObject({ jsonrpc: '2.0', id: 99, method: 'tasks/cancel' });
  });

  it('gates tasks/sendSubscribe behind the ai feature flag', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const app = makeA2AApp();
    const res = await app.request(
      post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'tasks/sendSubscribe',
        params: { id: 'test-agent', message: { role: 'user', parts: [{ text: 'stream' }] } },
      }),
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('Pro or Enterprise');
  });

  it('allows tasks/cancel without ai feature', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const app = makeA2AApp();
    const res = await app.request(
      post('/', { jsonrpc: '2.0', id: 1, method: 'tasks/cancel', params: { id: 'task-1' } }),
    );

    expect(mockHandleA2AJsonRpc).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('forwards X-Agent-ID header to dispatcher', async () => {
    const app = makeA2AApp();
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-ID': 'custom-agent-42',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tasks/get',
        params: { id: 'task-1' },
      }),
    });
    const res = await app.request(req);
    expect(res.status).toBe(200);
    expect(mockHandleA2AJsonRpc).toHaveBeenCalledTimes(1);
    const [, agentIdArg] = mockHandleA2AJsonRpc.mock.calls[0] ?? [];
    expect(agentIdArg).toBe('custom-agent-42');
  });
});

// ─── Agent ID format validation ──────────────────────────────────────────────

describe('Agent ID format validation', () => {
  beforeEach(resetMocks);

  it('GET /agents/:id returns 400 for invalid ID format', async () => {
    const app = makeA2AApp();
    // IDs must match /^[\w-]{1,256}$/
    const res = await app.request(get('/agents/invalid id with spaces'));
    // The route handler checks the pattern and returns 400
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Invalid agent ID format');
  });

  it('PUT /agents/:id returns 400 for invalid ID format', async () => {
    mockHas.mockReturnValue(false);
    const app = makeA2AApp();
    // Spaces in agent ID fail the /^[\w-]{1,256}$/ validation
    const res = await app.request(put('/agents/bad agent id!', { name: 'exploit' }));
    expect(res.status).toBe(400);
  });

  it('DELETE /agents/:id returns 400 for invalid ID format', async () => {
    const app = makeA2AApp();
    const res = await app.request(del('/agents/bad id!@#'));
    expect(res.status).toBe(400);
  });
});

// ─── POST /agents — DB persistence ──────────────────────────────────────────

describe('POST /agents — DB persistence', () => {
  beforeEach(resetMocks);

  it('persists new agent to DB after registration', async () => {
    mockHas.mockReturnValue(false);
    mockGetCard.mockReturnValue(MOCK_CARD);

    const app = makeA2AApp();
    const res = await app.request(post('/agents', MOCK_DEF));
    expect(res.status).toBe(201);
    expect(mockDbChain.insert).toHaveBeenCalled();
  });

  it('succeeds even when DB persist fails (best-effort)', async () => {
    mockHas.mockReturnValue(false);
    mockGetCard.mockReturnValue(MOCK_CARD);
    insertChain.values.mockRejectedValueOnce(new Error('DB write failed'));

    const app = makeA2AApp();
    const res = await app.request(post('/agents', MOCK_DEF));
    // Registration still succeeds in-memory even if DB fails
    expect(res.status).toBe(201);
    const body = (await res.json()) as { card: typeof MOCK_CARD };
    expect(body.card.id).toBe(MOCK_CARD.id);
  });
});
