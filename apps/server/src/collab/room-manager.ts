import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import type { YjsPersistence } from './persistence.js';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const DEBOUNCE_MS = 2000;

export interface ClientIdentity {
  type: 'human' | 'agent';
  id: string;
  name: string;
  color: string;
  agentModel?: string;
}

interface Client {
  id: string;
  send: (data: Uint8Array) => void;
  identity: ClientIdentity;
}

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Map<string, Client>;
  persistTimer: ReturnType<typeof setTimeout> | null;
  /** Resolves when the initial document load completes. Prevents sync races. */
  loadPromise: Promise<void> | null;
}

export interface ServerEdit {
  type: 'insert' | 'delete' | 'replace-all';
  textName?: string;
  index?: number;
  content?: string;
  length?: number;
}

export interface RoomManager {
  handleConnection(
    documentId: string,
    clientId: string,
    send: (data: Uint8Array) => void,
    identity: ClientIdentity,
  ): void;
  handleMessage(documentId: string, clientId: string, message: Uint8Array): void;
  handleDisconnect(documentId: string, clientId: string): void;
  getConnectedClients(documentId: string): ClientIdentity[];
  getOrLoadDocument(documentId: string): Promise<Y.Doc>;
  applyServerEdit(documentId: string, edit: ServerEdit): Promise<void>;
  getDocumentSnapshot(documentId: string): Promise<Uint8Array | null>;
  destroy(): void;
}

export interface ProvenanceLogger {
  logEdit(documentId: string, identity: ClientIdentity, update: Uint8Array): void;
  flush(): Promise<void>;
  destroy(): Promise<void>;
}

