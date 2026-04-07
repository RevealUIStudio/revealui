/**
 * Sync Route Tests
 *
 * POST        /api/sync/agent-memories              — create agent memory (AI gate)
 * PATCH/DELETE /api/sync/agent-memories/:id         — update/delete agent memory (AI gate)
 * POST        /api/sync/agent-contexts              — create/upsert agent context (AI gate)
 * PATCH/DELETE /api/sync/agent-contexts/:id         — update/delete agent context (AI gate)
 * POST        /api/sync/conversations               — create conversation (no AI gate)
 * PATCH/DELETE /api/sync/conversations/:id          — update/delete conversation
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before route imports
// ---------------------------------------------------------------------------

const { mockGetSession, mockCheckAIFeatureGate, mockGetClient } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockCheckAIFeatureGate: vi.fn(),
  mockGetClient: vi.fn(),
}));

vi.mock('@revealui/auth/server', () => ({ getSession: mockGetSession }));
vi.mock('@/lib/middleware/ai-feature-gate', () => ({ checkAIFeatureGate: mockCheckAIFeatureGate }));
vi.mock('@revealui/db', () => ({ getClient: mockGetClient }));
vi.mock('@revealui/core/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// drizzle-orm operators — identity pass-through
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => 'eq'),
  and: vi.fn((..._args: unknown[]) => 'and'),
}));

// schema tables — plain objects used as .delete()/.update() args
vi.mock('@revealui/db/schema', () => ({
  agentMemories: {},
  agentContexts: {},
  conversations: {},
  sites: { id: 'sites.id', ownerId: 'sites.ownerId' },
  eq: vi.fn((_col: unknown, _val: unknown) => 'eq'),
  and: vi.fn((..._args: unknown[]) => 'and'),
}));

// ---------------------------------------------------------------------------
// Route imports (after mocks)
// ---------------------------------------------------------------------------

import {
  DELETE as contextsDelete,
  PATCH as contextsPatch,
} from '../../app/api/sync/agent-contexts/[id]/route';
import { POST as contextsPost } from '../../app/api/sync/agent-contexts/route';
import {
  DELETE as memoriesDelete,
  PATCH as memoriesPatch,
} from '../../app/api/sync/agent-memories/[id]/route';
import { POST as memoriesPost } from '../../app/api/sync/agent-memories/route';
import {
  DELETE as convsDelete,
  PATCH as convsPatch,
} from '../../app/api/sync/conversations/[id]/route';
import { POST as convsPost } from '../../app/api/sync/conversations/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(userId = 'user-1', sessionId = 'sess-1') {
  return {
    session: { id: sessionId, userId },
    user: { id: userId, role: 'user', email: 'test@example.com' },
  };
}

const VALID_UUID = '00000000-0000-0000-0000-000000000001';

function makeRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Build a flexible Drizzle chain mock */
function makeDbChain(rows: unknown[] = [], selectRows?: unknown[]) {
  // Sub-chain for select queries (e.g. ownership check).
  // Uses a resolved promise as prototype so `await db.select().from().where().limit()` works.
  const selectPromise = Promise.resolve(selectRows ?? []);
  const selectChain = Object.assign(selectPromise, {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  });
  selectChain.from.mockReturnValue(selectChain);
  selectChain.where.mockReturnValue(selectChain);
  selectChain.limit.mockReturnValue(selectChain);

  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn(),
    values: vi.fn(),
    onConflictDoUpdate: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    where: vi.fn(),
    returning: vi.fn().mockResolvedValue(rows),
  };
  // make every method return `chain` for fluent chaining (except select/returning)
  for (const key of Object.keys(chain)) {
    if (key !== 'returning' && key !== 'select') chain[key]!.mockReturnValue(chain);
  }
  return chain;
}

// ---------------------------------------------------------------------------
// Tests — POST /api/sync/agent-memories
// ---------------------------------------------------------------------------

describe('POST /api/sync/agent-memories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when AI feature gate is active', async () => {
    mockCheckAIFeatureGate.mockReturnValue(
      new Response(JSON.stringify({ error: 'AI features require a Pro license' }), { status: 403 }),
    );
    const req = makeRequest('http://localhost/api/sync/agent-memories', 'POST', {});
    const res = await memoriesPost(req);
    expect(res.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(null);
    const req = makeRequest('http://localhost/api/sync/agent-memories', 'POST', {});
    const res = await memoriesPost(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid agent_id', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const req = makeRequest('http://localhost/api/sync/agent-memories', 'POST', {
      agent_id: 'bad agent!',
      content: 'text',
      type: 'fact',
      source: {},
      site_id: 'site-1',
    });
    const res = await memoriesPost(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid memory type', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const req = makeRequest('http://localhost/api/sync/agent-memories', 'POST', {
      agent_id: 'agent-1',
      content: 'text',
      type: 'invalid-type',
      source: {},
      site_id: 'site-1',
    });
    const res = await memoriesPost(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when source is not an object', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const req = makeRequest('http://localhost/api/sync/agent-memories', 'POST', {
      agent_id: 'agent-1',
      content: 'text',
      type: 'fact',
      source: 'not-an-object',
      site_id: 'site-1',
    });
    const res = await memoriesPost(req);
    expect(res.status).toBe(400);
  });

  it('returns 201 with created memory on success', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const created = { id: VALID_UUID, agentId: 'agent-1', content: 'text', type: 'fact' };
    // selectRows: ownership check returns a site owned by user-1
    const chain = makeDbChain([created], [{ ownerId: 'user-1' }]);
    mockGetClient.mockReturnValue(chain);
    const req = makeRequest('http://localhost/api/sync/agent-memories', 'POST', {
      agent_id: 'agent-1',
      content: 'text',
      type: 'fact',
      source: { file: 'index.ts' },
      site_id: 'site-1',
    });
    const res = await memoriesPost(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(VALID_UUID);
  });
});

