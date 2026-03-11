import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { Observable } from 'lib0/observable';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { MESSAGE_AWARENESS, MESSAGE_SYNC } from './protocol-constants.js';

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;
const RECONNECT_MULTIPLIER = 1.5;

export interface UserPresence {
  name: string;
  color: string;
  type: 'human' | 'agent';
  agentModel?: string;
  cursor?: { index: number; length: number };
}

export class CollabProvider extends Observable<string> {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  private serverUrl: string;
  private documentId: string;
  private ws: WebSocket | null = null;
  private synced = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private updateHandler: ((update: Uint8Array, origin: unknown) => void) | null = null;
  private awarenessUpdateHandler: (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: string | null,
  ) => void;

  constructor(
    serverUrl: string,
    documentId: string,
    doc: Y.Doc,
    options?: { initialState?: Uint8Array | null },
  ) {
    super();
    this.serverUrl = serverUrl;
    this.documentId = documentId;
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(doc);

    if (options?.initialState) {
      Y.applyUpdate(doc, options.initialState);
    }

    // Send awareness updates over WebSocket
    this.awarenessUpdateHandler = ({ added, updated, removed }, origin) => {
      if (origin === 'remote') return;
      const changedClients = added.concat(updated, removed);
      const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, update);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(encoding.toUint8Array(encoder));
      }
    };
    this.awareness.on('update', this.awarenessUpdateHandler);
  }

  setLocalIdentity(identity: UserPresence): void {
    this.awareness.setLocalState(identity);
  }

  getConnectedUsers(): Map<number, UserPresence> {
    const users = new Map<number, UserPresence>();
    for (const [clientId, state] of this.awareness.getStates()) {
      if (state && typeof state === 'object') {
        users.set(clientId, state as UserPresence);
      }
    }
    return users;
  }

  connect(): void {
    if (this.ws) return;

    const url = `${this.serverUrl}/ws/collab/${this.documentId}`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.emit('status', [{ status: 'connecting' }]);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('status', [{ status: 'connected' }]);

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      this.ws?.send(encoding.toUint8Array(encoder));

      // Send local awareness state to server
      const localState = this.awareness.getLocalState();
      if (localState) {
        const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
          this.doc.clientID,
        ]);
        const awarenessEncoder = encoding.createEncoder();
        encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(awarenessEncoder, awarenessUpdate);
        this.ws?.send(encoding.toUint8Array(awarenessEncoder));
      }

      this.updateHandler = (update: Uint8Array, origin: unknown) => {
        if (origin === this) return;
        const updateEncoder = encoding.createEncoder();
        encoding.writeVarUint(updateEncoder, MESSAGE_SYNC);
        syncProtocol.writeUpdate(updateEncoder, update);
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(encoding.toUint8Array(updateEncoder));
        }
      };
      this.doc.on('update', this.updateHandler);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      const data = new Uint8Array(event.data as ArrayBuffer);
      const decoder = decoding.createDecoder(data);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === MESSAGE_SYNC) {
        const responseEncoder = encoding.createEncoder();
        encoding.writeVarUint(responseEncoder, MESSAGE_SYNC);
        const syncMessageType = syncProtocol.readSyncMessage(
          decoder,
          responseEncoder,
          this.doc,
          this,
        );

        if (encoding.length(responseEncoder) > 1) {
          this.ws?.send(encoding.toUint8Array(responseEncoder));
        }

        if (syncMessageType === 1 && !this.synced) this.synced = true;
        this.emit('sync', [true]);
      } else if (messageType === MESSAGE_AWARENESS) {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(this.awareness, update, 'remote');
        this.emit('awareness', [this.getConnectedUsers()]);
      }
    };

    this.ws.onclose = () => {
      if (this.updateHandler) {
        this.doc.off('update', this.updateHandler);
        this.updateHandler = null;
      }
      this.ws = null;
      this.synced = false;
      this.emit('sync', [false]);
      this.emit('status', [{ status: 'disconnected' }]);
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this.cancelReconnect();
    if (this.updateHandler) {
      this.doc.off('update', this.updateHandler);
      this.updateHandler = null;
    }

    // Broadcast awareness removal before disconnecting
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'local');

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.synced = false;
    this.emit('status', [{ status: 'disconnected' }]);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.emit('status', [{ status: 'failed' }]);
      return;
    }

    const delay = BASE_RECONNECT_DELAY * RECONNECT_MULTIPLIER ** this.reconnectAttempts;
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  destroy(): void {
    this.awareness.off('update', this.awarenessUpdateHandler);
    this.disconnect();
    this.awareness.destroy();
    super.destroy();
  }
}
