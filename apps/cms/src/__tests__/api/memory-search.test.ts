/**
 * Memory Search Route Tests
 *
 * Tests for POST /api/memory/search (vector) and POST /api/memory/search-text.
 * Validates auth, input validation, access control, and Pro dependency handling.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSearchSimilar = vi
  .fn()
  .mockResolvedValue([{ id: 'm1', content: 'memory content', similarity: 0.95 }]);

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 }),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/ai/memory/vector', () => ({
  VectorMemoryService: class VectorMemoryService {
    searchSimilar = mockSearchSimilar;
  },
}));

vi.mock('@revealui/ai/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue({
    vector: new Array(1536).fill(0.1),
  }),
}));

vi.mock('@/lib/utils/error-response', () => ({
  createValidationErrorResponse: vi.fn(
    (message: string, field: string, _value?: unknown, extra?: unknown) => {
      return new Response(JSON.stringify({ error: message, field, ...((extra as object) ?? {}) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  ),
  createErrorResponse: vi.fn(() => {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
}));

import { getSession } from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { POST as searchVector } from '../../app/api/memory/search/route';
import { POST as searchText } from '../../app/api/memory/search-text/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(role = 'admin', userId = 'user-123') {
  return {
    session: { id: 'sess-1', userId },
    user: { id: userId, role, email: 'test@example.com' },
  };
}

function makeRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:4000'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// POST /api/memory/search (vector similarity)
// =============================================================================

describe('POST /api/memory/search', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const req = makeRequest('/api/memory/search', { queryEmbedding: [] });
    const res = await searchVector(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when queryEmbedding is missing', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const req = makeRequest('/api/memory/search', {});
    const res = await searchVector(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when queryEmbedding is not an array', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const req = makeRequest('/api/memory/search', { queryEmbedding: 'not-array' });
    const res = await searchVector(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when queryEmbedding has wrong dimensions', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const req = makeRequest('/api/memory/search', { queryEmbedding: [0.1, 0.2, 0.3] });
    const res = await searchVector(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('dimensions');
  });

  it('returns 400 when queryEmbedding contains non-numbers', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const embedding = new Array(1536).fill('string');
    const req = makeRequest('/api/memory/search', { queryEmbedding: embedding });
    const res = await searchVector(req);
    expect(res.status).toBe(400);
  });

  it('returns search results for valid embedding', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const embedding = new Array(1536).fill(0.1);
    const req = makeRequest('/api/memory/search', { queryEmbedding: embedding });
    const res = await searchVector(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.results).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  it('enforces userId for non-admin users', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession('viewer', 'user-456') as never);
    const embedding = new Array(1536).fill(0.1);
    const req = makeRequest('/api/memory/search', {
      queryEmbedding: embedding,
      options: { userId: 'other-user' },
    });
    await searchVector(req);

    expect(mockSearchSimilar).toHaveBeenCalledWith(
      embedding,
      expect.objectContaining({ userId: 'user-456' }),
    );
  });

  it('allows admin to search any user memories', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession('admin') as never);
    const embedding = new Array(1536).fill(0.1);
    const req = makeRequest('/api/memory/search', {
      queryEmbedding: embedding,
      options: { userId: 'other-user' },
    });
    await searchVector(req);

    expect(mockSearchSimilar).toHaveBeenCalledWith(
      embedding,
      expect.objectContaining({ userId: 'other-user' }),
    );
  });

  it('returns 400 for invalid JSON', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const req = new NextRequest(new URL('/api/memory/search', 'http://localhost:4000'), {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await searchVector(req);
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// POST /api/memory/search-text
// =============================================================================

describe('POST /api/memory/search-text', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const req = makeRequest('/api/memory/search-text', { query: 'hello' });
    const res = await searchText(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when query is missing', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const req = makeRequest('/api/memory/search-text', {});
    const res = await searchText(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when query is not a string', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const req = makeRequest('/api/memory/search-text', { query: 123 });
    const res = await searchText(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when query is empty', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const req = makeRequest('/api/memory/search-text', { query: '   ' });
    const res = await searchText(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when query exceeds 8000 characters', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const req = makeRequest('/api/memory/search-text', { query: 'a'.repeat(8001) });
    const res = await searchText(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('too long');
  });

  it('returns search results for valid query', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const req = makeRequest('/api/memory/search-text', { query: 'find relevant memories' });
    const res = await searchText(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.results).toHaveLength(1);
    expect(body.query).toBe('find relevant memories');
  });

  it('truncates long query in response to 100 chars', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const longQuery = 'a'.repeat(200);
    const req = makeRequest('/api/memory/search-text', { query: longQuery });
    const res = await searchText(req);
    const body = await res.json();
    expect(body.query).toHaveLength(100);
  });

  it('enforces userId for non-admin users', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession('viewer', 'user-789') as never);
    const req = makeRequest('/api/memory/search-text', { query: 'test' });
    await searchText(req);

    expect(mockSearchSimilar).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ userId: 'user-789' }),
    );
  });

  it('passes through search options', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const req = makeRequest('/api/memory/search-text', {
      query: 'test',
      options: { limit: 5, threshold: 0.8, agentId: 'agent-1' },
    });
    await searchText(req);

    expect(mockSearchSimilar).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ limit: 5, threshold: 0.8, agentId: 'agent-1' }),
    );
  });

  it('returns 400 for invalid JSON', async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    const req = new NextRequest(new URL('/api/memory/search-text', 'http://localhost:4000'), {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await searchText(req);
    expect(res.status).toBe(400);
  });
});
