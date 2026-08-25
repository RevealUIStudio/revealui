/**
 * Coordination Work Items Shape Proxy Route Tests
 */

import * as authServer from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../coordination-work-items/route';

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/api/electric-proxy', () => ({
  prepareElectricUrl: vi.fn((_url: string) => {
    const electricUrl = new URL('http://localhost:5133/v1/shape');
    electricUrl.searchParams.set('table', 'coordination_work_items');
    return electricUrl;
  }),
  proxyElectricRequest: vi.fn(async () => {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }),
}));

function makeSession(role: string, extras: { emailVerified?: boolean; _json?: unknown } = {}) {
  return {
    session: {
      id: 'session-id',
      userId: '123e4567-e89b-12d3-a456-426614174000',
      schemaVersion: '1',
      tokenHash: 'token-hash',
      expiresAt: new Date(Date.now() + 86400000),
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      persistent: false,
      lastActivityAt: new Date(),
      createdAt: new Date(),
      metadata: null,
    },
    user: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      schemaVersion: '1',
      type: 'human',
      name: 'Test User',
      email: 'test@example.com',
      avatarUrl: null,
      password: null,
      role,
      status: 'active',
      emailVerified: extras.emailVerified ?? false,
      emailVerificationToken: null,
      emailVerifiedAt: null,
      mfaEnabled: false,
      mfaVerifiedAt: null,
      agentModel: null,
      agentCapabilities: null,
      agentConfig: null,
      preferences: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActiveAt: null,
      _json: extras._json,
    },
  };
}

function makeOperatorSession() {
  return makeSession('admin', {
    emailVerified: true,
    _json: { roles: ['super-admin'] },
  });
}

describe('GET /api/shapes/coordination-work-items', () => {
  const mockGetSession = vi.mocked(authServer.getSession);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when session is missing', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/shapes/coordination-work-items');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('returns 403 for hosted CMS admin', async () => {
    mockGetSession.mockResolvedValue(makeSession('admin', { emailVerified: true }) as never);

    const request = new NextRequest('http://localhost:3000/api/shapes/coordination-work-items');
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it('returns 403 for hosted owner', async () => {
    mockGetSession.mockResolvedValue(makeSession('owner', { emailVerified: true }) as never);

    const request = new NextRequest('http://localhost:3000/api/shapes/coordination-work-items');
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it('proxies the full table for a fleet operator', async () => {
    mockGetSession.mockResolvedValue(makeOperatorSession() as never);
    const { prepareElectricUrl, proxyElectricRequest } = await import('@/lib/api/electric-proxy');

    const request = new NextRequest('http://localhost:3000/api/shapes/coordination-work-items');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const originUrl = vi.mocked(prepareElectricUrl).mock.results[0]?.value as URL;
    expect(originUrl.searchParams.get('table')).toBe('coordination_work_items');
    expect(originUrl.searchParams.has('where')).toBe(false);
    expect(proxyElectricRequest).toHaveBeenCalled();
  });
});