// ---------------------------------------------------------------------------
// Tests — PATCH /api/sync/agent-memories/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/sync/agent-memories/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when AI gate is active', async () => {
    mockCheckAIFeatureGate.mockReturnValue(
      new Response(JSON.stringify({ error: 'AI features require a Pro license' }), { status: 403 }),
    );
    const req = makeRequest(`http://localhost/api/sync/agent-memories/${VALID_UUID}`, 'PATCH', {});
    const res = await memoriesPatch(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(null);
    const req = makeRequest(`http://localhost/api/sync/agent-memories/${VALID_UUID}`, 'PATCH', {});
    const res = await memoriesPatch(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid UUID', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const req = makeRequest('http://localhost/api/sync/agent-memories/not-a-uuid', 'PATCH', {
      content: 'updated',
    });
    const res = await memoriesPatch(req, { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when no fields to update', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const chain = makeDbChain([]);
    mockGetClient.mockReturnValue(chain);
    const req = makeRequest(
      `http://localhost/api/sync/agent-memories/${VALID_UUID}`,
      'PATCH',
      {}, // empty body — no update fields
    );
    const res = await memoriesPatch(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when memory not found', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const chain = makeDbChain([]); // empty → no rows returned
    mockGetClient.mockReturnValue(chain);
    const req = makeRequest(`http://localhost/api/sync/agent-memories/${VALID_UUID}`, 'PATCH', {
      content: 'updated',
    });
    const res = await memoriesPatch(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const updated = { id: VALID_UUID, content: 'updated' };
    const chain = makeDbChain([updated]);
    mockGetClient.mockReturnValue(chain);
    const req = makeRequest(`http://localhost/api/sync/agent-memories/${VALID_UUID}`, 'PATCH', {
      content: 'updated',
    });
    const res = await memoriesPatch(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests — DELETE /api/sync/agent-memories/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/sync/agent-memories/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(null);
    const req = new NextRequest(`http://localhost/api/sync/agent-memories/${VALID_UUID}`, {
      method: 'DELETE',
    });
    const res = await memoriesDelete(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when memory not found', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const chain = makeDbChain([]);
    mockGetClient.mockReturnValue(chain);
    const req = new NextRequest(`http://localhost/api/sync/agent-memories/${VALID_UUID}`, {
      method: 'DELETE',
    });
    const res = await memoriesDelete(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const chain = makeDbChain([{ id: VALID_UUID }]);
    mockGetClient.mockReturnValue(chain);
    const req = new NextRequest(`http://localhost/api/sync/agent-memories/${VALID_UUID}`, {
      method: 'DELETE',
    });
    const res = await memoriesDelete(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /api/sync/agent-contexts
// ---------------------------------------------------------------------------

describe('POST /api/sync/agent-contexts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when AI gate is active', async () => {
    mockCheckAIFeatureGate.mockReturnValue(
      new Response(JSON.stringify({ error: 'AI features require a Pro license' }), { status: 403 }),
    );
    const req = makeRequest('http://localhost/api/sync/agent-contexts', 'POST', {});
    const res = await contextsPost(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for priority out of range', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const req = makeRequest('http://localhost/api/sync/agent-contexts', 'POST', {
      agent_id: 'agent-1',
      priority: 1.5, // out of range
    });
    const res = await contextsPost(req);
    expect(res.status).toBe(400);
  });

  it('returns 201 on successful upsert', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const created = { id: 'sess-1:agent-1', sessionId: 'sess-1', agentId: 'agent-1' };
    const chain = makeDbChain([created]);
    mockGetClient.mockReturnValue(chain);
    const req = makeRequest('http://localhost/api/sync/agent-contexts', 'POST', {
      agent_id: 'agent-1',
      context: { key: 'value' },
      priority: 0.8,
    });
    const res = await contextsPost(req);
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// Tests — PATCH /api/sync/agent-contexts/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/sync/agent-contexts/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(null);
    const req = makeRequest('http://localhost/api/sync/agent-contexts/ctx-1', 'PATCH', {});
    const res = await contextsPatch(req, { params: Promise.resolve({ id: 'ctx-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 for priority out of range', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const req = makeRequest('http://localhost/api/sync/agent-contexts/ctx-1', 'PATCH', {
      priority: -0.1,
    });
    const res = await contextsPatch(req, { params: Promise.resolve({ id: 'ctx-1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when context not found for this session', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const chain = makeDbChain([]);
    mockGetClient.mockReturnValue(chain);
    const req = makeRequest('http://localhost/api/sync/agent-contexts/ctx-1', 'PATCH', {
      context: { k: 'v' },
    });
    const res = await contextsPatch(req, { params: Promise.resolve({ id: 'ctx-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const chain = makeDbChain([{ id: 'ctx-1' }]);
    mockGetClient.mockReturnValue(chain);
    const req = makeRequest('http://localhost/api/sync/agent-contexts/ctx-1', 'PATCH', {
      context: { k: 'v' },
    });
    const res = await contextsPatch(req, { params: Promise.resolve({ id: 'ctx-1' }) });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests — DELETE /api/sync/agent-contexts/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/sync/agent-contexts/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when context not found for this session', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const chain = makeDbChain([]);
    mockGetClient.mockReturnValue(chain);
    const req = new NextRequest('http://localhost/api/sync/agent-contexts/ctx-1', {
      method: 'DELETE',
    });
    const res = await contextsDelete(req, { params: Promise.resolve({ id: 'ctx-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    mockCheckAIFeatureGate.mockReturnValue(null);
    mockGetSession.mockResolvedValue(makeSession());
    const chain = makeDbChain([{ id: 'ctx-1' }]);
    mockGetClient.mockReturnValue(chain);
    const req = new NextRequest('http://localhost/api/sync/agent-contexts/ctx-1', {
      method: 'DELETE',
    });
    const res = await contextsDelete(req, { params: Promise.resolve({ id: 'ctx-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /api/sync/conversations
// ---------------------------------------------------------------------------

describe('POST /api/sync/conversations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = makeRequest('http://localhost/api/sync/conversations', 'POST', {});
    const res = await convsPost(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid agent_id', async () => {
    mockGetSession.mockResolvedValue(makeSession());
    const req = makeRequest('http://localhost/api/sync/conversations', 'POST', {
      agent_id: 'bad agent!',
    });
    const res = await convsPost(req);
    expect(res.status).toBe(400);
  });

  it('returns 201 with created conversation', async () => {
    mockGetSession.mockResolvedValue(makeSession());
    const created = { id: VALID_UUID, agentId: 'agent-1', userId: 'user-1' };
    const chain = makeDbChain([created]);
    mockGetClient.mockReturnValue(chain);
    const req = makeRequest('http://localhost/api/sync/conversations', 'POST', {
      agent_id: 'agent-1',
      title: 'Test convo',
    });
    const res = await convsPost(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(VALID_UUID);
  });
});

// ---------------------------------------------------------------------------
// Tests — PATCH /api/sync/conversations/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/sync/conversations/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = makeRequest(`http://localhost/api/sync/conversations/${VALID_UUID}`, 'PATCH', {});
    const res = await convsPatch(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid UUID', async () => {
    mockGetSession.mockResolvedValue(makeSession());
    const req = makeRequest('http://localhost/api/sync/conversations/not-uuid', 'PATCH', {
      title: 'new title',
    });
    const res = await convsPatch(req, { params: Promise.resolve({ id: 'not-uuid' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when conversation not found (or owned by different user)', async () => {
    mockGetSession.mockResolvedValue(makeSession());
    const chain = makeDbChain([]);
    mockGetClient.mockReturnValue(chain);
    const req = makeRequest(`http://localhost/api/sync/conversations/${VALID_UUID}`, 'PATCH', {
      title: 'new title',
    });
    const res = await convsPatch(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    mockGetSession.mockResolvedValue(makeSession());
    const chain = makeDbChain([{ id: VALID_UUID, title: 'new title' }]);
    mockGetClient.mockReturnValue(chain);
    const req = makeRequest(`http://localhost/api/sync/conversations/${VALID_UUID}`, 'PATCH', {
      title: 'new title',
    });
    const res = await convsPatch(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests — DELETE /api/sync/conversations/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/sync/conversations/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = new NextRequest(`http://localhost/api/sync/conversations/${VALID_UUID}`, {
      method: 'DELETE',
    });
    const res = await convsDelete(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid UUID', async () => {
    mockGetSession.mockResolvedValue(makeSession());
    const req = new NextRequest('http://localhost/api/sync/conversations/not-uuid', {
      method: 'DELETE',
    });
    const res = await convsDelete(req, { params: Promise.resolve({ id: 'not-uuid' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    mockGetSession.mockResolvedValue(makeSession());
    const chain = makeDbChain([]);
    mockGetClient.mockReturnValue(chain);
    const req = new NextRequest(`http://localhost/api/sync/conversations/${VALID_UUID}`, {
      method: 'DELETE',
    });
    const res = await convsDelete(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    mockGetSession.mockResolvedValue(makeSession());
    const chain = makeDbChain([{ id: VALID_UUID }]);
    mockGetClient.mockReturnValue(chain);
    const req = new NextRequest(`http://localhost/api/sync/conversations/${VALID_UUID}`, {
      method: 'DELETE',
    });
    const res = await convsDelete(req, { params: Promise.resolve({ id: VALID_UUID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
