/**
 * The same caller gets the same admin answer on representative admin routes.
 * Owner, super-admin, and admin pass. Editor, user, and signed-out callers do not.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockGetRevealUIInstance = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/lib/utils/revealui-singleton', () => ({
  getRevealUIInstance: (...args: unknown[]) => mockGetRevealUIInstance(...args),
}));

vi.mock('@revealui/config', () => ({
  default: { stripe: { secretKey: undefined } },
}));

vi.mock('@/lib/utils/request-context', () => ({
  extractRequestContext: () => ({ userAgent: undefined, ipAddress: undefined }),
}));

vi.mock('@revealui/mcp/oauth', () => ({
  createRevvaultVault: () => ({}),
}));

vi.mock('@revealui/mcp/remote-client', () => ({
  listConnectedMcpServers: async () => [],
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

interface GateUser {
  id: string;
  role: string;
  emailVerified?: boolean;
  _json?: unknown;
}

const CASES: Array<{ name: string; user: GateUser | null; admin: boolean }> = [
  { name: 'owner', user: { id: 'u', role: 'owner' }, admin: true },
  { name: 'super-admin', user: { id: 'u', role: 'super-admin' }, admin: true },
  {
    name: 'verified operator',
    user: {
      id: 'u',
      role: 'viewer',
      emailVerified: true,
      _json: { roles: ['super-admin'] },
    },
    admin: true,
  },
  { name: 'admin', user: { id: 'u', role: 'admin' }, admin: true },
  { name: 'editor', user: { id: 'u', role: 'editor' }, admin: false },
  { name: 'user', user: { id: 'u', role: 'user' }, admin: false },
  { name: 'unauthenticated', user: null, admin: false },
];

function request(): { headers: { get: () => null } } {
  return { headers: { get: () => null } };
}

describe('admin routes share one admin decision', () => {
  beforeEach(() => {
    vi.stubEnv('REVEALUI_DEPLOYMENT_MODE', 'forge');
    vi.clearAllMocks();
    mockGetRevealUIInstance.mockResolvedValue({
      find: vi.fn().mockResolvedValue({ docs: [] }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(CASES)('GET /api/health ($name)', async ({ user, admin }) => {
    mockGetSession.mockResolvedValue(user ? { user } : null);
    const { GET } = await import('../health/route.js');
    const res = (await GET(request() as never)) as unknown as {
      status: number;
      body: Record<string, unknown>;
    };
    expect(res.status).toBe(200);
    if (admin) {
      expect(res.body).toHaveProperty('checks');
    } else {
      expect(res.body).not.toHaveProperty('checks');
    }
  });

  it.each(CASES)('GET /api/mcp/remote-servers ($name)', async ({ user, admin }) => {
    mockGetSession.mockResolvedValue(user ? { user } : null);
    const { GET } = await import('../mcp/remote-servers/route.js');
    const res = (await GET(
      new Request('http://admin.test/api/mcp/remote-servers') as never,
    )) as unknown as { status: number };
    if (!user) {
      expect(res.status).toBe(401);
      return;
    }
    // Past the role gate the handler asks for tenant and returns 400.
    expect(res.status).toBe(admin ? 400 : 403);
  });
});

describe('hosted tenant owner is denied on admin routes', () => {
  const tenantOwner = { id: 'u', role: 'owner', emailVerified: true };
  const platformOwner = {
    id: 'u',
    role: 'owner',
    emailVerified: true,
    _json: { roles: ['super-admin'] },
  };

  beforeEach(() => {
    vi.stubEnv('REVEALUI_DEPLOYMENT_MODE', 'hosted');
    vi.clearAllMocks();
    mockGetRevealUIInstance.mockResolvedValue({
      find: vi.fn().mockResolvedValue({ docs: [] }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('GET /api/health denies a bare owner and allows a verified operator', async () => {
    const { GET } = await import('../health/route.js');
    mockGetSession.mockResolvedValue({ user: tenantOwner });
    const denied = (await GET(request() as never)) as unknown as {
      body: Record<string, unknown>;
    };
    expect(denied.body).not.toHaveProperty('checks');

    mockGetSession.mockResolvedValue({ user: platformOwner });
    const allowed = (await GET(request() as never)) as unknown as {
      body: Record<string, unknown>;
    };
    expect(allowed.body).toHaveProperty('checks');
  });

  it('GET /api/mcp/remote-servers denies a bare owner', async () => {
    const { GET } = await import('../mcp/remote-servers/route.js');
    mockGetSession.mockResolvedValue({ user: tenantOwner });
    const res = (await GET(
      new Request('http://admin.test/api/mcp/remote-servers') as never,
    )) as unknown as { status: number };
    expect(res.status).toBe(403);
  });
});
