/**
 * RevMind diagram job — POST /api/kg/diagram
 *
 * Fail closed on dual-gate #2884. Mermaid is always SoT on success.
 * launch_architecture is Launch / licensed. 3d is P1-unsupported (501).
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

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({})),
}));

const mockLoadRows = vi.fn();
vi.mock('@/lib/api/kg-diagram-snapshot', () => ({
  loadKgDiagramRows: (...args: unknown[]) => mockLoadRows(...args),
}));

vi.mock('@/lib/api/kg-diagram-png', () => ({
  pngFromSvg: vi.fn().mockResolvedValue('cG5n'),
}));

const { POST } = await import('../route');
const { POST: aliasPOST } = await import('../../../revmind/diagram/route');

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

function fixtureGraph(count: number): { nodes: unknown[]; edges: unknown[] } {
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    kind: i === 0 ? 'app' : 'file',
    name: `Node ${i}`,
    naturalKey: `nk:node-${i}`,
    repo: 'revealui',
    lastConfirmedAt: '2026-01-01T00:00:00.000Z',
  }));
  const edges = Array.from({ length: Math.max(count - 1, 0) }, (_, i) => ({
    id: `edge-${i}`,
    sourceId: `node-${i}`,
    targetId: `node-${i + 1}`,
    relation: 'depends-on',
    validAt: '2026-01-01T00:00:00.000Z',
  }));
  return { nodes, edges };
}

function post(body: unknown, path = 'http://localhost:3000/api/kg/diagram'): NextRequest {
  return new NextRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/kg/diagram', () => {
  const mockGetSession = vi.mocked(authServer.getSession);

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadRows.mockResolvedValue(fixtureGraph(3));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when session is missing (fail closed)', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await POST(
      post({
        format: ['mermaid'],
        purpose: 'consultation_sketch',
      }),
    );

    expect(response.status).toBe(401);
    expect(mockLoadRows).not.toHaveBeenCalled();
  });

  it('returns 403 for a hosted CMS admin when licensed-operator env is unset', async () => {
    mockGetSession.mockResolvedValue(hostedAdminSession);

    const response = await POST(
      post({
        format: ['mermaid'],
        purpose: 'consultation_sketch',
      }),
    );

    expect(response.status).toBe(403);
    expect(mockLoadRows).not.toHaveBeenCalled();
  });

  it('gates launch_architecture behind Launch / licensed dual-gate', async () => {
    mockGetSession.mockResolvedValue(hostedAdminSession);

    const response = await POST(
      post({
        format: ['mermaid'],
        purpose: 'launch_architecture',
        repo: 'revealui',
      }),
    );

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.code === 'FORBIDDEN' || data.code === 'LAUNCH_ARCHITECTURE_FORBIDDEN').toBe(true);
    expect(mockLoadRows).not.toHaveBeenCalled();
  });

  it('runs launch_architecture for a licensed-operator with a repo', async () => {
    vi.stubEnv('REVEALUI_KG_LICENSED_OPERATOR', '1');
    mockGetSession.mockResolvedValue(hostedAdminSession);

    const response = await POST(
      post({
        format: ['mermaid', 'svg'],
        purpose: 'launch_architecture',
        repo: 'revealui',
        theme: 'rev',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.purpose).toBe('launch_architecture');
    expect(typeof data.mermaid).toBe('string');
    expect(data.mermaid.startsWith('flowchart TD')).toBe(true);
    expect(data.theme).toBe('rev');
    expect(data.svg).toContain('#0b1f3a');
    expect(data.honesty).toContain('not a public Architecture SKU');
  });

  it('always includes mermaid SoT on success even when only svg is requested', async () => {
    mockGetSession.mockResolvedValue(fleetOperatorSession);

    const response = await POST(
      post({
        format: ['svg'],
        purpose: 'consultation_sketch',
        theme: 'minimal',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mermaid.startsWith('flowchart TD')).toBe(true);
    expect(data.svg).toContain('#ffffff');
    expect(data.theme).toBe('minimal');
    expect(typeof data.graphHash).toBe('string');
    expect(data.graphHash.length).toBeGreaterThan(8);
    expect(typeof data.graphVersion).toBe('string');
  });

  it('caps consultation_sketch node count', async () => {
    mockGetSession.mockResolvedValue(fleetOperatorSession);
    mockLoadRows.mockResolvedValue(fixtureGraph(40));

    const response = await POST(
      post({
        format: ['mermaid'],
        purpose: 'consultation_sketch',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nodeCount).toBeLessThanOrEqual(24);
    expect(data.truncated).toBe(true);
    expect(data.mermaid.startsWith('flowchart TD')).toBe(true);
  });

  it('returns 501 for view 3d with a clear unsupported message', async () => {
    mockGetSession.mockResolvedValue(fleetOperatorSession);

    const response = await POST(
      post({
        format: ['mermaid'],
        purpose: 'consultation_sketch',
        view: '3d',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(501);
    expect(data.code).toBe('VIEW_UNSUPPORTED');
    expect(data.message).toContain('2d');
    expect(mockLoadRows).not.toHaveBeenCalled();
  });

  it('forwards the same fail-closed gate on the /api/revmind/diagram alias', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await aliasPOST(
      post(
        {
          format: ['mermaid'],
          purpose: 'consultation_sketch',
        },
        'http://localhost:3000/api/revmind/diagram',
      ),
    );

    expect(response.status).toBe(401);
    expect(aliasPOST).toBe(POST);
  });
});
