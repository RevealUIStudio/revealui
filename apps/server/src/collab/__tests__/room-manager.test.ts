import * as encoding from 'lib0/encoding';
import { describe, expect, it, vi } from 'vitest';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import type { YjsPersistence } from '../persistence.js';
import type { ClientIdentity } from '../room-manager.js';
import { createRoomManager } from '../room-manager.js';

function createMockPersistence(): YjsPersistence {
  return {
    loadDocument: vi.fn().mockResolvedValue(undefined),
    saveDocument: vi.fn().mockResolvedValue(undefined),
    updateClientCount: vi.fn().mockResolvedValue(undefined),
  };
}

function createIdentity(overrides?: Partial<ClientIdentity>): ClientIdentity {
  return {
    type: 'human',
    id: 'test-client',
    name: 'Test User',
    color: '#E06C75',
    ...overrides,
  };
}

function createSyncStep1(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0); // MESSAGE_SYNC
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

describe('createRoomManager', () => {
  it('should create a room manager with expected methods', () => {
    const persistence = createMockPersistence();
    const manager = createRoomManager(persistence);

    expect(manager.handleConnection).toBeDefined();
    expect(manager.handleMessage).toBeDefined();
    expect(manager.handleDisconnect).toBeDefined();
    expect(manager.getConnectedClients).toBeDefined();
    expect(manager.destroy).toBeDefined();
  });

  it('should load document on first client connection', async () => {
    const persistence = createMockPersistence();
    const manager = createRoomManager(persistence);
    const send = vi.fn();

    manager.handleConnection('doc1', 'client1', send, createIdentity({ id: 'client1' }));

    await vi.waitFor(() => {
      expect(persistence.loadDocument).toHaveBeenCalledWith('doc1', expect.anything());
    });
  });

  it('should update client count on connection', () => {
    const persistence = createMockPersistence();
    const manager = createRoomManager(persistence);

    manager.handleConnection('doc1', 'client1', vi.fn(), createIdentity({ id: 'client1' }));
    expect(persistence.updateClientCount).toHaveBeenCalledWith('doc1', 1);

    manager.handleConnection('doc1', 'client2', vi.fn(), createIdentity({ id: 'client2' }));
    expect(persistence.updateClientCount).toHaveBeenCalledWith('doc1', 2);
  });

  it('should send sync step 1 to new client', async () => {
    const persistence = createMockPersistence();
    const manager = createRoomManager(persistence);
    const send = vi.fn();

    manager.handleConnection('doc1', 'client1', send, createIdentity({ id: 'client1' }));

    await vi.waitFor(() => {
      expect(send).toHaveBeenCalled();
    });

    const sentData = send.mock.calls[0][0];
    expect(sentData).toBeInstanceOf(Uint8Array);
  });

  it('should handle disconnect and update client count', () => {
    const persistence = createMockPersistence();
    const manager = createRoomManager(persistence);

    manager.handleConnection('doc1', 'client1', vi.fn(), createIdentity({ id: 'client1' }));
    manager.handleConnection('doc1', 'client2', vi.fn(), createIdentity({ id: 'client2' }));

    manager.handleDisconnect('doc1', 'client1');
    expect(persistence.updateClientCount).toHaveBeenCalledWith('doc1', 1);
  });

  it('should save document when last client disconnects', async () => {
    const persistence = createMockPersistence();
    const manager = createRoomManager(persistence);

    manager.handleConnection('doc1', 'client1', vi.fn(), createIdentity({ id: 'client1' }));
    manager.handleDisconnect('doc1', 'client1');

    await vi.waitFor(() => {
      expect(persistence.saveDocument).toHaveBeenCalledWith('doc1', expect.anything());
    });
  });

  it('should handle message from client', async () => {
    const persistence = createMockPersistence();
    const manager = createRoomManager(persistence);
    const send = vi.fn();

    manager.handleConnection('doc1', 'client1', send, createIdentity({ id: 'client1' }));

    await vi.waitFor(() => {
      expect(send).toHaveBeenCalled();
    });

    const clientDoc = new Y.Doc();
    const syncMsg = createSyncStep1(clientDoc);
    manager.handleMessage('doc1', 'client1', syncMsg);

    clientDoc.destroy();
  });

  it('should clean up all rooms on destroy', () => {
    const persistence = createMockPersistence();
    const manager = createRoomManager(persistence);

    manager.handleConnection('doc1', 'client1', vi.fn(), createIdentity({ id: 'client1' }));
    manager.handleConnection('doc2', 'client2', vi.fn(), createIdentity({ id: 'client2' }));

    manager.destroy();

    expect(persistence.saveDocument).toHaveBeenCalledWith('doc1', expect.anything());
    expect(persistence.saveDocument).toHaveBeenCalledWith('doc2', expect.anything());
  });

  it('should track connected clients with identity', () => {
    const persistence = createMockPersistence();
    const manager = createRoomManager(persistence);

    const humanIdentity = createIdentity({ id: 'human1', name: 'Alice', type: 'human' });
    const agentIdentity: ClientIdentity = {
      type: 'agent',
      id: 'agent1',
      name: 'Claude',
      color: '#8B5CF6',
      agentModel: 'claude-opus-4-6',
    };

    manager.handleConnection('doc1', 'human1', vi.fn(), humanIdentity);
    manager.handleConnection('doc1', 'agent1', vi.fn(), agentIdentity);

    const clients = manager.getConnectedClients('doc1');
    expect(clients).toHaveLength(2);
    expect(clients).toContainEqual(humanIdentity);
    expect(clients).toContainEqual(agentIdentity);
  });

  it('should return empty array for non-existent room', () => {
    const persistence = createMockPersistence();
    const manager = createRoomManager(persistence);

    expect(manager.getConnectedClients('nonexistent')).toEqual([]);
  });

  it('should broadcast sync updates to other clients', async () => {
    const persistence = createMockPersistence();
    const manager = createRoomManager(persistence);
    const send1 = vi.fn();
    const send2 = vi.fn();

    manager.handleConnection('doc1', 'client1', send1, createIdentity({ id: 'client1' }));
    manager.handleConnection('doc1', 'client2', send2, createIdentity({ id: 'client2' }));

    await vi.waitFor(() => {
      expect(send1).toHaveBeenCalled();
      expect(send2).toHaveBeenCalled();
    });

    const clientDoc = new Y.Doc();
    const syncMsg = createSyncStep1(clientDoc);
    manager.handleMessage('doc1', 'client1', syncMsg);

    clientDoc.destroy();
  });
});
