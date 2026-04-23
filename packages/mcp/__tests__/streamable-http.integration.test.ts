/**
 * Streamable HTTP integration tests (Stage 1 PR-1.1).
 *
 * Exercises the full wire protocol: `McpClient` with the `streamable-http`
 * transport hitting a real `http.createServer` instance running the
 * `createNodeStreamableHttpHandler` helper. Sessions allocated + routed via
 * the external Map, Initialize → resources round-trip, isolated session
 * state verified across concurrent clients.
 */

import { createServer as createHttpServer, type Server as NodeHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { McpClient } from '../src/client.js';
import { createNodeStreamableHttpHandler } from '../src/streamable-http.js';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type RunningServer = {
  url: string;
  close(): Promise<void>;
};

const teardowns: Array<() => Promise<void>> = [];

async function startServer(
  mkServer: () => McpServer,
  options?: { enableJsonResponse?: boolean },
): Promise<RunningServer> {
  const handler = createNodeStreamableHttpHandler({
    createServer: mkServer,
    enableJsonResponse: options?.enableJsonResponse,
  });
  const httpServer: NodeHttpServer = createHttpServer((req, res) => {
    void handler(req, res).catch((err) => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
      }
      res.end(JSON.stringify({ error: String(err) }));
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}/`;
  const close = () =>
    new Promise<void>((resolve, reject) =>
      httpServer.close((err) => (err ? reject(err) : resolve())),
    );
  teardowns.push(close);
  return { url, close };
}

function makeResourceServer(
  resources: Array<{ uri: string; name: string; text: string }>,
): () => McpServer {
  return () => {
    const server = new McpServer(
      { name: 'streamable-http-fixture', version: '0.0.1' },
      { capabilities: { resources: {} } },
    );
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: resources.map(({ uri, name }) => ({ uri, name, mimeType: 'text/plain' })),
    }));
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const found = resources.find((r) => r.uri === request.params.uri);
      if (!found) throw new Error(`Resource not found: ${request.params.uri}`);
      return { contents: [{ uri: found.uri, mimeType: 'text/plain', text: found.text }] };
    });
    return server;
  };
}

afterEach(async () => {
  while (teardowns.length > 0) {
    const teardown = teardowns.pop();
    if (teardown) await teardown().catch(() => undefined);
  }
});

// ---------------------------------------------------------------------------
// Basic round-trip
// ---------------------------------------------------------------------------

describe('Streamable HTTP transport (basic round-trip)', () => {
  it('initializes, lists, and reads resources through real HTTP', async () => {
    const running = await startServer(
      makeResourceServer([
        { uri: 'mem://alpha', name: 'Alpha', text: 'Contents of alpha' },
        { uri: 'mem://beta', name: 'Beta', text: 'Contents of beta' },
      ]),
      { enableJsonResponse: true },
    );

    const client = new McpClient({
      clientInfo: { name: 'streamable-http-test', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: running.url },
    });
    await client.connect();

    const resources = await client.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual(['mem://alpha', 'mem://beta']);

    const contents = await client.readResource('mem://alpha');
    expect(contents).toHaveLength(1);
    expect(contents[0]?.text).toBe('Contents of alpha');

    await client.close();
  });

  it('advertises the server capabilities negotiated over HTTP', async () => {
    const running = await startServer(
      makeResourceServer([{ uri: 'mem://x', name: 'X', text: 'x' }]),
      { enableJsonResponse: true },
    );

    const client = new McpClient({
      clientInfo: { name: 'caps-http', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: running.url },
    });
    await client.connect();
    expect(client.getServerCapabilities()?.resources).toBeDefined();
    await client.close();
  });
});

// ---------------------------------------------------------------------------
// Session isolation
// ---------------------------------------------------------------------------

describe('Streamable HTTP transport (session isolation)', () => {
  it('allocates independent session state per concurrent client', async () => {
    // Each new server instance sees its own resources-list — shared across
    // clients only via the handler's session map, not across sessions.
    const seenClients: string[] = [];
    const createServer = () => {
      const id = `session-${seenClients.length}`;
      seenClients.push(id);
      const server = new McpServer(
        { name: 'per-session', version: '0.0.1' },
        { capabilities: { resources: {} } },
      );
      server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: [{ uri: `mem://${id}`, name: id, mimeType: 'text/plain' }],
      }));
      server.setRequestHandler(ReadResourceRequestSchema, async () => ({
        contents: [],
      }));
      return server;
    };

    const running = await startServer(createServer, { enableJsonResponse: true });

    const clientA = new McpClient({
      clientInfo: { name: 'A', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: running.url },
    });
    const clientB = new McpClient({
      clientInfo: { name: 'B', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: running.url },
    });

    await Promise.all([clientA.connect(), clientB.connect()]);

    const [aRes, bRes] = await Promise.all([clientA.listResources(), clientB.listResources()]);

    // Each client got its own session, so the per-session `id` differs.
    expect(aRes).toHaveLength(1);
    expect(bRes).toHaveLength(1);
    expect(aRes[0]?.uri).not.toBe(bRes[0]?.uri);
    expect(seenClients).toHaveLength(2);

    await Promise.all([clientA.close(), clientB.close()]);
  });
});

// ---------------------------------------------------------------------------
// Session lifecycle callbacks
// ---------------------------------------------------------------------------

describe('Streamable HTTP transport (session lifecycle)', () => {
  it('fires onSessionInitialized when a new session is created', async () => {
    const opened: string[] = [];

    const handler = createNodeStreamableHttpHandler({
      createServer: makeResourceServer([]),
      enableJsonResponse: true,
      onSessionInitialized: (id) => {
        opened.push(id);
      },
    });

    const httpServer = createHttpServer((req, res) => {
      void handler(req, res).catch(() => res.end());
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = httpServer.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}/`;
    teardowns.push(
      () =>
        new Promise<void>((resolve, reject) =>
          httpServer.close((err) => (err ? reject(err) : resolve())),
        ),
    );

    const client = new McpClient({
      clientInfo: { name: 'lifecycle', version: '0.0.1' },
      transport: { kind: 'streamable-http', url },
    });
    await client.connect();
    // Exercise the session once so the server fully initializes.
    await client.listResources();

    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatch(/[0-9a-f-]{36}/i);

    await client.close();
  });
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

describe('Streamable HTTP transport (error paths)', () => {
  it('rejects non-initialize POST without a session header', async () => {
    const running = await startServer(makeResourceServer([]), { enableJsonResponse: true });

    const res = await fetch(running.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list',
        params: {},
      }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: { message?: string } };
    expect(json.error?.message).toBe('Session ID required');
  });

  it('rejects POST with an unknown session header', async () => {
    const running = await startServer(makeResourceServer([]), { enableJsonResponse: true });

    const res = await fetch(running.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'mcp-session-id': 'not-a-real-session',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list',
        params: {},
      }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: { message?: string } };
    expect(json.error?.message).toBe('Unknown session ID');
  });
});
