/**
 * McpClient integration tests (Stage 0, PR-0.1).
 *
 * Exercises the client against a real MCP Server using InMemoryTransport —
 * every request/response traverses the full SDK stack (validation, schemas,
 * notification routing) without subprocess overhead. No flaky piping, no
 * spawn timeouts, just wire-protocol coverage.
 */

import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { McpCapabilityError, McpClient, McpNotConnectedError } from '../src/client.js';
import {
  createResourcesPromptsFixture,
  type FixtureServer,
} from './fixtures/resources-prompts-server.js';

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

async function connectedFixture(): Promise<{ fixture: FixtureServer; client: McpClient }> {
  const fixture = createResourcesPromptsFixture();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await fixture.server.connect(serverTransport);

  const client = new McpClient({
    clientInfo: { name: 'mcp-client-integration-test', version: '0.0.1' },
    transport: { kind: 'custom', transport: clientTransport },
  });
  await client.connect();

  return { fixture, client };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('McpClient lifecycle', () => {
  let client: McpClient | undefined;

  afterEach(async () => {
    if (client) {
      await client.close();
      client = undefined;
    }
  });

  it('negotiates capabilities on connect', async () => {
    const harness = await connectedFixture();
    client = harness.client;

    const caps = client.getServerCapabilities();
    expect(caps).toBeDefined();
    expect(caps?.resources).toMatchObject({ subscribe: true, listChanged: true });
    expect(caps?.prompts).toMatchObject({ listChanged: true });
  });

  it('connect() is idempotent', async () => {
    const harness = await connectedFixture();
    client = harness.client;

    // Second connect is a no-op; it must not re-initialize or throw.
    await client.connect();
    expect(client.getServerCapabilities()).toBeDefined();
  });

  it('close() is idempotent', async () => {
    const harness = await connectedFixture();
    client = harness.client;
    await client.close();
    await client.close(); // second close does not throw
    client = undefined;
  });

  it('methods before connect throw McpNotConnectedError', async () => {
    const unconnected = new McpClient({
      clientInfo: { name: 't', version: '0' },
      transport: { kind: 'custom', transport: InMemoryTransport.createLinkedPair()[0] },
    });

    await expect(unconnected.listResources()).rejects.toBeInstanceOf(McpNotConnectedError);
    await expect(unconnected.listPrompts()).rejects.toBeInstanceOf(McpNotConnectedError);
    await expect(unconnected.readResource('mem://doc/alpha')).rejects.toBeInstanceOf(
      McpNotConnectedError,
    );
  });
});

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

describe('McpClient resources', () => {
  let client: McpClient;
  let fixture: FixtureServer;

  beforeEach(async () => {
    const harness = await connectedFixture();
    client = harness.client;
    fixture = harness.fixture;
  });

  afterEach(async () => {
    await client.close();
  });

  it('lists the fixture resources', async () => {
    const resources = await client.listResources();
    expect(resources).toHaveLength(2);
    expect(resources.map((r) => r.uri).sort()).toEqual(['mem://doc/alpha', 'mem://doc/beta']);
  });

  it('reads a known resource', async () => {
    const contents = await client.readResource('mem://doc/alpha');
    expect(contents).toHaveLength(1);
    expect(contents[0]?.uri).toBe('mem://doc/alpha');
    expect(contents[0]?.mimeType).toBe('text/plain');
    expect(contents[0]?.text).toBe('Contents of alpha');
  });

  it('rejects an unknown resource URI', async () => {
    await expect(client.readResource('mem://doc/does-not-exist')).rejects.toThrow();
  });

  it('subscribes and fans updates out to handlers', async () => {
    const handler = vi.fn();
    const unsubscribe = await client.subscribeResource('mem://doc/alpha', handler);

    await fixture.triggerResourceUpdate('mem://doc/alpha');
    // Yield a tick so the notification makes it through InMemoryTransport.
    await Promise.resolve();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ uri: 'mem://doc/alpha' });

    await unsubscribe();

    await fixture.triggerResourceUpdate('mem://doc/alpha');
    await Promise.resolve();

    expect(handler).toHaveBeenCalledTimes(1); // no new calls after unsubscribe
  });

  it('fans to multiple subscribers on the same URI', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = await client.subscribeResource('mem://doc/beta', a);
    const unsubB = await client.subscribeResource('mem://doc/beta', b);

    await fixture.triggerResourceUpdate('mem://doc/beta');
    await Promise.resolve();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    await unsubA();

    await fixture.triggerResourceUpdate('mem://doc/beta');
    await Promise.resolve();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);

    await unsubB();
  });

  it('fires resources/list_changed to registered handlers', async () => {
    // The SDK re-fetches the resource list before invoking onChanged, so we
    // have a full client→server→client round-trip between the notification
    // and the handler firing. Poll with vi.waitFor instead of awaiting a
    // single microtask tick.
    const h1 = vi.fn();
    const h2 = vi.fn();
    const unregH1 = client.onResourcesListChanged(h1);
    client.onResourcesListChanged(h2);

    await fixture.triggerResourcesListChanged();

    await vi.waitFor(() => {
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    unregH1();
    await fixture.triggerResourcesListChanged();

    await vi.waitFor(() => {
      expect(h2).toHaveBeenCalledTimes(2);
    });
    expect(h1).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe after close does not throw', async () => {
    const handler = vi.fn();
    const unsubscribe = await client.subscribeResource('mem://doc/alpha', handler);
    await client.close();

    // After close the resource map is cleared; unsubscribe must tolerate it.
    await expect(unsubscribe()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

describe('McpClient prompts', () => {
  let client: McpClient;
  let fixture: FixtureServer;

  beforeEach(async () => {
    const harness = await connectedFixture();
    client = harness.client;
    fixture = harness.fixture;
  });

  afterEach(async () => {
    await client.close();
  });

  it('lists the fixture prompts', async () => {
    const prompts = await client.listPrompts();
    expect(prompts).toHaveLength(2);
    expect(prompts.map((p) => p.name).sort()).toEqual(['greet', 'summarize']);
  });

  it('gets a prompt with arguments', async () => {
    const result = await client.getPrompt('greet', { who: 'Joshua' });
    expect(result.description).toBe('Generate a greeting');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.role).toBe('user');
    const content = result.messages[0]?.content;
    expect(content && content.type).toBe('text');
    if (content && content.type === 'text') {
      expect(content.text).toBe('Greet Joshua.');
    }
  });

  it('gets a prompt without arguments', async () => {
    const result = await client.getPrompt('greet');
    expect(result.messages).toHaveLength(1);
    const content = result.messages[0]?.content;
    if (content && content.type === 'text') {
      expect(content.text).toBe('Greet world.');
    }
  });

  it('rejects an unknown prompt name', async () => {
    await expect(client.getPrompt('nonexistent')).rejects.toThrow();
  });

  it('fires prompts/list_changed to registered handlers', async () => {
    const handler = vi.fn();
    const unregister = client.onPromptsListChanged(handler);

    await fixture.triggerPromptsListChanged();

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledTimes(1);
    });

    unregister();
    await fixture.triggerPromptsListChanged();
    // Give the SDK time to run its re-fetch; confirm our unregistered handler
    // stays at 1 call.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Capability enforcement
// ---------------------------------------------------------------------------

describe('McpClient capability enforcement', () => {
  async function connectWithCapabilities(
    capabilities: ConstructorParameters<typeof Server>[1]['capabilities'],
  ): Promise<McpClient> {
    const server = new Server({ name: 'empty-caps-fixture', version: '0.0.1' }, { capabilities });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new McpClient({
      clientInfo: { name: 'cap-test', version: '0.0.1' },
      transport: { kind: 'custom', transport: clientTransport },
    });
    await client.connect();
    return client;
  }

  it('throws McpCapabilityError when server does not advertise resources', async () => {
    const client = await connectWithCapabilities({ prompts: {} });
    try {
      const err = await client.listResources().catch((e) => e);
      expect(err).toBeInstanceOf(McpCapabilityError);
      expect((err as McpCapabilityError).capability).toBe('resources');
    } finally {
      await client.close();
    }
  });

  it('throws McpCapabilityError when server does not advertise prompts', async () => {
    const client = await connectWithCapabilities({ resources: {} });
    try {
      const err = await client.listPrompts().catch((e) => e);
      expect(err).toBeInstanceOf(McpCapabilityError);
      expect((err as McpCapabilityError).capability).toBe('prompts');
    } finally {
      await client.close();
    }
  });

  it('throws McpCapabilityError when server advertises resources but not subscribe', async () => {
    const client = await connectWithCapabilities({
      resources: {} /* no subscribe:true */,
    });
    try {
      const err = await client.subscribeResource('mem://x', () => {}).catch((e) => e);
      expect(err).toBeInstanceOf(McpCapabilityError);
      expect((err as McpCapabilityError).capability).toBe('resources.subscribe');
    } finally {
      await client.close();
    }
  });
});
