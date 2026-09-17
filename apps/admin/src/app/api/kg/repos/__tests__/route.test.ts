/**
 * Knowledge Graph Repos Route Tests
 */

import * as authServer from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/middleware/ai-feature-gate', () => ({
  checkAIFeatureGate: vi.fn().mockResolvedValue(null),
}));

const mockOrderBy = vi.fn();
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelectDistinct = vi.fn(() => ({ from: mockFrom }));

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({ selectDistinct: mockSelectDistinct })),
}));

vi.mock('@revealui/db/schema', () => ({
  kgNodes: { repo: 'repo-column' },
}));

const { GET } = await import('../route');

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

const fleetOperatorSession = {
  ...mockSession,
  user: {
    ...mockSession.user,
    role: 'admin',
    emailVerified: true,
    _json: { roles: ['super-admin'] },
  },
};

const hostedAdminSession = {
  ...mockSession,
  user: {
    ...mockSession.user,
    role: 'admin',
    emailVerified: true,
    _json: {},
  },
};

describe('GET /api/kg/repos', () => {
  const mockGetSession = vi.mocked(authServer.getSession);

  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderBy.mockResolvedValue([{ repo: 'revealui' }, { repo: 'revdev' }, { repo: null }]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when session is missing', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost:3000/api/kg/repos'));

    expect(response.status).toBe(401);
  });

  it('returns 403 for a hosted CMS admin when licensed-operator env is unset', async () => {
    mockGetSession.mockResolvedValue(hostedAdminSession);

    const response = await GET(new NextRequest('http://localhost:3000/api/kg/repos'));

    expect(response.status).toBe(403);
    expect(mockSelectDistinct).not.toHaveBeenCalled();
  });

  it('returns the distinct repo list for a fleet operator, dropping nulls', async () => {
    mockGetSession.mockResolvedValue(fleetOperatorSession);

    const response = await GET(new NextRequest('http://localhost:3000/api/kg/repos'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.repos).toEqual(['revealui', 'revdev']);
  });

  it('returns the distinct repo list for a licensed-operator', async () => {
    vi.stubEnv('REVEALUI_KG_LICENSED_OPERATOR', '1');
    mockGetSession.mockResolvedValue(hostedAdminSession);

    const response = await GET(new NextRequest('http://localhost:3000/api/kg/repos'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.repos).toEqual(['revealui', 'revdev']);
    vi.unstubAllEnvs();
  });

  it('handles errors gracefully', async () => {
    mockGetSession.mockResolvedValue(fleetOperatorSession);
    mockOrderBy.mockRejectedValue(new Error('db down'));

    const response = await GET(new NextRequest('http://localhost:3000/api/kg/repos'));

    expect(response.status).toBe(500);
  });
});
