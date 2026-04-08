/**
 * Revalidate Route Tests
 *
 * Tests for POST /api/revalidate — on-demand ISR revalidation endpoint.
 * Validates secret auth (timingSafeEqual), JSON parsing, and all revalidation
 * strategies (tag, path, collection+slug).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRevalidateTag = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
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

// We need to import NextRequest/NextResponse from next/server after mocks
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/revalidate/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-revalidation-secret-1234';

function createRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:4000/api/revalidate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function createRequestWithSecret(body: unknown, secret: string = TEST_SECRET): NextRequest {
  return createRequest(body, { 'x-revalidate-secret': secret });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_SECRET = TEST_SECRET;
  });

  // ---- Auth / Secret Validation ----

  describe('authentication', () => {
    it('returns 401 when x-revalidate-secret header is missing', async () => {
      const req = createRequest({ tag: 'posts' });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 401 when REVEALUI_SECRET env var is not set', async () => {
      delete process.env.REVEALUI_SECRET;

      const req = createRequestWithSecret({ tag: 'posts' });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 401 when secret is empty string', async () => {
      const req = createRequestWithSecret({ tag: 'posts' }, '');
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 401 when secret does not match', async () => {
      const req = createRequestWithSecret({ tag: 'posts' }, 'wrong-secret-value-here');
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 401 when secret has different length', async () => {
      const req = createRequestWithSecret({ tag: 'posts' }, 'short');
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('authenticates successfully with matching secret', async () => {
      const req = createRequestWithSecret({ tag: 'posts' });
      const res = await POST(req);

      expect(res.status).toBe(200);
    });
  });

  // ---- Body Validation ----

  describe('body validation', () => {
    it('returns 400 for invalid JSON body', async () => {
      const req = new NextRequest('http://localhost:4000/api/revalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': TEST_SECRET,
        },
        body: 'not valid json {{{',
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid JSON body');
    });

    it('returns 400 when body has no recognized fields', async () => {
      const req = createRequestWithSecret({ foo: 'bar' });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Provide tag, path, or collection+slug');
    });

    it('returns 400 when body is empty object', async () => {
      const req = createRequestWithSecret({});
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Provide tag, path, or collection+slug');
    });

    it('returns 400 when only collection is provided without slug', async () => {
      const req = createRequestWithSecret({ collection: 'posts' });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Provide tag, path, or collection+slug');
    });

    it('returns 400 when only slug is provided without collection', async () => {
      const req = createRequestWithSecret({ slug: 'hello-world' });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Provide tag, path, or collection+slug');
    });
  });

  // ---- Tag Revalidation ----

  describe('tag revalidation', () => {
    it('revalidates by tag and returns success', async () => {
      const req = createRequestWithSecret({ tag: 'posts' });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ revalidated: true, tag: 'posts' });
      expect(mockRevalidateTag).toHaveBeenCalledWith('posts', 'page');
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('tag takes priority over path when both are provided', async () => {
      const req = createRequestWithSecret({ tag: 'posts', path: '/blog' });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ revalidated: true, tag: 'posts' });
      expect(mockRevalidateTag).toHaveBeenCalledOnce();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('tag takes priority over collection+slug when both are provided', async () => {
      const req = createRequestWithSecret({
        tag: 'posts',
        collection: 'pages',
        slug: 'about',
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ revalidated: true, tag: 'posts' });
    });
  });

  // ---- Path Revalidation ----

  describe('path revalidation', () => {
    it('revalidates by path and returns success', async () => {
      const req = createRequestWithSecret({ path: '/blog/hello-world' });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ revalidated: true, path: '/blog/hello-world' });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/blog/hello-world');
      expect(mockRevalidateTag).not.toHaveBeenCalled();
    });

    it('path takes priority over collection+slug', async () => {
      const req = createRequestWithSecret({
        path: '/custom',
        collection: 'pages',
        slug: 'about',
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ revalidated: true, path: '/custom' });
      expect(mockRevalidatePath).toHaveBeenCalledOnce();
    });

    it('revalidates root path', async () => {
      const req = createRequestWithSecret({ path: '/' });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ revalidated: true, path: '/' });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    });
  });

  // ---- Collection + Slug Revalidation ----

  describe('collection + slug revalidation', () => {
    it('revalidates by collection and slug', async () => {
      const req = createRequestWithSecret({
        collection: 'posts',
        slug: 'hello-world',
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        revalidated: true,
        collection: 'posts',
        slug: 'hello-world',
      });
      expect(mockRevalidateTag).toHaveBeenCalledWith('posts:hello-world', 'page');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/posts/hello-world');
    });

    it('calls both revalidateTag and revalidatePath for collection+slug', async () => {
      const req = createRequestWithSecret({
        collection: 'pages',
        slug: 'about',
      });
      await POST(req);

      expect(mockRevalidateTag).toHaveBeenCalledOnce();
      expect(mockRevalidatePath).toHaveBeenCalledOnce();
    });
  });
});
