import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { RoomManager } from '../../collab/room-manager.js';
import { createAgentCollabRoute } from '../agent-collab.js';

vi.mock('../../collab/shared-room-manager.js', () => ({
  getSharedRoomManager: vi.fn(),
}));

import { getSharedRoomManager } from '../../collab/shared-room-manager.js';

const mockedGetSharedRoomManager = vi.mocked(getSharedRoomManager);

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

function jsonRequest(_url: string, body: unknown): RequestInit {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  };
}

describe('agent-collab route', () => {
  describe('POST /api/collab/agent/connect', () => {
    it('should return 200 with WebSocket URL and identity', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          documentId: 'doc-123',
          agentName: 'Claude',
          agentModel: 'claude-opus-4-6',
          color: '#FF5733',
        }),
      );

      expect(res.status).toBe(200);

      const json = (await res.json()) as Record<string, unknown>;
      expect(json.success).toBe(true);
      expect(json.documentId).toBe('doc-123');
      expect(json.wsUrl).toContain('doc-123');
      expect(json.wsUrl).toContain('name=Claude');
      expect(json.wsUrl).toContain('color=%23FF5733');
      expect(json.wsUrl).toContain('type=agent');
      expect(json.wsUrl).toContain('agentModel=claude-opus-4-6');
      expect(json.identity).toEqual({
        type: 'agent',
        name: 'Claude',
        model: 'claude-opus-4-6',
        color: '#FF5733',
      });
    });

    it('should use default color #8B5CF6 when not provided', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          documentId: 'doc-456',
          agentName: 'Claude',
          agentModel: 'claude-opus-4-6',
        }),
      );

      expect(res.status).toBe(200);

      const json = (await res.json()) as Record<string, unknown>;
      expect((json.identity as Record<string, unknown>).color).toBe('#8B5CF6');
      expect(json.wsUrl).toContain('color=%238B5CF6');
    });

    it('should return 400 for missing documentId', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          agentName: 'Claude',
          agentModel: 'claude-opus-4-6',
        }),
      );

      expect(res.status).toBe(400);

      const json = (await res.json()) as Record<string, unknown>;
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 400 for missing agentName', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          documentId: 'doc-123',
          agentModel: 'claude-opus-4-6',
        }),
      );

      expect(res.status).toBe(400);

      const json = (await res.json()) as Record<string, unknown>;
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 400 for missing agentModel', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          documentId: 'doc-123',
          agentName: 'Claude',
        }),
      );

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid color format', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          documentId: 'doc-123',
          agentName: 'Claude',
          agentModel: 'claude-opus-4-6',
          color: 'red', // not #RRGGBB
        }),
      );

      expect(res.status).toBe(400);
    });

    it('should return 400 when agentName exceeds 100 characters', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          documentId: 'doc-123',
          agentName: 'A'.repeat(101),
          agentModel: 'claude-opus-4-6',
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/collab/agent/edit', () => {
    it('should apply insert edit and return success', async () => {
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
        jsonRequest('/api/collab/agent/edit', {
          documentId: 'doc-123',
          edit: {
            type: 'insert',
            index: 5,
            content: ' World',
          },
        }),
      );

      expect(res.status).toBe(200);

      const json = (await res.json()) as Record<string, unknown>;
      expect(json.success).toBe(true);
      expect(json.documentId).toBe('doc-123');
      expect(json.textLength).toBe(5);
      expect(mockManager.applyServerEdit).toHaveBeenCalledWith('doc-123', {
        type: 'insert',
        index: 5,
        content: ' World',
      });

      mockDoc.destroy();
    });

    it('should apply replace-all edit and return success', async () => {
      const mockDoc = new Y.Doc();
      mockDoc.getText('content').insert(0, 'New content here');

      const mockManager = createMockRoomManager({
        applyServerEdit: vi.fn().mockResolvedValue(undefined),
        getOrLoadDocument: vi.fn().mockResolvedValue(mockDoc),
      });
      mockedGetSharedRoomManager.mockReturnValue(mockManager);

      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/edit',
        jsonRequest('/api/collab/agent/edit', {
          documentId: 'doc-789',
          edit: {
            type: 'replace-all',
            content: 'New content here',
          },
        }),
      );

      expect(res.status).toBe(200);

      const json = (await res.json()) as Record<string, unknown>;
      expect(json.success).toBe(true);
      expect(json.documentId).toBe('doc-789');
      expect(json.textLength).toBe(16);

      mockDoc.destroy();
    });

    it('should return 500 when edit fails', async () => {
      const mockManager = createMockRoomManager({
        applyServerEdit: vi.fn().mockRejectedValue(new Error('Document locked')),
      });
      mockedGetSharedRoomManager.mockReturnValue(mockManager);

      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/edit',
        jsonRequest('/api/collab/agent/edit', {
          documentId: 'doc-locked',
          edit: {
            type: 'insert',
            index: 0,
            content: 'test',
          },
        }),
      );

      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toContain('Document locked');
    });

    it('should return 400 for invalid edit type', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/edit',
        jsonRequest('/api/collab/agent/edit', {
          documentId: 'doc-123',
          edit: {
            type: 'invalid-type',
          },
        }),
      );

      expect(res.status).toBe(400);

      const json = (await res.json()) as Record<string, unknown>;
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should apply delete edit and return success', async () => {
      const mockDoc = new Y.Doc();
      mockDoc.getText('content').insert(0, 'Hello World');

      const mockManager = createMockRoomManager({
        applyServerEdit: vi.fn().mockResolvedValue(undefined),
        getOrLoadDocument: vi.fn().mockResolvedValue(mockDoc),
      });
      mockedGetSharedRoomManager.mockReturnValue(mockManager);

      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/edit',
        jsonRequest('/api/collab/agent/edit', {
          documentId: 'doc-123',
          edit: {
            type: 'delete',
            index: 5,
            length: 6,
          },
        }),
      );

      expect(res.status).toBe(200);

      const json = (await res.json()) as Record<string, unknown>;
      expect(json.success).toBe(true);
      expect(json.documentId).toBe('doc-123');
      expect(mockManager.applyServerEdit).toHaveBeenCalledWith('doc-123', {
        type: 'delete',
        index: 5,
        length: 6,
      });

      mockDoc.destroy();
    });
  });

  describe('GET /api/collab/agent/snapshot/:documentId', () => {
    it('should return document content', async () => {
      const snapshotDoc = new Y.Doc();
      snapshotDoc.getText('content').insert(0, 'Document content');
      const snapshot = Y.encodeStateAsUpdate(snapshotDoc);
      snapshotDoc.destroy();

      const connectedClients = [
        {
          type: 'agent' as const,
          id: 'agent-1',
          name: 'Claude',
          color: '#8B5CF6',
          agentModel: 'claude-opus-4-6',
        },
      ];

      const mockManager = createMockRoomManager({
        getDocumentSnapshot: vi.fn().mockResolvedValue(snapshot),
        getConnectedClients: vi.fn().mockReturnValue(connectedClients),
      });
      mockedGetSharedRoomManager.mockReturnValue(mockManager);

      const app = createApp();

      const res = await app.request('/api/collab/agent/snapshot/doc-123');

      expect(res.status).toBe(200);

      const json = (await res.json()) as Record<string, unknown>;
      expect(json.success).toBe(true);
      expect(json.documentId).toBe('doc-123');
      expect(json.content).toBe('Document content');
      expect(json.textLength).toBe(16);
      expect(json.connectedClients).toEqual(connectedClients);
    });

    it('should return 404 for non-existent document', async () => {
      const mockManager = createMockRoomManager({
        getDocumentSnapshot: vi.fn().mockResolvedValue(null),
      });
      mockedGetSharedRoomManager.mockReturnValue(mockManager);

      const app = createApp();

      const res = await app.request('/api/collab/agent/snapshot/nonexistent-doc');

      expect(res.status).toBe(404);
      const text = await res.text();
      expect(text).toContain('Document not found');
    });

    it('should return 413 when snapshot exceeds 10 MB', async () => {
      // Allocate a minimal array but override byteLength to exceed the 10 MB cap
      const oversizedSnapshot = new Uint8Array(1);
      Object.defineProperty(oversizedSnapshot, 'byteLength', {
        value: 10 * 1024 * 1024 + 1,
        writable: false,
      });

      const mockManager = createMockRoomManager({
        getDocumentSnapshot: vi.fn().mockResolvedValue(oversizedSnapshot),
      });
      mockedGetSharedRoomManager.mockReturnValue(mockManager);

      const app = createApp();

      const res = await app.request('/api/collab/agent/snapshot/large-doc');

      expect(res.status).toBe(413);
      const text = await res.text();
      expect(text).toContain('too large');
    });

    it('should return empty connectedClients when no clients are connected', async () => {
      const snapshotDoc = new Y.Doc();
      const snapshot = Y.encodeStateAsUpdate(snapshotDoc);
      snapshotDoc.destroy();

      const mockManager = createMockRoomManager({
        getDocumentSnapshot: vi.fn().mockResolvedValue(snapshot),
        getConnectedClients: vi.fn().mockReturnValue([]),
      });
      mockedGetSharedRoomManager.mockReturnValue(mockManager);

      const app = createApp();

      const res = await app.request('/api/collab/agent/snapshot/empty-doc');

      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json.connectedClients).toEqual([]);
    });

    it('propagates as 500 when getDocumentSnapshot throws (no try/catch in handler)', async () => {
      const mockManager = createMockRoomManager({
        getDocumentSnapshot: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      });
      mockedGetSharedRoomManager.mockReturnValue(mockManager);

      const app = createApp();
      const res = await app.request('/api/collab/agent/snapshot/error-doc');

      expect(res.status).toBe(500);
    });

    it('returns 200 for a small valid snapshot (under size cap)', async () => {
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Small document');
      const validSnapshot = Y.encodeStateAsUpdate(doc);
      doc.destroy();

      const mockManager = createMockRoomManager({
        getDocumentSnapshot: vi.fn().mockResolvedValue(validSnapshot),
        getConnectedClients: vi.fn().mockReturnValue([]),
      });
      mockedGetSharedRoomManager.mockReturnValue(mockManager);

      const app = createApp();
      const res = await app.request('/api/collab/agent/snapshot/valid-doc');

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/collab/agent/edit — additional edge cases', () => {
    it('returns 500 with "Unknown error" when applyServerEdit rejects with a non-Error', async () => {
      const mockDoc = new Y.Doc();

      const mockManager = createMockRoomManager({
        applyServerEdit: vi.fn().mockRejectedValue('plain string rejection'),
        getOrLoadDocument: vi.fn().mockResolvedValue(mockDoc),
      });
      mockedGetSharedRoomManager.mockReturnValue(mockManager);

      const app = createApp();
      const res = await app.request(
        '/api/collab/agent/edit',
        jsonRequest('/api/collab/agent/edit', {
          documentId: 'doc-123',
          edit: { type: 'insert', index: 0, content: 'test' },
        }),
      );

      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toContain('Unknown error');

      mockDoc.destroy();
    });

    it('reads textLength from the named text field when textName is specified', async () => {
      const mockDoc = new Y.Doc();
      mockDoc.getText('body').insert(0, 'Section text here');

      const mockManager = createMockRoomManager({
        applyServerEdit: vi.fn().mockResolvedValue(undefined),
        getOrLoadDocument: vi.fn().mockResolvedValue(mockDoc),
      });
      mockedGetSharedRoomManager.mockReturnValue(mockManager);

      const app = createApp();
      const res = await app.request(
        '/api/collab/agent/edit',
        jsonRequest('/api/collab/agent/edit', {
          documentId: 'doc-123',
          edit: { type: 'replace-all', textName: 'body', content: 'Section text here' },
        }),
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      // textLength comes from getText('body'), not getText('content')
      expect(json.textLength).toBe(17);

      mockDoc.destroy();
    });
  });

  describe('POST /api/collab/agent/connect — boundary values', () => {
    it('returns 400 when documentId is an empty string', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          documentId: '',
          agentName: 'Claude',
          agentModel: 'claude-opus-4-6',
        }),
      );

      expect(res.status).toBe(400);
    });

    it('returns 400 when agentModel is an empty string', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          documentId: 'doc-123',
          agentName: 'Claude',
          agentModel: '',
        }),
      );

      expect(res.status).toBe(400);
    });

    it('accepts agentName at exactly 1 character (min boundary)', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          documentId: 'doc-123',
          agentName: 'X',
          agentModel: 'claude-opus-4-6',
        }),
      );

      expect(res.status).toBe(200);
    });

    it('accepts agentName at exactly 100 characters (max boundary)', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          documentId: 'doc-123',
          agentName: 'A'.repeat(100),
          agentModel: 'claude-opus-4-6',
        }),
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json.success).toBe(true);
    });

    it('accepts lowercase hex color (e.g., #ff5733)', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          documentId: 'doc-123',
          agentName: 'Claude',
          agentModel: 'claude-opus-4-6',
          color: '#ff5733',
        }),
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      expect((json.identity as Record<string, unknown>).color).toBe('#ff5733');
    });
  });

  describe('POST /api/collab/agent/edit — documentId validation', () => {
    it('returns 400 when documentId is an empty string', async () => {
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/edit',
        jsonRequest('/api/collab/agent/edit', {
          documentId: '',
          edit: { type: 'insert', index: 0, content: 'test' },
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/collab/agent/connect — WS_BASE_URL env override', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('uses WS_BASE_URL env var in the returned wsUrl', async () => {
      vi.stubEnv('WS_BASE_URL', 'wss://collab.example.com');
      // Must create app AFTER stubbing env — wsBaseUrl is read at construction time
      const app = createApp();

      const res = await app.request(
        '/api/collab/agent/connect',
        jsonRequest('/api/collab/agent/connect', {
          documentId: 'doc-env',
          agentName: 'Claude',
          agentModel: 'claude-sonnet-4-6',
        }),
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      expect((json.wsUrl as string).startsWith('wss://collab.example.com/')).toBe(true);
    });
  });
});