export function createRoomManager(
  persistence: YjsPersistence,
  provenanceLogger?: ProvenanceLogger,
): RoomManager {
  const rooms = new Map<string, Room>();
  const clientAwarenessMap = new Map<string, number>();

  function getOrCreateRoom(documentId: string): Room {
    let room = rooms.get(documentId);
    if (!room) {
      const doc = new Y.Doc();
      const awareness = new awarenessProtocol.Awareness(doc);
      room = { doc, awareness, clients: new Map(), persistTimer: null, loadPromise: null };
      rooms.set(documentId, room);

      const currentRoom = room;
      doc.on('update', (update: Uint8Array, origin: string | null) => {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.writeUpdate(encoder, update);
        const msg = encoding.toUint8Array(encoder);

        for (const [id, client] of currentRoom.clients) {
          if (id !== origin) {
            client.send(msg);
          }
        }

        schedulePersist(documentId);

        if (provenanceLogger && origin) {
          const client = currentRoom.clients.get(origin);
          if (client) {
            provenanceLogger.logEdit(documentId, client.identity, update);
          }
        }
      });

      awareness.on(
        'update',
        (
          { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
          origin: string | null,
        ) => {
          const changedClients = added.concat(updated, removed);
          const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);

          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
          encoding.writeVarUint8Array(encoder, encodedUpdate);
          const msg = encoding.toUint8Array(encoder);

          for (const [id, client] of currentRoom.clients) {
            if (id !== origin) {
              client.send(msg);
            }
          }
        },
      );
    }
    return room;
  }

  function schedulePersist(documentId: string): void {
    const room = rooms.get(documentId);
    if (!room) return;

    if (room.persistTimer) {
      clearTimeout(room.persistTimer);
    }

    room.persistTimer = setTimeout(() => {
      persistence.saveDocument(documentId, room.doc);
      room.persistTimer = null;
    }, DEBOUNCE_MS);
  }

  return {
    handleConnection(
      documentId: string,
      clientId: string,
      send: (data: Uint8Array) => void,
      identity: ClientIdentity,
    ): void {
      const room = getOrCreateRoom(documentId);
      const isFirstClient = room.clients.size === 0;

      room.clients.set(clientId, { id: clientId, send, identity });

      // Ensure the doc is fully loaded before sending syncStep1 to ANY client.
      // Without this, clients connecting during the initial async load would
      // receive syncStep1 against an empty doc, causing data loss.
      if (isFirstClient) {
        room.loadPromise = persistence.loadDocument(documentId, room.doc);
      }

      const sendSync = () => {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.writeSyncStep1(encoder, room.doc);
        send(encoding.toUint8Array(encoder));
      };

      if (room.loadPromise) {
        room.loadPromise.then(sendSync);
      } else {
        sendSync();
      }

      // Send current awareness states to the new client
      const awarenessStates = room.awareness.getStates();
      if (awarenessStates.size > 0) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        const update = awarenessProtocol.encodeAwarenessUpdate(
          room.awareness,
          Array.from(awarenessStates.keys()),
        );
        encoding.writeVarUint8Array(encoder, update);
        send(encoding.toUint8Array(encoder));
      }

      persistence.updateClientCount(documentId, room.clients.size);
    },

    handleMessage(documentId: string, clientId: string, message: Uint8Array): void {
      const room = rooms.get(documentId);
      if (!room) return;

      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === MESSAGE_SYNC) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, room.doc, clientId);

        if (encoding.length(encoder) > 1) {
          const client = room.clients.get(clientId);
          if (client) {
            client.send(encoding.toUint8Array(encoder));
          }
        }
      } else if (messageType === MESSAGE_AWARENESS) {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(room.awareness, update, clientId);

        // Track the numeric awareness client ID for this string client ID
        // so we can clean up awareness state on disconnect.
        const updateDecoder = decoding.createDecoder(update);
        const numClients = decoding.readVarUint(updateDecoder);
        if (numClients > 0) {
          const awarenessClientId = decoding.readVarUint(updateDecoder);
          clientAwarenessMap.set(clientId, awarenessClientId);
        }
      }
    },

    handleDisconnect(documentId: string, clientId: string): void {
      const room = rooms.get(documentId);
      if (!room) return;

      // Remove awareness state for disconnecting client
      const awarenessClientId = clientAwarenessMap.get(clientId);
      if (awarenessClientId !== undefined) {
        awarenessProtocol.removeAwarenessStates(room.awareness, [awarenessClientId], 'disconnect');
        clientAwarenessMap.delete(clientId);
      }

      room.clients.delete(clientId);
      persistence.updateClientCount(documentId, room.clients.size);

      if (room.clients.size === 0) {
        if (room.persistTimer) {
          clearTimeout(room.persistTimer);
          room.persistTimer = null;
        }

        persistence.saveDocument(documentId, room.doc).then(() => {
          room.awareness.destroy();
          room.doc.destroy();
          rooms.delete(documentId);
        });
      }
    },

    getConnectedClients(documentId: string): ClientIdentity[] {
      const room = rooms.get(documentId);
      if (!room) return [];
      return Array.from(room.clients.values()).map((c) => c.identity);
    },

    async getOrLoadDocument(documentId: string): Promise<Y.Doc> {
      const room = getOrCreateRoom(documentId);
      if (room.clients.size === 0) {
        await persistence.loadDocument(documentId, room.doc);
      }
      return room.doc;
    },

    async applyServerEdit(documentId: string, edit: ServerEdit): Promise<void> {
      const room = getOrCreateRoom(documentId);
      if (room.clients.size === 0) {
        await persistence.loadDocument(documentId, room.doc);
      }

      const textName = edit.textName ?? 'content';
      const text = room.doc.getText(textName);

      room.doc.transact(() => {
        switch (edit.type) {
          case 'insert': {
            if (edit.index === undefined || edit.content === undefined) {
              throw new Error('insert requires index and content');
            }
            text.insert(edit.index, edit.content);
            break;
          }
          case 'delete': {
            if (edit.index === undefined || edit.length === undefined) {
              throw new Error('delete requires index and length');
            }
            text.delete(edit.index, edit.length);
            break;
          }
          case 'replace-all': {
            if (edit.content === undefined) {
              throw new Error('replace-all requires content');
            }
            text.delete(0, text.length);
            text.insert(0, edit.content);
            break;
          }
        }
      }, 'server-edit');

      if (room.clients.size === 0) {
        await persistence.saveDocument(documentId, room.doc);
      }
    },

    async getDocumentSnapshot(documentId: string): Promise<Uint8Array | null> {
      const room = rooms.get(documentId);
      if (room) {
        return Y.encodeStateAsUpdate(room.doc);
      }

      const tempDoc = new Y.Doc();
      await persistence.loadDocument(documentId, tempDoc);
      const state = Y.encodeStateAsUpdate(tempDoc);
      tempDoc.destroy();

      // Yjs empty doc encodes as ≤2 bytes (version header only)
      const YjsEmptyDocSize = 2;
      if (state.length <= YjsEmptyDocSize) return null;
      return state;
    },

    destroy(): void {
      for (const [documentId, room] of rooms) {
        if (room.persistTimer) {
          clearTimeout(room.persistTimer);
        }
        persistence.saveDocument(documentId, room.doc);
        room.awareness.destroy();
        room.doc.destroy();
      }
      rooms.clear();
      clientAwarenessMap.clear();
      provenanceLogger?.destroy();
    },
  };
}
