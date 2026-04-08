/**
 * Tests for conversation API routes:
 * - GET/POST  /api/conversations
 * - GET/PATCH/DELETE /api/conversations/:id
 * - GET/POST  /api/conversations/:id/messages
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockIsFeatureEnabled = vi.fn();
const mockGetClient = vi.fn();
const mockGetConversations = vi.fn();
const mockCreateConversation = vi.fn();
const mockGetConversationById = vi.fn();
const mockUpdateConversationTitle = vi.fn();
const mockDeleteConversation = vi.fn();
const mockGetMessages = vi.fn();
const mockAddMessage = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: (...args: unknown[]) => mockIsFeatureEnabled(...args),
}));

vi.mock('@revealui/db', () => ({
  getClient: () => mockGetClient(),
}));

vi.mock('@revealui/db/queries/conversations', () => ({
  getConversations: (...args: unknown[]) => mockGetConversations(...args),
  createConversation: (...args: unknown[]) => mockCreateConversation(...args),
  getConversationById: (...args: unknown[]) => mockGetConversationById(...args),
  updateConversationTitle: (...args: unknown[]) => mockUpdateConversationTitle(...args),
  deleteConversation: (...args: unknown[]) => mockDeleteConversation(...args),
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
  addMessage: (...args: unknown[]) => mockAddMessage(...args),
}));

function makeRequest(opts: { searchParams?: Record<string, string>; body?: unknown } = {}) {
  const url = new URL('http://localhost:4000/api/conversations');
  if (opts.searchParams) {
    for (const [k, v] of Object.entries(opts.searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  return {
    headers: { get: () => null },
    nextUrl: url,
    json:
      opts.body !== undefined
        ? () => Promise.resolve(opts.body)
        : () => Promise.reject(new Error('no body')),
  } as never;
}

// ─── GET/POST /api/conversations ────────────────────────────────────────────

describe('GET /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../route.js');
    return mod.GET;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const GET = await loadRoute();
    const res = await GET(makeRequest());
    const body = await (res as Response).json();
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when AI features disabled', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(false);
    const GET = await loadRoute();
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns paginated conversations', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);
    mockGetClient.mockReturnValue({});
    mockGetConversations.mockResolvedValue([{ id: 'c1', title: 'Test' }]);

    const GET = await loadRoute();
    const res = await GET(makeRequest({ searchParams: { limit: '10', offset: '5' } }));
    const body = await (res as Response).json();

    expect(res.status).toBe(200);
    expect(body.conversations).toHaveLength(1);
    expect(mockGetConversations).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      expect.objectContaining({ limit: 10, offset: 5 }),
    );
  });

  it('clamps limit to 100 and offset to 0', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);
    mockGetClient.mockReturnValue({});
    mockGetConversations.mockResolvedValue([]);

    const GET = await loadRoute();
    await GET(makeRequest({ searchParams: { limit: '999', offset: '-5' } }));

    expect(mockGetConversations).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      expect.objectContaining({ limit: 100, offset: 0 }),
    );
  });
});

describe('POST /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../route.js');
    return mod.POST;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const POST = await loadRoute();
    const res = await POST(makeRequest({ body: { title: 'New' } }));
    expect(res.status).toBe(401);
  });

  it('creates conversation and returns 201', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);
    mockGetClient.mockReturnValue({});
    mockCreateConversation.mockResolvedValue({ id: 'c-new', title: 'New Chat' });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ body: { title: 'New Chat' } }));
    const body = await (res as Response).json();

    expect(res.status).toBe(201);
    expect(body.conversation.title).toBe('New Chat');
  });
});

// ─── GET/PATCH/DELETE /api/conversations/:id ────────────────────────────────

describe('GET /api/conversations/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../[id]/route.js');
    return mod.GET;
  }

  it('returns 404 when conversation not found', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);
    mockGetClient.mockReturnValue({});
    mockGetConversationById.mockResolvedValue(null);

    const GET = await loadRoute();
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'nonexistent' }) });
    expect(res.status).toBe(404);
  });

  it('returns conversation when found', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);
    mockGetClient.mockReturnValue({});
    mockGetConversationById.mockResolvedValue({ id: 'c1', title: 'Hello' });

    const GET = await loadRoute();
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'c1' }) });
    const body = await (res as Response).json();

    expect(res.status).toBe(200);
    expect(body.conversation.id).toBe('c1');
  });
});

describe('PATCH /api/conversations/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../[id]/route.js');
    return mod.PATCH;
  }

  it('returns 400 when title is missing', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);

    const PATCH = await loadRoute();
    const res = await PATCH(makeRequest({ body: {} }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(400);
  });

  it('updates title and returns conversation', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);
    mockGetClient.mockReturnValue({});
    mockUpdateConversationTitle.mockResolvedValue({ id: 'c1', title: 'Updated' });

    const PATCH = await loadRoute();
    const res = await PATCH(makeRequest({ body: { title: 'Updated' } }), {
      params: Promise.resolve({ id: 'c1' }),
    });
    const body = await (res as Response).json();

    expect(res.status).toBe(200);
    expect(body.conversation.title).toBe('Updated');
  });
});

describe('DELETE /api/conversations/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../[id]/route.js');
    return mod.DELETE;
  }

  it('returns 404 when conversation not found', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);
    mockGetClient.mockReturnValue({});
    mockDeleteConversation.mockResolvedValue(null);

    const DEL = await loadRoute();
    const res = await DEL(makeRequest(), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(404);
  });

  it('deletes and returns success', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);
    mockGetClient.mockReturnValue({});
    mockDeleteConversation.mockResolvedValue({ id: 'c1' });

    const DEL = await loadRoute();
    const res = await DEL(makeRequest(), { params: Promise.resolve({ id: 'c1' }) });
    const body = await (res as Response).json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── GET/POST /api/conversations/:id/messages ──────────────────────────────

describe('GET /api/conversations/:id/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../[id]/messages/route.js');
    return mod.GET;
  }

  it('returns 404 when conversation not owned by user', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);
    mockGetClient.mockReturnValue({});
    mockGetConversationById.mockResolvedValue(null);

    const GET = await loadRoute();
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'c-other' }) });
    expect(res.status).toBe(404);
  });

  it('returns messages for owned conversation', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);
    mockGetClient.mockReturnValue({});
    mockGetConversationById.mockResolvedValue({ id: 'c1' });
    mockGetMessages.mockResolvedValue([{ id: 'm1', role: 'user', content: 'Hi' }]);

    const GET = await loadRoute();
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'c1' }) });
    const body = await (res as Response).json();

    expect(res.status).toBe(200);
    expect(body.messages).toHaveLength(1);
  });
});

describe('POST /api/conversations/:id/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../[id]/messages/route.js');
    return mod.POST;
  }

  it('returns 400 when role or content missing', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);

    const POST = await loadRoute();
    const res = await POST(makeRequest({ body: { role: 'user' } }), {
      params: Promise.resolve({ id: 'c1' }),
    });
    expect(res.status).toBe(400);
  });

  it('adds message and returns 201', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockIsFeatureEnabled.mockReturnValue(true);
    mockGetClient.mockReturnValue({});
    mockGetConversationById.mockResolvedValue({ id: 'c1' });
    mockAddMessage.mockResolvedValue({ id: 'm-new', role: 'user', content: 'Hello' });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ body: { role: 'user', content: 'Hello' } }), {
      params: Promise.resolve({ id: 'c1' }),
    });
    const body = await (res as Response).json();

    expect(res.status).toBe(201);
    expect(body.message.content).toBe('Hello');
  });
});
