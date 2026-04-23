/**
 * MCP collections introspection route tests (Stage 4.2).
 *
 * Exercises `GET /api/mcp/collections` — auth gating (session + bearer),
 * summary shape, and `mcpResource` default/opt-out resolution.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the collection registry with a small, controlled set so the test
// doesn't depend on the real admin config (which imports the entire world).
vi.mock('@/lib/collections/registry', () => ({
  allCollections: [
    {
      slug: 'posts',
      labels: { singular: 'Post', plural: 'Posts' },
      fields: [],
    },
    {
      slug: 'users',
      labels: { singular: 'User', plural: 'Users' },
      mcpResource: false,
      fields: [],
    },
    {
      slug: 'user-preferences',
      fields: [],
    },
  ],
}));

const mockGetSession = vi.fn();
vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/lib/utils/request-context', () => ({
  extractRequestContext: () => ({ userAgent: undefined, ipAddress: undefined }),
}));

function makeRequest(init?: RequestInit): Request {
  return new Request('http://admin.test/api/mcp/collections', {
    headers: { cookie: 'session=test' },
    ...init,
  });
}

const originalApiKey = process.env.REVEALUI_API_KEY;

beforeEach(() => {
  mockGetSession.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
  if (originalApiKey !== undefined) process.env.REVEALUI_API_KEY = originalApiKey;
  else delete process.env.REVEALUI_API_KEY;
});

describe('GET /api/mcp/collections', () => {
  it('returns 401 without a session or bearer token', async () => {
    delete process.env.REVEALUI_API_KEY;
    mockGetSession.mockResolvedValue(null);
    const { GET } = await import('../route.js');
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin sessions', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'user' } });
    const { GET } = await import('../route.js');
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(403);
  });

  it('returns the collection list for admin sessions', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { GET } = await import('../route.js');
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { collections: Array<Record<string, unknown>> };
    expect(body.collections).toHaveLength(3);
  });

  it('accepts a bearer token matching REVEALUI_API_KEY without a session', async () => {
    process.env.REVEALUI_API_KEY = 'secret-service-key';
    mockGetSession.mockResolvedValue(null);
    const { GET } = await import('../route.js');
    const res = await GET(
      makeRequest({
        headers: { authorization: 'Bearer secret-service-key' },
      }) as never,
    );
    expect(res.status).toBe(200);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('rejects a bearer token that does not match REVEALUI_API_KEY', async () => {
    process.env.REVEALUI_API_KEY = 'secret-service-key';
    mockGetSession.mockResolvedValue(null);
    const { GET } = await import('../route.js');
    const res = await GET(
      makeRequest({
        headers: { authorization: 'Bearer wrong-key' },
      }) as never,
    );
    expect(res.status).toBe(401);
  });

  it('rejects bearer auth when REVEALUI_API_KEY is not configured', async () => {
    delete process.env.REVEALUI_API_KEY;
    mockGetSession.mockResolvedValue(null);
    const { GET } = await import('../route.js');
    const res = await GET(
      makeRequest({
        headers: { authorization: 'Bearer anything' },
      }) as never,
    );
    expect(res.status).toBe(401);
  });

  it('resolves mcpResource: default true when absent, explicit false when opted out', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { GET } = await import('../route.js');
    const res = await GET(makeRequest() as never);
    const body = (await res.json()) as {
      collections: Array<{
        slug: string;
        mcpResource: boolean;
        label: string;
        labelPlural?: string;
      }>;
    };

    const posts = body.collections.find((c) => c.slug === 'posts');
    expect(posts?.mcpResource).toBe(true);
    expect(posts?.label).toBe('Post');
    expect(posts?.labelPlural).toBe('Posts');

    const users = body.collections.find((c) => c.slug === 'users');
    expect(users?.mcpResource).toBe(false);
    expect(users?.label).toBe('User');

    const prefs = body.collections.find((c) => c.slug === 'user-preferences');
    expect(prefs?.mcpResource).toBe(true);
    expect(prefs?.label).toBe('User Preferences');
    expect(prefs?.labelPlural).toBeUndefined();
  });
});
