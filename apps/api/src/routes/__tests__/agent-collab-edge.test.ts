/**
 * Agent Collab Route  -  Edge Case Tests
 *
 * Supplements agent-collab.test.ts with:
 * - Edit schema: length: 0 fails positive(), index: -1 fails nonnegative()
 * - Edit schema: index: 0 passes nonnegative() (boundary)
 * - Edit handler: getOrLoadDocument throws after applyServerEdit succeeds → 500
 * - Snapshot boundary: exactly 10 MB passes (> not >= MaxSnapshotBytes)
 * - Snapshot: empty document returns textLength: 0, content: ''
 * - Snapshot: mixed human + agent connectedClients returned correctly
 * - Connect: no WS_BASE_URL → defaults to ws://localhost:3004
 * - Connect: agentName with spaces → percent-encoded in wsUrl query params
 * - Connect: agentModel at exactly 100 characters (max boundary) → 200
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { RoomManager } from '../../collab/room-manager.js';
import { createAgentCollabRoute } from '../agent-collab.js';

// ---------------------------------------------------------------------------
// Mocks  -  must come before imports
// ---------------------------------------------------------------------------

vi.mock('../../collab/shared-room-manager.js', () => ({
  getSharedRoomManager: vi.fn(),
}));

import { getSharedRoomManager } from '../../collab/shared-room-manager.js';

const mockedGetSharedRoomManager = vi.mocked(getSharedRoomManager);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRoomManager(overrides?: Partial<RoomManager>): RoomManager {
  return {
    handleConnection: vi.fn(),
    handleMessage: vi.fn(),
    handleDisconnect: vi.fn(),
    getConnectedClients: vi.fn().mockReturnValue([]),
    getOrLoadDocument: vi.fn().mockResolvedValue(new Y.Doc()),
    applyServerEdit: vi.fn().mockResolvedValue(undefined),
    getDocumentSnapshot: vi.fn().mockResolvedValue(null),
    destroy: vi.fn(),
    ...overrides,
  };
}

type TestVariables = {
  db: Parameters<typeof getSharedRoomManager>[0];
  user: { id: string; role: string };
};

function createApp(): Hono<{ Variables: TestVariables }> {
  const app = new Hono<{ Variables: TestVariables }>();
  const mockDb = {} as Parameters<typeof getSharedRoomManager>[0];

  app.use('*', async (c, next) => {
    c.set('db', mockDb);
    c.set('user', { id: 'test-user', role: 'admin' });
    await next();
  });

  const agentRoute = createAgentCollabRoute();
  app.route('/', agentRoute);

  return app;
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/collab/agent/edit  -  schema boundary validation', () => {
  it('returns 400 when length is 0 (positive() constraint requires > 0)', async () => {
    const app = createApp();

    const res = await app.request(
      '/api/collab/agent/edit',
      jsonRequest({
        documentId: 'doc-123',
        edit: { type: 'delete', index: 0, length: 0 },
      }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.success).toBe(false);
  });

  it('returns 400 when index is -1 (nonnegative() constraint requires >= 0)', async () => {
    const app = createApp();

    const res = await app.request(
      '/api/collab/agent/edit',
      jsonRequest({
        documentId: 'doc-123',
        edit: { type: 'insert', index: -1, content: 'text' },
      }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.success).toBe(false);
  });

  it('returns 200 when index is 0 (nonnegative boundary  -  zero is valid)', async () => {
    const mockDoc = new Y.Doc();
    mockDoc.getText('content').insert(0, 'Hello');

    const mockManager = createMockRoomManager({
      applyServerEdit: vi.fn().mockResolvedValue(undefined),
      getOrLoadDocument: vi.fn().mockResolvedValue(mockDoc),
    });
    mockedGetSharedRoomManager.mockReturnValue(mockManager);

    const app = createApp();
    const res = await app.request(
      '/api/collab/agent/edit',
      jsonRequest({
        documentId: 'doc-123',
        edit: { type: 'insert', index: 0, content: 'prefix' },
      }),
    );

    expect(res.status).toBe(200);
    mockDoc.destroy();
  });
});

describe('POST /api/collab/agent/edit  -  post-edit handler failure', () => {
  it('returns 500 when getOrLoadDocument throws after applyServerEdit succeeds', async () => {
    // applyServerEdit resolves, but reading back the document fails.
    // The catch block in the edit handler wraps this as a 500.
    const mockManager = createMockRoomManager({
      applyServerEdit: vi.fn().mockResolvedValue(undefined),
      getOrLoadDocument: vi.fn().mockRejectedValue(new Error('Cache eviction: doc not found')),
    });
    mockedGetSharedRoomManager.mockReturnValue(mockManager);

    const app = createApp();
    const res = await app.request(
      '/api/collab/agent/edit',
      jsonRequest({
        documentId: 'doc-evicted',
        edit: { type: 'replace-all', content: 'new content' },
      }),
    );

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain('Collaboration edit failed');
  });
});

describe('GET /api/collab/agent/snapshot/:documentId  -  size boundary', () => {
  it('returns 200 when snapshot is exactly 10 MB (boundary is >, not >=)', async () => {
    const MaxSnapshotBytes = 10 * 1024 * 1024;
    const atLimitSnapshot = new Uint8Array(1);
    Object.defineProperty(atLimitSnapshot, 'byteLength', {
      value: MaxSnapshotBytes, // exactly at limit  -  should pass
      writable: false,
    });

    // Y.applyUpdate with a 1-byte buffer will likely throw, so we need a valid snapshot.
    // Override byteLength check but use a real Y.Doc snapshot for actual content.
    const doc = new Y.Doc();
    const validSnapshot = Y.encodeStateAsUpdate(doc);
    doc.destroy();

    // We must pass the byteLength check  -  create a snapshot that appears to be at-limit.
    // The handler checks byteLength BEFORE calling Y.applyUpdate, so we can use a real
    // snapshot with an overridden byteLength to test this path.
    const atBoundarySnapshot = new Uint8Array(validSnapshot);
    Object.defineProperty(atBoundarySnapshot, 'byteLength', {
      value: MaxSnapshotBytes, // exactly 10MB  -  NOT exceeding
      writable: false,
      configurable: true,
    });

    const mockManager = createMockRoomManager({
      getDocumentSnapshot: vi.fn().mockResolvedValue(atBoundarySnapshot),
      getConnectedClients: vi.fn().mockReturnValue([]),
    });
    mockedGetSharedRoomManager.mockReturnValue(mockManager);

    const app = createApp();
    const res = await app.request('/api/collab/agent/snapshot/boundary-doc');

    // 10MB exactly should NOT trigger the 413 (condition is > MaxSnapshotBytes)
    expect(res.status).toBe(200);
  });

  it('returns 200 with textLength: 0 and content: "" for an empty document', async () => {
    // Y.Doc with no text written  -  getText('content').toString() returns ''
    const emptyDoc = new Y.Doc();
    const emptySnapshot = Y.encodeStateAsUpdate(emptyDoc);
    emptyDoc.destroy();

    const mockManager = createMockRoomManager({
      getDocumentSnapshot: vi.fn().mockResolvedValue(emptySnapshot),
      getConnectedClients: vi.fn().mockReturnValue([]),
    });
    mockedGetSharedRoomManager.mockReturnValue(mockManager);

    const app = createApp();
    const res = await app.request('/api/collab/agent/snapshot/empty-doc');

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.content).toBe('');
    expect(json.textLength).toBe(0);
  });

  it('returns mixed human and agent connectedClients in snapshot response', async () => {
    const doc = new Y.Doc();
    doc.getText('content').insert(0, 'Shared document');
    const snapshot = Y.encodeStateAsUpdate(doc);
    doc.destroy();

    const mixedClients = [
      {
        type: 'human',
        id: 'user-abc',
        name: 'Alice',
        color: '#3B82F6',
      },
      {
        type: 'agent',
        id: 'agent-xyz',
        name: 'Claude',
        color: '#8B5CF6',
        agentModel: 'claude-sonnet-4-6',
      },
    ];

    const mockManager = createMockRoomManager({
      getDocumentSnapshot: vi.fn().mockResolvedValue(snapshot),
      getConnectedClients: vi.fn().mockReturnValue(mixedClients),
    });
    mockedGetSharedRoomManager.mockReturnValue(mockManager);

    const app = createApp();
    const res = await app.request('/api/collab/agent/snapshot/collab-doc');

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    const clients = json.connectedClients as Array<Record<string, unknown>>;
    expect(clients).toHaveLength(2);
    expect(clients[0]?.type).toBe('human');
    expect(clients[1]?.type).toBe('agent');
    expect(clients[1]?.agentModel).toBe('claude-sonnet-4-6');
  });
});

describe('POST /api/collab/agent/connect  -  wsUrl construction', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults wsBaseUrl to ws://localhost:3004 when WS_BASE_URL is not set', async () => {
    vi.stubEnv('WS_BASE_URL', undefined as unknown as string);

    // Create app AFTER clearing env  -  wsBaseUrl is read at construction time
    const app = createApp();

    const res = await app.request(
      '/api/collab/agent/connect',
      jsonRequest({
        documentId: 'doc-local',
        agentName: 'Claude',
        agentModel: 'claude-opus-4-6',
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.wsUrl as string).toContain('ws://localhost:3004');
  });

  it('percent-encodes agentName with spaces in the wsUrl query string', async () => {
    const app = createApp();

    const res = await app.request(
      '/api/collab/agent/connect',
      jsonRequest({
        documentId: 'doc-123',
        agentName: 'Claude AI',
        agentModel: 'claude-opus-4-6',
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    // URLSearchParams encodes spaces as '+' in query strings
    expect(json.wsUrl as string).toContain('name=Claude+AI');
  });

  it('returns 200 when agentModel is exactly 100 characters (max boundary)', async () => {
    const app = createApp();

    const res = await app.request(
      '/api/collab/agent/connect',
      jsonRequest({
        documentId: 'doc-123',
        agentName: 'Claude',
        agentModel: 'M'.repeat(100),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.success).toBe(true);
    expect((json.identity as Record<string, unknown>).model).toBe('M'.repeat(100));
  });

  it('returns 400 when agentModel exceeds 100 characters', async () => {
    const app = createApp();

    const res = await app.request(
      '/api/collab/agent/connect',
      jsonRequest({
        documentId: 'doc-123',
        agentName: 'Claude',
        agentModel: 'M'.repeat(101),
      }),
    );

    expect(res.status).toBe(400);
  });
});
