/**
 * Knowledge Graph Nodes Shape Proxy Route Tests
 */

import * as authServer from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../kg-nodes/route';

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/middleware/ai-feature-gate', () => ({
  checkAIFeatureGate: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/api/electric-proxy', () => ({
  prepareElectricUrl: vi.fn((_url: string) => {
    const electricUrl = new URL('http://localhost:5133/v1/shape');
    return electricUrl;
  }),
  proxyElectricRequest: vi.fn(async () => {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }),
}));

const mockSession = {
  session: {
    id: 'session-abc-123',
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
    role: 'viewer',
    status: 'active',
    emailVerified: false,
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
  },
};

describe('GET /api/shapes/kg-nodes', () => {
  const mockGetSession = vi.mocked(authServer.getSession);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when session is missing', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/shapes/kg-nodes');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('proxies with no where clause when repo is omitted', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    const { prepareElectricUrl, proxyElectricRequest } = await import('@/lib/api/electric-proxy');

    const request = new NextRequest('http://localhost:3000/api/shapes/kg-nodes');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(prepareElectricUrl).toHaveBeenCalled();
    const originUrl = vi.mocked(prepareElectricUrl).mock.results[0]?.value as URL;
    expect(originUrl.searchParams.get('table')).toBe('kg_nodes');
    expect(originUrl.searchParams.has('where')).toBe(false);
    expect(proxyElectricRequest).toHaveBeenCalled();
  });

  it('proxies filtered by repo when a valid repo is supplied', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    const { prepareElectricUrl } = await import('@/lib/api/electric-proxy');

    const request = new NextRequest('http://localhost:3000/api/shapes/kg-nodes?repo=revealui');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const originUrl = vi.mocked(prepareElectricUrl).mock.results[0]?.value as URL;
    expect(originUrl.searchParams.get('where')).toBe(`repo = 'revealui'`);
  });

  it('accepts dotted repo names like .jv', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    const { prepareElectricUrl } = await import('@/lib/api/electric-proxy');

    const request = new NextRequest('http://localhost:3000/api/shapes/kg-nodes?repo=.jv');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const originUrl = vi.mocked(prepareElectricUrl).mock.results[0]?.value as URL;
    expect(originUrl.searchParams.get('where')).toBe(`repo = '.jv'`);
  });

  it('rejects a repo value carrying a quote (injection attempt)', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const request = new NextRequest(
      "http://localhost:3000/api/shapes/kg-nodes?repo=revealui' OR '1'='1",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('rejects a repo value with whitespace or slashes', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const request = new NextRequest(
      `http://localhost:3000/api/shapes/kg-nodes?repo=${encodeURIComponent('reveal/ui')}`,
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it('handles errors gracefully', async () => {
    mockGetSession.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/shapes/kg-nodes');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('INTERNAL_ERROR');
  });
});
