/**
 * Proxy Route Tests
 *
 * GET/POST  /api/globals/[slug]                 -  fetch proxy to API globals
 * GET/POST  /api/collections/[collection]        -  fetch proxy with 503 on error
 * GET/PATCH/DELETE /api/collections/[collection]/[id]  -  fetch proxy with raw text error
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock auth  -  proxy routes now require a valid session
vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: 'test-user', token: 'tok' }),
}));

vi.mock('@/lib/utils/request-context', () => ({
  extractRequestContext: vi.fn().mockReturnValue({}),
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Route imports (after mocks)
// ---------------------------------------------------------------------------

import {
  DELETE as collectionItemDelete,
  GET as collectionItemGet,
  PATCH as collectionItemPatch,
} from '../../app/api/collections/[collection]/[id]/route';
import {
  GET as collectionsGet,
  POST as collectionsPost,
} from '../../app/api/collections/[collection]/route';
import { GET as globalsGet, POST as globalsPost } from '../../app/api/globals/[slug]/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUpstreamOk(data: unknown, status = 200) {
  return {
    ok: true,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

function makeUpstreamError(status: number, text = 'upstream error') {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: text }),
    text: () => Promise.resolve(text),
  };
}

// ---------------------------------------------------------------------------
// Tests  -  GET /api/globals/[slug]
// ---------------------------------------------------------------------------

describe('GET /api/globals/[slug]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proxies a 200 response from the API', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamOk({ title: 'Home' }));
    const req = new NextRequest('http://localhost/api/globals/home');
    const res = await globalsGet(req, { params: Promise.resolve({ slug: 'home' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Home');
  });

  it('returns sanitized 404 when upstream returns 404', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamError(404));
    const req = new NextRequest('http://localhost/api/globals/missing');
    const res = await globalsGet(req, { params: Promise.resolve({ slug: 'missing' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Not found');
  });

  it('returns sanitized 401 for unauthorized', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamError(401));
    const req = new NextRequest('http://localhost/api/globals/secret');
    const res = await globalsGet(req, { params: Promise.resolve({ slug: 'secret' }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns sanitized 500 for upstream server error', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamError(500));
    const req = new NextRequest('http://localhost/api/globals/nav');
    const res = await globalsGet(req, { params: Promise.resolve({ slug: 'nav' }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});

// ---------------------------------------------------------------------------
// Tests  -  POST /api/globals/[slug]
// ---------------------------------------------------------------------------

describe('POST /api/globals/[slug]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proxies a 200 POST response', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamOk({ updated: true }));
    const req = new NextRequest('http://localhost/api/globals/nav', {
      method: 'POST',
      body: JSON.stringify({ links: [] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await globalsPost(req, { params: Promise.resolve({ slug: 'nav' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(true);
  });

  it('returns sanitized 403 for forbidden POST', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamError(403));
    const req = new NextRequest('http://localhost/api/globals/nav', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await globalsPost(req, { params: Promise.resolve({ slug: 'nav' }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });
});

// ---------------------------------------------------------------------------
// Tests  -  GET /api/collections/[collection]
// ---------------------------------------------------------------------------

describe('GET /api/collections/[collection]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proxies a 200 response', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamOk({ docs: [] }));
    const req = new NextRequest('http://localhost/api/collections/posts');
    const res = await collectionsGet(req, {
      params: Promise.resolve({ collection: 'posts' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.docs)).toBe(true);
  });

  it('returns 503 when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const req = new NextRequest('http://localhost/api/collections/posts');
    const res = await collectionsGet(req, {
      params: Promise.resolve({ collection: 'posts' }),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('Content API unavailable');
  });

  it('passes through upstream error status', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamError(404, 'Not found'));
    const req = new NextRequest('http://localhost/api/collections/missing');
    const res = await collectionsGet(req, {
      params: Promise.resolve({ collection: 'missing' }),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests  -  POST /api/collections/[collection]
// ---------------------------------------------------------------------------

describe('POST /api/collections/[collection]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proxies a 201 create response', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamOk({ id: 'doc-1' }, 201));
    const req = new NextRequest('http://localhost/api/collections/posts', {
      method: 'POST',
      body: JSON.stringify({ title: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await collectionsPost(req, {
      params: Promise.resolve({ collection: 'posts' }),
    });
    expect(res.status).toBe(201);
  });

  it('returns 503 when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ETIMEDOUT'));
    const req = new NextRequest('http://localhost/api/collections/posts', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await collectionsPost(req, {
      params: Promise.resolve({ collection: 'posts' }),
    });
    expect(res.status).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Tests  -  GET /api/collections/[collection]/[id]
// ---------------------------------------------------------------------------

describe('GET /api/collections/[collection]/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proxies a 200 response', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamOk({ id: 'post-1', title: 'Hello' }));
    const req = new NextRequest('http://localhost/api/collections/posts/post-1');
    const res = await collectionItemGet(req, {
      params: Promise.resolve({ collection: 'posts', id: 'post-1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('post-1');
  });

  it('returns sanitized error on 404', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamError(404, 'Post not found'));
    const req = new NextRequest('http://localhost/api/collections/posts/no-such');
    const res = await collectionItemGet(req, {
      params: Promise.resolve({ collection: 'posts', id: 'no-such' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('API request failed');
  });
});

// ---------------------------------------------------------------------------
// Tests  -  PATCH /api/collections/[collection]/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/collections/[collection]/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proxies a 200 update response', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamOk({ id: 'post-1', title: 'Updated' }));
    const req = new NextRequest('http://localhost/api/collections/posts/post-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await collectionItemPatch(req, {
      params: Promise.resolve({ collection: 'posts', id: 'post-1' }),
    });
    expect(res.status).toBe(200);
  });

  it('passes through 403 error', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamError(403, 'Forbidden'));
    const req = new NextRequest('http://localhost/api/collections/posts/post-1', {
      method: 'PATCH',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await collectionItemPatch(req, {
      params: Promise.resolve({ collection: 'posts', id: 'post-1' }),
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests  -  DELETE /api/collections/[collection]/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/collections/[collection]/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proxies a 200 delete response', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamOk({ deleted: true }));
    const req = new NextRequest('http://localhost/api/collections/posts/post-1', {
      method: 'DELETE',
    });
    const res = await collectionItemDelete(req, {
      params: Promise.resolve({ collection: 'posts', id: 'post-1' }),
    });
    expect(res.status).toBe(200);
  });

  it('passes through 404 when item not found', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamError(404, 'Not found'));
    const req = new NextRequest('http://localhost/api/collections/posts/gone', {
      method: 'DELETE',
    });
    const res = await collectionItemDelete(req, {
      params: Promise.resolve({ collection: 'posts', id: 'gone' }),
    });
    expect(res.status).toBe(404);
  });
});
