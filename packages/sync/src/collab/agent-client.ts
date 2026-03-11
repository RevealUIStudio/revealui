import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { Observable } from 'lib0/observable';
import WebSocket from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { MESSAGE_AWARENESS, MESSAGE_SYNC } from './protocol-constants.js';

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;
const RECONNECT_MULTIPLIER = 2;

export interface AgentIdentity {
  type: 'agent';
  name: string;
  model: string;
  color: string;
}

export interface AgentCollabClientOptions {
  serverUrl: string;
  documentId: string;
  identity: AgentIdentity;
  authToken?: string;
  autoReconnect?: boolean;
  defaultTextName?: string;
}

export class AgentCollabClient extends Observable<string> {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  private readonly serverUrl: string;
  private readonly documentId: string;
  private readonly identity: AgentIdentity;
  private readonly authToken?: string;
  private readonly autoReconnect: boolean;
  private readonly defaultTextName: string;

  private ws: WebSocket | null = null;
  private synced = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private updateHandler: ((update: Uint8Array, origin: unknown) => void) | null = null;
  private awarenessUpdateHandler: (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: string | null,
  ) => void;
  private destroyed = false;
  private pendingSyncAbort: (() => void) | null = null;

  constructor(options: AgentCollabClientOptions) {
    super();
    this.serverUrl = options.serverUrl;
    this.documentId = options.documentId;
    this.identity = options.identity;
    this.authToken = options.authToken;
    this.autoReconnect = options.autoReconnect ?? true;
    this.defaultTextName = options.defaultTextName ?? 'content';

    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

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

  connect(): void {
    if (this.ws || this.destroyed) return;

    const url = this.buildWebSocketUrl();
    this.ws = new WebSocket(url);

    this.emit('status', [{ status: 'connecting' }]);

    this.ws.on('open', () => this.handleOpen());
    this.ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => this.handleMessage(data));
    this.ws.on('close', () => this.handleClose());
    this.ws.on('error', (err: Error) => this.handleError(err));
  }

  disconnect(): void {
    this.cancelReconnect();
    if (this.updateHandler) {
      this.doc.off('update', this.updateHandler);
      this.updateHandler = null;
    }

    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'local');

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.synced = false;
    this.emit('status', [{ status: 'disconnected' }]);
  }

  getDocument(): Y.Doc {
    return this.doc;
  }

  getText(name?: string): Y.Text {
    return this.doc.getText(name ?? this.defaultTextName);
  }

  getTextContent(name?: string): string {
    return this.getText(name).toString();
  }

  insertText(index: number, content: string, name?: string): void {
    this.getText(name).insert(index, content);
  }

  deleteText(index: number, length: number, name?: string): void {
    this.getText(name).delete(index, length);
  }

  replaceAll(content: string, name?: string): void {
    const text = this.getText(name);
    this.doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, content);
    });
  }

  onUpdate(callback: (update: Uint8Array) => void): () => void {
    const handler = (update: Uint8Array, origin: unknown) => {
      if (origin !== this) {
        callback(update);
      }
    };
    this.doc.on('update', handler);
    return () => this.doc.off('update', handler);
  }

  getConnectedUsers(): Map<number, Record<string, unknown>> {
    const users = new Map<number, Record<string, unknown>>();
    for (const [clientId, state] of this.awareness.getStates()) {
      if (state && typeof state === 'object') {
        users.set(clientId, state as Record<string, unknown>);
      }
    }
    return users;
  }

  waitForSync(timeoutMs = 5000): Promise<void> {
    if (this.synced) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        this.off('sync', handler);
        if (this.pendingSyncAbort === abort) this.pendingSyncAbort = null;
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Sync timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const handler = (isSynced: unknown) => {
        if (isSynced) {
          cleanup();
          resolve();
        }
      };

      const abort = () => {
        cleanup();
        reject(new Error('Client destroyed while waiting for sync'));
      };

      this.pendingSyncAbort = abort;
      this.on('sync', handler);
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.pendingSyncAbort?.();
    this.awareness.off('update', this.awarenessUpdateHandler);
    this.disconnect();
    this.awareness.destroy();
    this.doc.destroy();
    super.destroy();
  }

  private buildWebSocketUrl(): string {
    const params = new URLSearchParams({
      name: this.identity.name,
      color: this.identity.color,
      type: 'agent',
      agentModel: this.identity.model,
    });
    if (this.authToken) {
      params.set('token', this.authToken);
    }
    return `${this.serverUrl}/ws/collab/${this.documentId}?${params.toString()}`;
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.emit('status', [{ status: 'connected' }]);

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.ws?.send(encoding.toUint8Array(encoder));

    this.awareness.setLocalState({
      name: this.identity.name,
      color: this.identity.color,
      type: 'agent',
      agentModel: this.identity.model,
    });

    const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
      this.doc.clientID,
    ]);
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(awarenessEncoder, awarenessUpdate);
    this.ws?.send(encoding.toUint8Array(awarenessEncoder));

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
  }

  private handleMessage(data: Buffer | ArrayBuffer | Buffer[]): void {
    const uint8 =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : Array.isArray(data)
          ? new Uint8Array(Buffer.concat(data))
          : new Uint8Array(data);

    const decoder = decoding.createDecoder(uint8);
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

      if (syncMessageType === 1 && !this.synced) {
        this.synced = true;
      }
      this.emit('sync', [true]);
    } else if (messageType === MESSAGE_AWARENESS) {
      const update = decoding.readVarUint8Array(decoder);
      awarenessProtocol.applyAwarenessUpdate(this.awareness, update, 'remote');
      this.emit('awareness', [this.getConnectedUsers()]);
    }
  }

  private handleClose(): void {
    if (this.updateHandler) {
      this.doc.off('update', this.updateHandler);
      this.updateHandler = null;
    }
    this.ws = null;
    this.synced = false;
    this.emit('sync', [false]);
    this.emit('status', [{ status: 'disconnected' }]);

    if (this.autoReconnect && !this.destroyed) {
      this.scheduleReconnect();
    }
  }

  private handleError(err: Error): void {
    this.emit('error', [err]);
    this.ws?.close();
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
}
