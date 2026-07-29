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
const mockCreateSession = vi.fn();

vi.mock('@/lib/utils/revealui-singleton', () => ({
  getRevealUIInstance: () =>
    Promise.resolve({
      find: (...args: unknown[]) => mockFind(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    }),
}));

// Capture the typed Drizzle writes the route performs after a successful create:
// stampTosAcceptanceByEmail() (TOS columns) + the audit-log insert. The route
// dynamically imports @revealui/db/client for both.
const mockTosWhere = vi.fn().mockResolvedValue(undefined);
const mockTosSet = vi.fn(() => ({ where: mockTosWhere }));
const mockUpdate = vi.fn(() => ({ set: mockTosSet }));
const mockAuditValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn(() => ({ values: mockAuditValues }));

vi.mock('@revealui/db/client', () => ({
  getClient: () => ({ update: mockUpdate, insert: mockInsert }),
}));

// Session mint uses the same createSession primitive as sign-in (GAP-247 F8).
vi.mock('@revealui/auth/server', () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
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
    headers: {
      'Content-Type': 'application/json',
      'user-agent': 'setup-route-test',
      'x-forwarded-for': '203.0.113.10',
    },
  });
}

function getSetCookie(res: Response): string[] {
  // undici/NextResponse expose getSetCookie when available; fall back to
  // repeated get() for older Headers implementations.
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
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
    mockCreateSession.mockResolvedValue({
      token: 'test-session-token',
      session: { id: 'sess-1' },
    });
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

  it('mints a session and sets auth cookies on success (GAP-247 F8)', async () => {
    const res = await POST(
      makePostRequest({
        email: 'admin@test.com',
        password: 'securepassword12',
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sessionMinted).toBe(true);
    expect(body.user?.id).toBe('1');

    expect(mockCreateSession).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        userAgent: 'setup-route-test',
        ipAddress: '203.0.113.10',
      }),
    );

    const cookies = getSetCookie(res);
    const joined = cookies.join('\n');
    expect(joined).toMatch(/revealui-session=test-session-token/);
    expect(joined).toMatch(/revealui-role=owner/);
    // Cookie flags must match sign-in (httpOnly + sameSite=lax; secure only in prod)
    expect(joined).toMatch(/HttpOnly/i);
    expect(joined).toMatch(/SameSite=Lax/i);
  });

  it('still returns 201 when session mint fails (non-fatal auto-login)', async () => {
    mockCreateSession.mockRejectedValueOnce(new Error('session store unavailable'));

    const res = await POST(
      makePostRequest({
        email: 'admin@test.com',
        password: 'securepassword12',
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('created');
    expect(body.sessionMinted).toBeUndefined();
    const cookies = getSetCookie(res);
    expect(cookies.join('\n')).not.toMatch(/revealui-session=/);
  });

  it('stamps TOS acceptance via a typed write after creating the admin', async () => {
    await POST(
      makePostRequest({
        email: 'admin@test.com',
        password: 'securepassword12',
      }),
    );

    // bootstrap() must NOT push TOS through the engine create (the dynamic-SQL
    // adapter rejects camelCase column identifiers)...
    const createData = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown> | undefined;
    expect(createData).not.toHaveProperty('tosAcceptedAt');
    expect(createData).not.toHaveProperty('tosVersion');

    // ...the route stamps it via a typed Drizzle update instead.
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockTosSet).toHaveBeenCalledWith(
      expect.objectContaining({
        tosAcceptedAt: expect.any(Date),
        tosVersion: expect.any(String),
      }),
    );
    expect(mockTosWhere).toHaveBeenCalledTimes(1);
  });

  it('still returns 201 when the TOS write fails (non-fatal)', async () => {
    mockTosWhere.mockRejectedValueOnce(new Error('db unavailable'));

    const res = await POST(
      makePostRequest({
        email: 'admin@test.com',
        password: 'securepassword12',
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('created');
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
    expect(mockCreateSession).not.toHaveBeenCalled();
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
