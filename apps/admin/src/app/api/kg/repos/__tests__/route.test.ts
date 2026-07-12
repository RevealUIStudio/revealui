/**
 * Knowledge Graph Repos Route Tests
 */

import * as authServer from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
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

describe('GET /api/kg/repos', () => {
  const mockGetSession = vi.mocked(authServer.getSession);

  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderBy.mockResolvedValue([{ repo: 'revealui' }, { repo: 'revdev' }, { repo: null }]);
  });

  it('returns 401 when session is missing', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost:3000/api/kg/repos'));

    expect(response.status).toBe(401);
  });

  it('returns the distinct repo list, dropping nulls', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const response = await GET(new NextRequest('http://localhost:3000/api/kg/repos'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.repos).toEqual(['revealui', 'revdev']);
  });

  it('handles errors gracefully', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockOrderBy.mockRejectedValue(new Error('db down'));

    const response = await GET(new NextRequest('http://localhost:3000/api/kg/repos'));

    expect(response.status).toBe(500);
  });
});
