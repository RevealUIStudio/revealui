/**
 * McpClient integration tests — server-initiated primitives.
 *
 * PR-0.2 of Stage 0. Covers sampling, elicitation, roots, and completions.
 * Each test spins up a minimal SDK `Server` tailored to the primitive under
 * test, wires it to a fresh `McpClient` via `InMemoryTransport.createLinkedPair()`,
 * and asserts round-trip behaviour.
 */

import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CompleteRequestSchema,
  RootsListChangedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type CompletionReference,
  type CreateMessageRequest,
  type ElicitRequest,
  McpCapabilityError,
  McpClient,
  type McpClientOptions,
  type Root,
} from '../src/client.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

type Harness = { server: Server; client: McpClient };

const closers: Array<() => Promise<void>> = [];

async function linkClient(
  server: Server,
  options: Omit<McpClientOptions, 'transport'>,
): Promise<Harness> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new McpClient({
    ...options,
    transport: { kind: 'custom', transport: clientTransport },
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
// Sampling
// ---------------------------------------------------------------------------

describe('McpClient sampling', () => {
  it('routes createMessage requests from the server to the handler', async () => {
    const samplingHandler = vi.fn(async (_params: CreateMessageRequest['params']) => ({
      role: 'assistant' as const,
      content: { type: 'text' as const, text: 'hello from handler' },
      model: 'test-model',
    }));

    const server = new Server({ name: 'sampling-caller', version: '0.0.1' }, { capabilities: {} });
    const { client: _client } = await linkClient(server, {
      clientInfo: { name: 'sampling-test-client', version: '0.0.1' },
      samplingHandler,
    });

    const result = await server.createMessage({
      messages: [{ role: 'user', content: { type: 'text', text: 'hi' } }],
      maxTokens: 128,
    });

    expect(samplingHandler).toHaveBeenCalledTimes(1);
    expect(samplingHandler.mock.calls[0]?.[0].messages[0]?.content).toEqual({
      type: 'text',
      text: 'hi',
    });
    expect(result.model).toBe('test-model');
    expect(result.content).toEqual({ type: 'text', text: 'hello from handler' });
  });

  it('propagates handler errors back to the server', async () => {
    const server = new Server({ name: 'sampling-caller', version: '0.0.1' }, { capabilities: {} });
    await linkClient(server, {
      clientInfo: { name: 'err-client', version: '0.0.1' },
      samplingHandler: async () => {
        throw new Error('handler rejected');
      },
    });

    await expect(
      server.createMessage({
        messages: [{ role: 'user', content: { type: 'text', text: 'x' } }],
        maxTokens: 8,
      }),
    ).rejects.toThrow(/handler rejected/);
  });

  it('does not advertise sampling when no handler is provided', async () => {
    const server = new Server({ name: 'caps-inspector', version: '0.0.1' }, { capabilities: {} });

    // Peek at advertised client capabilities from the server side by reading
    // after connect. The SDK Server stores getClientCapabilities().
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new McpClient({
      clientInfo: { name: 'no-sampling', version: '0.0.1' },
      transport: { kind: 'custom', transport: clientTransport },
    });
    await client.connect();
    closers.push(async () => {
      await client.close();
      await server.close();
    });

    expect(server.getClientCapabilities()?.sampling).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Elicitation
// ---------------------------------------------------------------------------

describe('McpClient elicitation', () => {
  it('routes elicit requests from the server to the handler (accept)', async () => {
    const elicitationHandler = vi.fn(async (_params: ElicitRequest['params']) => ({
      action: 'accept' as const,
      content: { name: 'Joshua' },
    }));

    const server = new Server({ name: 'elicit-caller', version: '0.0.1' }, { capabilities: {} });
    await linkClient(server, {
      clientInfo: { name: 'elicit-test-client', version: '0.0.1' },
      elicitationHandler,
    });

    const result = await server.elicitInput({
      message: 'What is your name?',
      requestedSchema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    });

    expect(elicitationHandler).toHaveBeenCalledTimes(1);
    expect(result.action).toBe('accept');
    if (result.action === 'accept') {
      expect(result.content).toEqual({ name: 'Joshua' });
    }
  });

  it('routes elicit decline responses back to the server', async () => {
    const server = new Server({ name: 'elicit-caller', version: '0.0.1' }, { capabilities: {} });
    await linkClient(server, {
      clientInfo: { name: 'decline-client', version: '0.0.1' },
      elicitationHandler: async () => ({ action: 'decline' }),
    });

    const result = await server.elicitInput({
      message: 'Confirm?',
      requestedSchema: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
      },
    });

    expect(result.action).toBe('decline');
  });
});

// ---------------------------------------------------------------------------
// Roots
// ---------------------------------------------------------------------------

describe('McpClient roots', () => {
  const ROOT_A: Root = { uri: 'file:///workspace/a', name: 'A' };
  const ROOT_B: Root = { uri: 'file:///workspace/b', name: 'B' };

  it('responds to listRoots with the provider result', async () => {
    const rootsProvider = vi.fn(() => [ROOT_A, ROOT_B]);
    const server = new Server({ name: 'roots-caller', version: '0.0.1' }, { capabilities: {} });
    await linkClient(server, {
      clientInfo: { name: 'roots-client', version: '0.0.1' },
      rootsProvider,
    });

    const { roots } = await server.listRoots();
    expect(rootsProvider).toHaveBeenCalledTimes(1);
    expect(roots).toEqual([ROOT_A, ROOT_B]);
  });

  it('re-invokes the provider on every listRoots (no stale cache)', async () => {
    let current: Root[] = [ROOT_A];
    const rootsProvider = vi.fn(() => current);
    const server = new Server({ name: 'roots-caller', version: '0.0.1' }, { capabilities: {} });
    await linkClient(server, {
      clientInfo: { name: 'dyn-roots', version: '0.0.1' },
      rootsProvider,
    });

    const first = await server.listRoots();
    current = [ROOT_A, ROOT_B];
    const second = await server.listRoots();

    expect(first.roots).toEqual([ROOT_A]);
    expect(second.roots).toEqual([ROOT_A, ROOT_B]);
    expect(rootsProvider).toHaveBeenCalledTimes(2);
  });

  it('notifyRootsListChanged sends the notification to the server', async () => {
    const server = new Server({ name: 'roots-watcher', version: '0.0.1' }, { capabilities: {} });
    const notified = vi.fn();
    server.setNotificationHandler(RootsListChangedNotificationSchema, () => {
      notified();
    });

    const { client } = await linkClient(server, {
      clientInfo: { name: 'root-notifier', version: '0.0.1' },
      rootsProvider: () => [ROOT_A],
    });

    await client.notifyRootsListChanged();

    await vi.waitFor(() => {
      expect(notified).toHaveBeenCalledTimes(1);
    });
  });

  it('notifyRootsListChanged throws when no rootsProvider is configured', async () => {
    const server = new Server({ name: 'no-roots-server', version: '0.0.1' }, { capabilities: {} });
    const { client } = await linkClient(server, {
      clientInfo: { name: 'no-roots-client', version: '0.0.1' },
    });

    await expect(client.notifyRootsListChanged()).rejects.toThrow(/rootsProvider/);
  });
});

// ---------------------------------------------------------------------------
// Completions
// ---------------------------------------------------------------------------

describe('McpClient completions', () => {
  const REF: CompletionReference = { type: 'ref/prompt', name: 'greet' };

  async function serverWithCompletions(completionValues: string[]): Promise<Server> {
    const server = new Server(
      { name: 'completing-server', version: '0.0.1' },
      { capabilities: { completions: {} } },
    );
    server.setRequestHandler(CompleteRequestSchema, async () => ({
      completion: {
        values: completionValues,
        total: completionValues.length,
        hasMore: false,
      },
    }));
    return server;
  }

  it('returns completion values for a prompt argument', async () => {
    const server = await serverWithCompletions(['Joshua', 'Jordan', 'Joy']);
    const { client } = await linkClient(server, {
      clientInfo: { name: 'complete-client', version: '0.0.1' },
    });

    const completion = await client.complete(REF, { name: 'who', value: 'Jo' });

    expect(completion.values).toEqual(['Joshua', 'Jordan', 'Joy']);
    expect(completion.total).toBe(3);
    expect(completion.hasMore).toBe(false);
  });

  it('throws McpCapabilityError when server does not advertise completions', async () => {
    const server = new Server({ name: 'no-completions', version: '0.0.1' }, { capabilities: {} });
    const { client } = await linkClient(server, {
      clientInfo: { name: 'no-caps-client', version: '0.0.1' },
    });

    const err = await client.complete(REF, { name: 'x', value: '' }).catch((e) => e);
    expect(err).toBeInstanceOf(McpCapabilityError);
    expect((err as McpCapabilityError).capability).toBe('completions');
  });
});
