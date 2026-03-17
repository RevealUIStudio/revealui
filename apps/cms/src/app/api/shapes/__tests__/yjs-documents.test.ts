/**
 * Yjs Documents Shape Proxy Route Tests
 *
 * Tests the authenticated proxy route for ElectricSQL yjs_documents shape.
 */

import * as authServer from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../yjs-documents/route';

// Mock the auth server
vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
}));

// Mock the electric proxy utilities
vi.mock('@/lib/api/electric-proxy', () => ({
  prepareElectricUrl: vi.fn((_url: string) => {
    const electricUrl = new URL('http://localhost:5133/v1/shape');
    electricUrl.searchParams.set('table', 'yjs_documents');
    return electricUrl;
  }),
  proxyElectricRequest: vi.fn(async () => {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }),
}));

const VALID_SESSION = {
  session: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: '123e4567-e89b-12d3-a456-426614174001',
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
    id: '123e4567-e89b-12d3-a456-426614174001',
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

const VALID_DOC_ID = 'aaaabbbb-cccc-dddd-eeee-ffff00001111';

describe('GET /api/shapes/yjs-documents', () => {
  const mockGetSession = vi.mocked(authServer.getSession);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when session is missing', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/shapes/yjs-documents?document_id=${VALID_DOC_ID}`,
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should return 400 when document_id is missing', async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);

    const request = new NextRequest('http://localhost:3000/api/shapes/yjs-documents');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when document_id is not a UUID', async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);

    const request = new NextRequest(
      'http://localhost:3000/api/shapes/yjs-documents?document_id=not-a-valid-uuid',
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('should proxy request when authenticated with valid UUID', async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);

    const { prepareElectricUrl, proxyElectricRequest } = await import('@/lib/api/electric-proxy');

    const request = new NextRequest(
      `http://localhost:3000/api/shapes/yjs-documents?document_id=${VALID_DOC_ID}`,
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(prepareElectricUrl).toHaveBeenCalled();
    expect(proxyElectricRequest).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    mockGetSession.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest(
      `http://localhost:3000/api/shapes/yjs-documents?document_id=${VALID_DOC_ID}`,
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('INTERNAL_ERROR');
  });
});
