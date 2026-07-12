/**
 * Knowledge Graph Edges Shape Proxy Route Tests
 */

import * as authServer from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../kg-edges/route';

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/api/electric-proxy', () => ({
  prepareElectricUrl: vi.fn((_url: string) => new URL('http://localhost:5133/v1/shape')),
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

describe('GET /api/shapes/kg-edges', () => {
  const mockGetSession = vi.mocked(authServer.getSession);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when session is missing', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/shapes/kg-edges');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('proxies with no where clause when repo is omitted', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    const { prepareElectricUrl } = await import('@/lib/api/electric-proxy');

    const request = new NextRequest('http://localhost:3000/api/shapes/kg-edges');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const originUrl = vi.mocked(prepareElectricUrl).mock.results[0]?.value as URL;
    expect(originUrl.searchParams.get('table')).toBe('kg_edges');
    expect(originUrl.searchParams.has('where')).toBe(false);
  });

  it('proxies filtered by repo when a valid repo is supplied', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    const { prepareElectricUrl } = await import('@/lib/api/electric-proxy');

    const request = new NextRequest('http://localhost:3000/api/shapes/kg-edges?repo=revdev');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const originUrl = vi.mocked(prepareElectricUrl).mock.results[0]?.value as URL;
    expect(originUrl.searchParams.get('where')).toBe(`repo = 'revdev'`);
  });

  it('rejects an invalid repo value', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const request = new NextRequest(
      'http://localhost:3000/api/shapes/kg-edges?repo=' +
        encodeURIComponent("a'; DROP TABLE kg_edges;--"),
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('handles errors gracefully', async () => {
    mockGetSession.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/shapes/kg-edges');
    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});
