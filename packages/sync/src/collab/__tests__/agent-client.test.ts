import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { AgentCollabClientOptions, AgentIdentity } from '../agent-client.js';

type WsEventHandler = (...args: unknown[]) => void;

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  private listeners = new Map<string, WsEventHandler[]>();

  constructor(url: string) {
    this.url = url;
  }

  on = vi.fn((event: string, handler: WsEventHandler) => {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
    return this;
  });

  removeAllListeners = vi.fn(() => {
    this.listeners.clear();
    return this;
  });

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event) ?? [];
    for (const handler of handlers) {
      handler(...args);
    }
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit('open');
  }

  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close');
  }

  simulateError(err: Error): void {
    this.emit('error', err);
  }
}

vi.mock('ws', () => ({
  default: MockWebSocket,
}));

const defaultIdentity: AgentIdentity = {
  type: 'agent',
  name: 'test-agent',
  model: 'claude-opus-4-6',
  color: '#61AFEF',
};

let AgentCollabClient: typeof AgentCollabClientType;

function createClient(overrides?: Partial<AgentCollabClientOptions>) {
  const options: AgentCollabClientOptions = {
    serverUrl: 'ws://localhost:3004',
    documentId: 'doc-123',
    identity: defaultIdentity,
    ...overrides,
  };

  return new AgentCollabClient(options);
}

function getLatestMockWs(client: { connect: () => void }): MockWebSocket {
  return (client as unknown as { ws: MockWebSocket }).ws;
}

