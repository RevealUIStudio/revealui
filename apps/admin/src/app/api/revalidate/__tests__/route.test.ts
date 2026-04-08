/**
 * Tests for POST /api/revalidate
 *
 * On-demand ISR revalidation with secret verification and multi-mode support.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRevalidatePath = vi.fn();
const mockRevalidateTag = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

vi.mock('@revealui/config', () => ({
  default: {
    reveal: {
      get secret() {
        return process.env.REVEALUI_SECRET ?? '';
      },
    },
  },
}));

vi.mock('next/server', () => {
  class MockNextResponse {
    body: unknown;
    status: number;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init);
    }
  }
  return { NextResponse: MockNextResponse };
});

const originalEnv = { ...process.env };

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_SECRET = 'test-revalidate-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function loadRoute() {
    const mod = await import('../route.js');
    return mod.POST;
  }

  function makeRequest(body: unknown, secret?: string) {
    return {
      headers: {
        get: (key: string) => (key === 'x-revalidate-secret' ? (secret ?? null) : null),
      },
      json: () => Promise.resolve(body),
    } as never;
  }

  it('returns 401 when secret is missing', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest({}));
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns 401 when secret does not match', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest({}, 'wrong-secret-value'));
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns 401 when REVEALUI_SECRET is not set', async () => {
    delete process.env.REVEALUI_SECRET;
    const POST = await loadRoute();
    const res = await POST(makeRequest({}, 'anything'));
    expect((res as { status: number }).status).toBe(401);
  });

  it('revalidates by tag', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest({ tag: 'pages' }, 'test-revalidate-secret'));
    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: unknown }).body).toEqual(
      expect.objectContaining({ revalidated: true, tag: 'pages' }),
    );
    expect(mockRevalidateTag).toHaveBeenCalledWith('pages', 'page');
  });

  it('revalidates by path', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest({ path: '/blog/hello' }, 'test-revalidate-secret'));
    expect((res as { status: number }).status).toBe(200);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/blog/hello');
  });

  it('revalidates by collection + slug', async () => {
    const POST = await loadRoute();
    const res = await POST(
      makeRequest({ collection: 'posts', slug: 'hello-world' }, 'test-revalidate-secret'),
    );
    expect((res as { status: number }).status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith('posts:hello-world', 'page');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/posts/hello-world');
  });

  it('returns 400 when no revalidation target provided', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest({}, 'test-revalidate-secret'));
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 400 when body is invalid JSON', async () => {
    const POST = await loadRoute();
    const req = {
      headers: {
        get: (key: string) => (key === 'x-revalidate-secret' ? 'test-revalidate-secret' : null),
      },
      json: () => Promise.reject(new Error('invalid json')),
    } as never;
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(400);
    expect((res as unknown as { body: { error: string } }).body).toEqual(
      expect.objectContaining({ error: 'Invalid JSON body' }),
    );
  });

  it('prefers tag over path when both provided', async () => {
    const POST = await loadRoute();
    const res = await POST(
      makeRequest({ tag: 'my-tag', path: '/some/path' }, 'test-revalidate-secret'),
    );
    expect((res as unknown as { body: unknown }).body).toEqual(
      expect.objectContaining({ tag: 'my-tag' }),
    );
    expect(mockRevalidateTag).toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
