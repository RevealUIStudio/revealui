/**
 * Setup Route Tests
 *
 * POST /api/setup  -  Bootstrap a fresh RevealUI instance
 * GET  /api/setup  -  Check if setup is needed
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFind = vi.fn();
const mockCreate = vi.fn();

vi.mock('@/lib/utilities/revealui-singleton', () => ({
  getRevealUIInstance: () =>
    Promise.resolve({
      find: (...args: unknown[]) => mockFind(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    }),
}));

// ---------------------------------------------------------------------------
// Route imports (after mocks)
// ---------------------------------------------------------------------------

import { GET, POST } from '../../app/api/setup/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/setup', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing users
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });
    mockCreate.mockResolvedValue({ id: '1', email: 'admin@test.com' });
  });

  it('creates admin user and returns 201', async () => {
    const res = await POST(
      makePostRequest({
        email: 'admin@test.com',
        password: 'securepassword12',
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('created');
    expect(body.user?.email).toBe('admin@test.com');
    expect(body.seeded).toBe(true);
  });

  it('returns 403 when users already exist', async () => {
    mockFind.mockResolvedValue({ totalDocs: 1, docs: [{ id: '1' }] });

    const res = await POST(
      makePostRequest({
        email: 'admin@test.com',
        password: 'securepassword12',
      }),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.status).toBe('locked');
  });

  it('rejects invalid email', async () => {
    const res = await POST(
      makePostRequest({
        email: 'not-an-email',
        password: 'securepassword12',
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.message).toContain('email');
  });

  it('rejects short password', async () => {
    const res = await POST(
      makePostRequest({
        email: 'admin@test.com',
        password: 'short',
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.message).toContain('12 characters');
  });

  it('rejects invalid JSON', async () => {
    const res = await POST(
      new Request('http://localhost/api/setup', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('Invalid JSON');
  });

  it('passes name through to bootstrap', async () => {
    await POST(
      makePostRequest({
        email: 'admin@test.com',
        password: 'securepassword12',
        name: 'Joshua',
      }),
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Joshua' }),
      }),
    );
  });

  it('returns 500 on database error', async () => {
    mockFind.mockRejectedValue(new Error('Connection refused'));

    const res = await POST(
      makePostRequest({
        email: 'admin@test.com',
        password: 'securepassword12',
      }),
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.message).toContain('Database');
  });
});

describe('GET /api/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns needed: true when no users exist', async () => {
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needed).toBe(true);
  });

  it('returns needed: false when users exist', async () => {
    mockFind.mockResolvedValue({ totalDocs: 1, docs: [{ id: '1' }] });

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needed).toBe(false);
  });

  it('returns 503 on database error', async () => {
    mockFind.mockRejectedValue(new Error('Connection refused'));

    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.needed).toBe(false);
  });
});
