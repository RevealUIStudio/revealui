/**
 * Knowledge Graph Episode Flush Route Tests
 *
 * The only write path into `kg_*` tables from the admin app — verifies auth
 * gating, ontology-enum validation (rejects an unknown node kind / edge
 * relation), the "at least one node or edge" guard, and that a valid body
 * reaches `ingestEpisode` with `episodeType` forced to `manual`.
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

vi.mock('@revealui/db/pool', () => ({
  getPool: vi.fn(() => ({})),
}));

const mockIngestEpisode = vi.fn();

vi.mock('@revealui/knowledge-graph', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@revealui/knowledge-graph')>();
  return {
    ...actual,
    ingestEpisode: (...args: unknown[]) => mockIngestEpisode(...args),
    makePoolExecutor: vi.fn(() => ({})),
  };
});

const { POST } = await import('../route');

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

function postRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/sync/kg-episodes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/sync/kg-episodes', () => {
  const mockGetSession = vi.mocked(authServer.getSession);

  beforeEach(() => {
    vi.clearAllMocks();
    mockIngestEpisode.mockResolvedValue({ episodeId: 'ep-1', nodeCount: 1, edgeCount: 0 });
  });

  it('returns 401 when session is missing', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await POST(
      postRequest({ viewSlug: 'my-view', source: 'kg-curation:my-view', nodes: [], edges: [] }),
    );

    expect(response.status).toBe(401);
  });

  it('rejects a body with an invalid viewSlug', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const response = await POST(
      postRequest({
        viewSlug: 'My View',
        source: 'kg-curation:my-view',
        nodes: [{ kind: 'file', name: 'x.ts', naturalKey: 'revealui/x.ts' }],
        edges: [],
      }),
    );

    expect(response.status).toBe(400);
    expect(mockIngestEpisode).not.toHaveBeenCalled();
  });

  it('rejects a body with an unknown node kind (ontology enum validation)', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const response = await POST(
      postRequest({
        viewSlug: 'my-view',
        source: 'kg-curation:my-view',
        nodes: [{ kind: 'not-a-real-kind', name: 'x.ts', naturalKey: 'revealui/x.ts' }],
        edges: [],
      }),
    );

    expect(response.status).toBe(400);
    expect(mockIngestEpisode).not.toHaveBeenCalled();
  });

  it('rejects a body with an unknown edge relation (ontology enum validation)', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const response = await POST(
      postRequest({
        viewSlug: 'my-view',
        source: 'kg-curation:my-view',
        nodes: [],
        edges: [
          {
            source: { kind: 'file', naturalKey: 'a' },
            target: { kind: 'file', naturalKey: 'b' },
            relation: 'made-up-relation',
            fact: 'a relates to b',
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    expect(mockIngestEpisode).not.toHaveBeenCalled();
  });

  it('rejects a body with neither nodes nor edges', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const response = await POST(
      postRequest({ viewSlug: 'my-view', source: 'kg-curation:my-view', nodes: [], edges: [] }),
    );

    expect(response.status).toBe(400);
    expect(mockIngestEpisode).not.toHaveBeenCalled();
  });

  it('rejects extra/unknown top-level fields (strict schema)', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const response = await POST(
      postRequest({
        viewSlug: 'my-view',
        source: 'kg-curation:my-view',
        nodes: [{ kind: 'file', name: 'x.ts', naturalKey: 'revealui/x.ts' }],
        edges: [],
        episodeType: 'code-scan', // must not be attacker-controllable
      }),
    );

    expect(response.status).toBe(400);
    expect(mockIngestEpisode).not.toHaveBeenCalled();
  });

  it('ingests a valid flush body as a manual episode', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const response = await POST(
      postRequest({
        viewSlug: 'my-view',
        source: 'kg-curation:my-view',
        content: 'curator note',
        nodes: [{ kind: 'file', name: 'x.ts', naturalKey: 'revealui/x.ts', repo: 'revealui' }],
        edges: [],
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.episodeId).toBe('ep-1');
    expect(mockIngestEpisode).toHaveBeenCalledTimes(1);
    const [, input] = mockIngestEpisode.mock.calls[0] ?? [];
    expect(input.episode.episodeType).toBe('manual');
    expect(input.episode.source).toBe('kg-curation:my-view');
    expect(input.episode.contentRef.viewSlug).toBe('my-view');
    expect(input.nodes).toHaveLength(1);
  });
});
