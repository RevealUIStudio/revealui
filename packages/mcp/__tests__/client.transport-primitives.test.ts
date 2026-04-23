/**
 * McpClient integration tests — transport-level primitives.
 *
 * PR-0.3 of Stage 0. Covers logging, progress, cancellation, and generic
 * notification routing. Every case uses `InMemoryTransport.createLinkedPair()`
 * for a real wire round-trip.
 */

import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ResourceListChangedNotificationSchema,
  SetLevelRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpClient, type McpClientOptions, type Progress } from '../src/client.js';

// ---------------------------------------------------------------------------
// Shared harness
// ---------------------------------------------------------------------------

const closers: Array<() => Promise<void>> = [];

async function link(
  server: Server,
  options?: Omit<McpClientOptions, 'transport' | 'clientInfo'>,
): Promise<{ server: Server; client: McpClient }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new McpClient({
    clientInfo: { name: 'transport-primitives-test', version: '0.0.1' },
    transport: { kind: 'custom', transport: clientTransport },
    ...options,
  });
  await client.connect();
  closers.push(async () => {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  });
  return { server, client };
}

afterEach(async () => {
  while (closers.length > 0) {
    const close = closers.pop();
    if (close) await close();
  }
});

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

describe('McpClient logging', () => {
  it('setLoggingLevel sends the level to the server', async () => {
    const levelSeen = vi.fn();
    const server = new Server(
      { name: 'logging-server', version: '0.0.1' },
      { capabilities: { logging: {} } },
    );
    server.setRequestHandler(SetLevelRequestSchema, async (request) => {
      levelSeen(request.params.level);
      return {};
    });

    const { client } = await link(server);
    await client.setLoggingLevel('warning');

    expect(levelSeen).toHaveBeenCalledWith('warning');
  });

  it('onLog fans server-emitted log notifications out to all subscribers', async () => {
    const server = new Server(
      { name: 'logging-emitter', version: '0.0.1' },
      { capabilities: { logging: {} } },
    );
    const { client } = await link(server);

    const a = vi.fn();
    const b = vi.fn();
    const unregA = client.onLog(a);
    client.onLog(b);

    await server.notification({
      method: 'notifications/message',
      params: { level: 'info', data: 'hello world' },
    });

    await vi.waitFor(() => {
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
    expect(a.mock.calls[0]?.[0]).toMatchObject({ level: 'info', data: 'hello world' });

    unregA();
    await server.notification({
      method: 'notifications/message',
      params: { level: 'error', data: 'only b now' },
    });

    await vi.waitFor(() => {
      expect(b).toHaveBeenCalledTimes(2);
    });
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('setLoggingLevel throws McpCapabilityError without logging capability', async () => {
    const server = new Server({ name: 'no-logging', version: '0.0.1' }, { capabilities: {} });
    const { client } = await link(server);

    await expect(client.setLoggingLevel('info')).rejects.toMatchObject({
      name: 'McpCapabilityError',
      capability: 'logging',
    });
  });
});

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

describe('McpClient progress', () => {
  it('delivers progress notifications to the onProgress callback', async () => {
    const server = new Server(
      { name: 'progress-server', version: '0.0.1' },
      { capabilities: { resources: {} } },
    );
    server.setRequestHandler(ListResourcesRequestSchema, async (_request, extra) => {
      const token = extra._meta?.progressToken;
      if (token !== undefined) {
        await extra.sendNotification({
          method: 'notifications/progress',
          params: { progressToken: token, progress: 50, total: 100 },
        });
        await extra.sendNotification({
          method: 'notifications/progress',
          params: { progressToken: token, progress: 100, total: 100 },
        });
      }
      return { resources: [] };
    });

    const { client } = await link(server);
    const progressEvents: Progress[] = [];

    await client.listResources({
      onProgress: (progress) => progressEvents.push(progress),
    });

    await vi.waitFor(() => {
      expect(progressEvents).toHaveLength(2);
    });
    expect(progressEvents[0]).toMatchObject({ progress: 50, total: 100 });
    expect(progressEvents[1]).toMatchObject({ progress: 100, total: 100 });
  });
});

// ---------------------------------------------------------------------------
// Cancellation (AbortSignal)
// ---------------------------------------------------------------------------

describe('McpClient cancellation', () => {
  it('aborts an in-flight request when the AbortSignal fires', async () => {
    const server = new Server(
      { name: 'slow-server', version: '0.0.1' },
      { capabilities: { resources: {} } },
    );

    server.setRequestHandler(ListResourcesRequestSchema, async (_request, extra) => {
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          extra.signal.removeEventListener('abort', onAbort);
          reject(new Error('server saw abort'));
        };
        if (extra.signal.aborted) {
          onAbort();
          return;
        }
        extra.signal.addEventListener('abort', onAbort);
      });
      return { resources: [] };
    });

    const { client } = await link(server);

    const controller = new AbortController();
    const inflight = client.listResources({ signal: controller.signal });

    setTimeout(() => controller.abort('user cancel'), 10);

    await expect(inflight).rejects.toThrow();
  });

  it('rejects immediately with a pre-aborted signal', async () => {
    const server = new Server(
      { name: 'would-work', version: '0.0.1' },
      { capabilities: { resources: {} } },
    );
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));

    const { client } = await link(server);

    const controller = new AbortController();
    controller.abort('already dead');

    await expect(client.listResources({ signal: controller.signal })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Generic on() subscription
// ---------------------------------------------------------------------------

describe('McpClient.on() generic notification subscription', () => {
  it('routes server notifications to all registered handlers', async () => {
    const server = new Server(
      { name: 'notify-server', version: '0.0.1' },
      { capabilities: { resources: { listChanged: true } } },
    );
    const { client } = await link(server);

    const a = vi.fn();
    const b = vi.fn();
    const unregA = client.on(ResourceListChangedNotificationSchema, a);
    client.on(ResourceListChangedNotificationSchema, b);

    await server.notification({ method: 'notifications/resources/list_changed' });

    await vi.waitFor(() => {
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    unregA();
    await server.notification({ method: 'notifications/resources/list_changed' });

    await vi.waitFor(() => {
      expect(b).toHaveBeenCalledTimes(2);
    });
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('does not interfere with subscribeResource resource-update fan-out', async () => {
    const server = new Server(
      { name: 'res-server', version: '0.0.1' },
      { capabilities: { resources: { subscribe: true, listChanged: true } } },
    );
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
    // Accept subscribe / unsubscribe no-ops; see ../fixtures/resources-prompts-server.ts.
    const { SubscribeRequestSchema, UnsubscribeRequestSchema } = await import(
      '@modelcontextprotocol/sdk/types.js'
    );
    server.setRequestHandler(SubscribeRequestSchema, async () => ({}));
    server.setRequestHandler(UnsubscribeRequestSchema, async () => ({}));

    const { client } = await link(server);

    const subscribed = vi.fn();
    const unsub = await client.subscribeResource('mem://doc/x', subscribed);

    // Separately subscribe via the generic API to the same schema. Both
    // should fire on a resource-updated notification.
    const { ResourceUpdatedNotificationSchema } = await import(
      '@modelcontextprotocol/sdk/types.js'
    );
    const generic = vi.fn();
    client.on(ResourceUpdatedNotificationSchema, generic);

    await server.notification({
      method: 'notifications/resources/updated',
      params: { uri: 'mem://doc/x' },
    });

    await vi.waitFor(() => {
      expect(subscribed).toHaveBeenCalledTimes(1);
      expect(generic).toHaveBeenCalledTimes(1);
    });

    await unsub();
  });
});