describe('AgentCollabClient', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    const mod = await import('../agent-client.js');
    AgentCollabClient = mod.AgentCollabClient;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should create client with Y.Doc and awareness', () => {
    const client = new AgentCollabClient({
      serverUrl: 'ws://localhost:3004',
      documentId: 'doc-123',
      identity: defaultIdentity,
    });

    expect(client.doc).toBeInstanceOf(Y.Doc);
    expect(client.awareness).toBeDefined();
    expect(client.awareness.doc).toBe(client.doc);

    client.destroy();
  });

  it('should build WebSocket URL with identity query params', () => {
    const client = createClient();
    client.connect();

    const ws = getLatestMockWs(client);
    expect(ws.url).toContain('ws://localhost:3004/ws/collab/doc-123');
    expect(ws.url).toContain('name=test-agent');
    expect(ws.url).toContain('color=%2361AFEF');
    expect(ws.url).toContain('type=agent');
    expect(ws.url).toContain('agentModel=claude-opus-4-6');

    client.destroy();
  });

  it('should build WebSocket URL with authToken', () => {
    const client = createClient({ authToken: 'secret-token-123' });
    client.connect();

    const ws = getLatestMockWs(client);
    expect(ws.url).toContain('token=secret-token-123');

    client.destroy();
  });

  it('should emit connecting then connected on connect', () => {
    const client = createClient();
    const events: string[] = [];

    client.on('status', (event: unknown) => {
      events.push((event as { status: string }).status);
    });

    client.connect();
    expect(events).toContain('connecting');

    const ws = getLatestMockWs(client);
    ws.simulateOpen();

    expect(events).toContain('connected');
    expect(events.indexOf('connecting')).toBeLessThan(events.indexOf('connected'));

    client.destroy();
  });

  it('should send sync step 1 on open', () => {
    const client = createClient();
    client.connect();

    const ws = getLatestMockWs(client);
    ws.simulateOpen();

    expect(ws.send).toHaveBeenCalled();

    const firstSend = ws.send.mock.calls[0]?.[0] as Uint8Array;
    expect(firstSend).toBeInstanceOf(Uint8Array);
    expect(firstSend[0]).toBe(0); // MESSAGE_SYNC = 0

    client.destroy();
  });

  it('should send awareness state on open with agent identity', () => {
    const client = createClient();
    client.connect();

    const ws = getLatestMockWs(client);
    ws.simulateOpen();

    expect(ws.send.mock.calls.length).toBeGreaterThanOrEqual(2);
    const secondSend = ws.send.mock.calls[1]?.[0] as Uint8Array;
    expect(secondSend).toBeInstanceOf(Uint8Array);
    expect(secondSend[0]).toBe(1); // MESSAGE_AWARENESS = 1

    const localState = client.awareness.getLocalState();
    expect(localState).toEqual({
      name: 'test-agent',
      color: '#61AFEF',
      type: 'agent',
      agentModel: 'claude-opus-4-6',
    });

    client.destroy();
  });

  it('should disconnect cleanly, remove awareness, and emit status', () => {
    const client = createClient();
    const events: string[] = [];

    client.on('status', (event: unknown) => {
      events.push((event as { status: string }).status);
    });

    client.connect();
    const ws = getLatestMockWs(client);
    ws.simulateOpen();

    client.disconnect();

    expect(events).toContain('disconnected');
    expect(ws.removeAllListeners).toHaveBeenCalled();
    expect(ws.close).toHaveBeenCalled();

    const localState = client.awareness.getLocalState();
    expect(localState).toBeNull();

    client.destroy();
  });

  it('should not create multiple connections', () => {
    const client = createClient();

    client.connect();
    const ws1 = getLatestMockWs(client);

    client.connect();
    const ws2 = getLatestMockWs(client);

    expect(ws1).toBe(ws2);

    client.destroy();
  });

  it('should not connect after destroy', () => {
    const client = createClient();
    client.destroy();

    client.connect();
    const ws = getLatestMockWs(client);
    expect(ws).toBeNull();
  });

  it('should return Y.Text fragment from getText()', () => {
    const client = createClient();
    const text = client.getText();

    expect(text).toBeInstanceOf(Y.Text);
    expect(text).toBe(client.doc.getText('content'));

    client.destroy();
  });

  it('should return Y.Text fragment with custom name', () => {
    const client = createClient({ defaultTextName: 'main' });
    const defaultText = client.getText();
    const namedText = client.getText('custom');

    expect(defaultText).toBe(client.doc.getText('main'));
    expect(namedText).toBe(client.doc.getText('custom'));

    client.destroy();
  });

  it('should return string content from getTextContent()', () => {
    const client = createClient();
    client.doc.getText('content').insert(0, 'hello world');
    expect(client.getTextContent()).toBe('hello world');
    client.destroy();
  });

  it('should insert text at the correct position', () => {
    const client = createClient();
    client.insertText(0, 'hello');
    client.insertText(5, ' world');
    client.insertText(5, ' beautiful');
    expect(client.getTextContent()).toBe('hello beautiful world');
    client.destroy();
  });

  it('should delete text at the correct range', () => {
    const client = createClient();
    client.insertText(0, 'hello beautiful world');
    client.deleteText(5, 10);
    expect(client.getTextContent()).toBe('hello world');
    client.destroy();
  });

  it('should atomically replace all content with replaceAll()', () => {
    const client = createClient();
    client.insertText(0, 'original content');
    client.replaceAll('replaced content');
    expect(client.getTextContent()).toBe('replaced content');
    client.destroy();
  });

  it('should register callback with onUpdate() and return unsubscribe', () => {
    const client = createClient();
    const updates: Uint8Array[] = [];

    const unsubscribe = client.onUpdate((update) => {
      updates.push(update);
    });

    client.insertText(0, 'trigger update');
    expect(updates.length).toBeGreaterThan(0);

    const countBefore = updates.length;
    unsubscribe();

    client.insertText(0, 'no callback');
    expect(updates.length).toBe(countBefore);

    client.destroy();
  });

  it('should return awareness states from getConnectedUsers()', () => {
    const client = createClient();
    client.awareness.setLocalState({
      name: 'test-agent',
      color: '#61AFEF',
      type: 'agent',
    });

    const users = client.getConnectedUsers();
    expect(users.size).toBe(1);

    const localUser = users.get(client.doc.clientID);
    expect(localUser).toEqual({
      name: 'test-agent',
      color: '#61AFEF',
      type: 'agent',
    });

    client.destroy();
  });

  it('should resolve waitForSync() when synced', async () => {
    const client = createClient();
    const syncPromise = client.waitForSync(5000);
    client.emit('sync', [true]);
    await expect(syncPromise).resolves.toBeUndefined();
    client.destroy();
  });

  it('should reject waitForSync() on timeout', async () => {
    const client = createClient();
    const syncPromise = client.waitForSync(3000);
    // Attach rejection handler before advancing timers to prevent unhandled rejection
    const assertion = expect(syncPromise).rejects.toThrow('Sync timeout after 3000ms');
    await vi.advanceTimersByTimeAsync(3001);
    await assertion;
    client.destroy();
  });

  it('should clean up all resources on destroy()', () => {
    const client = createClient();
    client.connect();
    const ws = getLatestMockWs(client);
    ws.simulateOpen();

    const docDestroySpy = vi.spyOn(client.doc, 'destroy');
    const awarenessDestroySpy = vi.spyOn(client.awareness, 'destroy');

    client.destroy();

    expect(ws.removeAllListeners).toHaveBeenCalled();
    expect(ws.close).toHaveBeenCalled();
    expect(docDestroySpy).toHaveBeenCalled();
    expect(awarenessDestroySpy).toHaveBeenCalled();
  });
});
