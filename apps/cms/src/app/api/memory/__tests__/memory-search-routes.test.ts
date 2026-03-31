/**
 * Tests for memory search routes:
 * - POST /api/memory/search (vector similarity search)
 * - POST /api/memory/search-text (text-based search with embedding generation)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockCheckAIFeatureGate = vi.fn();
const mockCheckAIMemoryFeatureGate = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/middleware/ai-feature-gate', () => ({
  checkAIFeatureGate: (...args: unknown[]) => mockCheckAIFeatureGate(...args),
  checkAIMemoryFeatureGate: (...args: unknown[]) => mockCheckAIMemoryFeatureGate(...args),
}));

vi.mock('@/lib/utils/error-response', () => {
  const { NextResponse } = require('next/server');
  return {
    createErrorResponse: (err: unknown) =>
      NextResponse.json(
        { error: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 },
      ),
    createValidationErrorResponse: (msg: string, field: string) =>
      NextResponse.json({ error: msg, field }, { status: 400 }),
  };
});

// Mock Pro AI modules so dynamic import fails (simulates "not installed")
vi.mock('@revealui/ai/memory/vector', () => {
  throw new Error('Module not available');
});

vi.mock('@revealui/ai/embeddings', () => {
  throw new Error('Module not available');
});

vi.mock('next/server', () => {
  class MockNextResponse {
    body: unknown;
    status: number;
    headers: Map<string, string>;
    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }
    static json(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return new MockNextResponse(data, init);
    }
  }
  return { NextResponse: MockNextResponse };
});

function makeRequest(body?: unknown) {
  return {
    headers: { get: () => null },
    json:
      body !== undefined ? () => Promise.resolve(body) : () => Promise.reject(new Error('no body')),
  } as never;
}

// ─── POST /api/memory/search ────────────────────────────────────────────────

describe('POST /api/memory/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAIMemoryFeatureGate.mockReturnValue(null);
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 29,
      resetAt: Date.now() + 60000,
    });
    process.env.EMBEDDING_DIMENSIONS = '1536';
  });

  async function loadRoute() {
    const mod = await import('../search/route.js');
    return mod.POST;
  }

  it('returns feature gate response when AI is disabled', async () => {
    const { NextResponse } = require('next/server');
    mockCheckAIMemoryFeatureGate.mockReturnValue(
      NextResponse.json({ error: 'AI disabled' }, { status: 403 }),
    );

    const POST = await loadRoute();
    const res = await POST(makeRequest());
    expect((res as { status: number }).status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const POST = await loadRoute();
    const res = await POST(makeRequest({ queryEmbedding: [] }));
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ queryEmbedding: [] }));
    expect((res as { status: number }).status).toBe(429);
    expect(
      (res as unknown as { headers: Map<string, string> }).headers.get('Retry-After'),
    ).toBeTruthy();
  });

  it('returns 400 when queryEmbedding is missing', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const POST = await loadRoute();
    const res = await POST(makeRequest({ notAnEmbedding: true }));
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 400 when embedding has wrong dimensions', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const POST = await loadRoute();
    const res = await POST(makeRequest({ queryEmbedding: [0.1, 0.2, 0.3] }));
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 400 when embedding contains non-numbers', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    process.env.EMBEDDING_DIMENSIONS = '3';
    const POST = await loadRoute();
    const res = await POST(makeRequest({ queryEmbedding: [0.1, 'bad', 0.3] }));
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 503 when @revealui/ai is not installed', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    process.env.EMBEDDING_DIMENSIONS = '2';

    // The route dynamically imports @revealui/ai/memory/vector which won't exist in test
    const POST = await loadRoute();
    const res = await POST(makeRequest({ queryEmbedding: [0.1, 0.2] }));
    expect((res as { status: number }).status).toBe(503);
  });
});

// ─── POST /api/memory/search-text ───────────────────────────────────────────

describe('POST /api/memory/search-text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAIMemoryFeatureGate.mockReturnValue(null);
  });

  async function loadRoute() {
    const mod = await import('../search-text/route.js');
    return mod.POST;
  }

  it('returns feature gate response when AI is disabled', async () => {
    const { NextResponse } = require('next/server');
    mockCheckAIMemoryFeatureGate.mockReturnValue(
      NextResponse.json({ error: 'AI disabled' }, { status: 403 }),
    );

    const POST = await loadRoute();
    const res = await POST(makeRequest());
    expect((res as { status: number }).status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const POST = await loadRoute();
    const res = await POST(makeRequest({ query: 'test' }));
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns 400 when query is not a string', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const POST = await loadRoute();
    const res = await POST(makeRequest({ query: 123 }));
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 400 when query is empty', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const POST = await loadRoute();
    const res = await POST(makeRequest({ query: '   ' }));
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 400 when query exceeds 8000 characters', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const POST = await loadRoute();
    const res = await POST(makeRequest({ query: 'x'.repeat(8001) }));
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 503 when @revealui/ai is not installed', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ query: 'test search' }));
    expect((res as { status: number }).status).toBe(503);
  });
});
