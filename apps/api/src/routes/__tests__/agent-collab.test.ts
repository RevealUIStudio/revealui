import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
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

type TestVariables = { db: Parameters<typeof getSharedRoomManager>[0] };

function createApp(): Hono<{ Variables: TestVariables }> {
  const app = new Hono<{ Variables: TestVariables }>();
  const mockDb = {} as Parameters<typeof getSharedRoomManager>[0];

  app.use('*', async (c, next) => {
    c.set('db', mockDb);
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
  });
});
