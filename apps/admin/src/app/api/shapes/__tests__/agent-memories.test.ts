/**
 * Agent Memories Shape Proxy Route Tests (GAP-476)
 */

import * as authServer from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetClient, mockCheckAIFeatureGate, mockUserCanAccessSite } = vi.hoisted(() => ({
  mockGetClient: vi.fn(),
  mockCheckAIFeatureGate: vi.fn(),
  mockUserCanAccessSite: vi.fn(),
}));

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
}));

vi.mock('@revealui/db/client', () => ({
  getClient: mockGetClient,
}));

vi.mock('@/lib/middleware/ai-feature-gate', () => ({
  checkAIFeatureGate: mockCheckAIFeatureGate,
}));

vi.mock('@/lib/api/shape-authz', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/shape-authz')>('@/lib/api/shape-authz');
  return {
    ...actual,
    userCanAccessSite: mockUserCanAccessSite,
  };
});

vi.mock('@/lib/api/electric-proxy', () => ({
  prepareElectricUrl: vi.fn((_url: string) => {
    const electricUrl = new URL('http://localhost:5133/v1/shape');
    electricUrl.searchParams.set('table', 'agent_memories');
    return electricUrl;
  }),
  proxyElectricRequest: vi.fn(async () => {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }),
}));

import { GET } from '../agent-memories/route';

function makeSession(
  role: string,
  userId = '123e4567-e89b-12d3-a456-426614174000',
  extras: { emailVerified?: boolean; _json?: unknown } = {},
) {
  return {
    session: {
      id: 'session-abc-123',
      userId,
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
      id: userId,
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

const SITE_ID = 'site-owned-1';

describe('GET /api/shapes/agent-memories', () => {
  const mockGetSession = vi.mocked(authServer.getSession);

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAIFeatureGate.mockResolvedValue(null);
    mockGetClient.mockReturnValue({});
    mockUserCanAccessSite.mockResolvedValue(false);
  });

  it('should return 401 when session is missing', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/shapes/agent-memories?agent_id=assistant',
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should return 400 when agent_id query param is missing', async () => {
    mockGetSession.mockResolvedValue(makeSession('viewer') as never);

    const request = new NextRequest('http://localhost:3000/api/shapes/agent-memories');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('should return 403 for non-admin without site_id', async () => {
    mockGetSession.mockResolvedValue(makeSession('viewer') as never);

    const request = new NextRequest(
      'http://localhost:3000/api/shapes/agent-memories?agent_id=assistant',
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('FORBIDDEN');
  });

  it('should return 403 when non-admin lacks site access', async () => {
    mockGetSession.mockResolvedValue(makeSession('viewer') as never);
    mockUserCanAccessSite.mockResolvedValue(false);

    const request = new NextRequest(
      `http://localhost:3000/api/shapes/agent-memories?agent_id=assistant&site_id=${SITE_ID}`,
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('FORBIDDEN');
    expect(mockUserCanAccessSite).toHaveBeenCalled();
  });

  it('should proxy with agent_id and site_id when non-admin owns site', async () => {
    mockGetSession.mockResolvedValue(makeSession('viewer') as never);
    mockUserCanAccessSite.mockResolvedValue(true);

    const { proxyElectricRequest } = await import('@/lib/api/electric-proxy');

    const request = new NextRequest(
      `http://localhost:3000/api/shapes/agent-memories?agent_id=assistant&site_id=${SITE_ID}`,
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(proxyElectricRequest).toHaveBeenCalled();
    const originUrl = vi.mocked(proxyElectricRequest).mock.calls[0]?.[0] as URL;
    expect(originUrl.searchParams.get('where')).toBe(
      `agent_id = 'assistant' AND site_id = '${SITE_ID}'`,
    );
  });

  it('should return 403 for hosted CMS admin without site_id', async () => {
    mockGetSession.mockResolvedValue(
      makeSession('admin', undefined, { emailVerified: true }) as never,
    );

    const request = new NextRequest(
      'http://localhost:3000/api/shapes/agent-memories?agent_id=assistant',
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('FORBIDDEN');
    expect(mockUserCanAccessSite).not.toHaveBeenCalled();
  });

  it('should proxy agent_id only for fleet operator without site_id', async () => {
    mockGetSession.mockResolvedValue(
      makeSession('admin', undefined, {
        emailVerified: true,
        _json: { roles: ['super-admin'] },
      }) as never,
    );

    const { proxyElectricRequest } = await import('@/lib/api/electric-proxy');

    const request = new NextRequest(
      'http://localhost:3000/api/shapes/agent-memories?agent_id=assistant',
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const originUrl = vi.mocked(proxyElectricRequest).mock.calls[0]?.[0] as URL;
    expect(originUrl.searchParams.get('where')).toBe(`agent_id = 'assistant'`);
    expect(mockUserCanAccessSite).not.toHaveBeenCalled();
  });

  it('should keep hosted admin on the site-scoped path', async () => {
    mockGetSession.mockResolvedValue(
      makeSession('admin', undefined, { emailVerified: true }) as never,
    );
    mockUserCanAccessSite.mockResolvedValue(true);

    const { proxyElectricRequest } = await import('@/lib/api/electric-proxy');

    const request = new NextRequest(
      `http://localhost:3000/api/shapes/agent-memories?agent_id=assistant&site_id=${SITE_ID}`,
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockUserCanAccessSite).toHaveBeenCalled();
    const originUrl = vi.mocked(proxyElectricRequest).mock.calls[0]?.[0] as URL;
    expect(originUrl.searchParams.get('where')).toBe(
      `agent_id = 'assistant' AND site_id = '${SITE_ID}'`,
    );
  });

  it('should handle errors gracefully', async () => {
    mockGetSession.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest(
      'http://localhost:3000/api/shapes/agent-memories?agent_id=assistant',
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('INTERNAL_ERROR');
  });
});
