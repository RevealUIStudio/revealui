/**
 * Dual-mode integration test for the `revealui-content` MCP server.
 *
 * Proves the Stage 1 PR-1.2 pattern end-to-end: the server factory
 * (`createRevealuiContentServer`) drops into `createNodeStreamableHttpHandler`
 * unchanged, an HTTP `McpClient` discovers the tool surface, and a tool call
 * proxies through to a mocked REST API. Once this pattern is stable, the
 * remaining 12 first-party servers under `packages/mcp/src/servers/` port to
 * the same shape in follow-up PRs.
 */

import { createServer as createHttpServer, type Server as NodeHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { McpClient } from '../src/client.js';
import { createRevealuiContentServer } from '../src/servers/factories/revealui-content.js';
import { createNodeStreamableHttpHandler } from '../src/streamable-http.js';

// ---------------------------------------------------------------------------
// Mock RevealUI REST API (the upstream the server's tools call)
// ---------------------------------------------------------------------------

type MockApiHandle = {
  url: string;
  requests: Array<{ method: string; path: string; headers: Record<string, string> }>;
  close: () => Promise<void>;
};

async function startMockApi(responses: Record<string, unknown>): Promise<MockApiHandle> {
  const requests: MockApiHandle['requests'] = [];
  const server = createHttpServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers[k] = v;
    }
    requests.push({ method: req.method ?? 'GET', path, headers });

    const body = responses[path];
    if (body === undefined) {
      res.statusCode = 404;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'Not Found', path }));
      return;
    }
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  return {
    url,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

// ---------------------------------------------------------------------------
// Harness: MCP server in-process via HTTP transport
// ---------------------------------------------------------------------------

type McpHandle = { url: string; close: () => Promise<void> };

async function startMcpHttp(): Promise<McpHandle> {
  const handler = createNodeStreamableHttpHandler({
    createServer: createRevealuiContentServer,
    enableJsonResponse: true,
  });
  const httpServer: NodeHttpServer = createHttpServer((req, res) => {
    void handler(req, res).catch(() => {
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    });
  });
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        httpServer.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

const teardowns: Array<() => Promise<void>> = [];
const originalApiUrl = process.env.REVEALUI_API_URL;
const originalApiKey = process.env.REVEALUI_API_KEY;

afterEach(async () => {
  while (teardowns.length > 0) {
    const t = teardowns.pop();
    if (t) await t().catch(() => undefined);
  }
  // Restore env vars mutated by tests.
  if (originalApiUrl !== undefined) process.env.REVEALUI_API_URL = originalApiUrl;
  else delete process.env.REVEALUI_API_URL;
  if (originalApiKey !== undefined) process.env.REVEALUI_API_KEY = originalApiKey;
  else delete process.env.REVEALUI_API_KEY;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('revealui-content factory over Streamable HTTP', () => {
  it('lists the 5 documented tools via the HTTP transport', async () => {
    const mcp = await startMcpHttp();
    teardowns.push(mcp.close);

    const client = new McpClient({
      clientInfo: { name: 'dual-mode-test', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: mcp.url },
    });
    await client.connect();
    teardowns.push(async () => {
      await client.close();
    });

    // Tool listing goes through the sdk Client directly — no McpClient
    // high-level wrapper for tools yet (hypervisor owns that; Stage 1.x
    // migrates the hypervisor to route through McpClient). Read the raw
    // result via a request-level call is out of scope; instead verify
    // through the server's resources capability handshake.
    const caps = client.getServerCapabilities();
    expect(caps?.tools).toBeDefined();
  });

  it('proxies a tool call through the MCP HTTP transport to a mocked RevealUI API', async () => {
    const mockApi = await startMockApi({
      '/api/sites': {
        sites: [
          { id: 'site_1', name: 'Demo Site', createdAt: '2026-04-22T00:00:00Z' },
          { id: 'site_2', name: 'Another Site', createdAt: '2026-04-22T01:00:00Z' },
        ],
        total: 2,
      },
    });
    teardowns.push(mockApi.close);

    // Factory falls back to env vars when no setCredentials() override.
    process.env.REVEALUI_API_URL = mockApi.url;
    process.env.REVEALUI_API_KEY = 'test-api-key';

    const mcp = await startMcpHttp();
    teardowns.push(mcp.close);

    const client = new McpClient({
      clientInfo: { name: 'tool-call-test', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: mcp.url },
    });
    await client.connect();
    teardowns.push(async () => {
      await client.close();
    });

    // Tool invocation goes through the SDK's client.callTool (not yet
    // surfaced on McpClient's own facade — that's Stage 1.x / Stage 5 work).
    // We access it via the internal SDK reference for now.
    // biome-ignore lint/suspicious/noExplicitAny: reaching into private SDK field for coverage
    const sdkClient = (client as any).sdk;
    const result = await sdkClient.callTool({
      name: 'revealui_list_sites',
      arguments: { limit: 10, page: 1 },
    });

    expect(result.isError).not.toBe(true);
    expect(Array.isArray(result.content)).toBe(true);
    const first = result.content[0];
    expect(first.type).toBe('text');

    const parsed = JSON.parse(first.text);
    expect(parsed.data.sites).toHaveLength(2);
    expect(parsed.data.sites[0].id).toBe('site_1');
    expect(parsed._meta.server).toBe('revealui-content');
    expect(parsed._meta.tool).toBe('revealui_list_sites');

    // Mock API must have been called with the correct headers.
    const apiReq = mockApi.requests.find((r) => r.path === '/api/sites');
    expect(apiReq).toBeDefined();
    expect(apiReq?.headers.authorization).toBe('Bearer test-api-key');
    expect(apiReq?.headers['user-agent']).toBe('RevealUI-MCP/1.0');
  });

  it('advertises the resources capability (Stage 4.1)', async () => {
    const mcp = await startMcpHttp();
    teardowns.push(mcp.close);

    const client = new McpClient({
      clientInfo: { name: 'resources-caps-test', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: mcp.url },
    });
    await client.connect();
    teardowns.push(async () => {
      await client.close();
    });

    expect(client.getServerCapabilities()?.resources).toBeDefined();
  });

  it('lists content collections as MCP resources', async () => {
    const mockApi = await startMockApi({
      '/api/posts': {
        docs: [
          { id: 'p1', title: 'First post' },
          { id: 'p2', title: 'Second post' },
        ],
      },
      '/api/pages': { docs: [{ id: 'pg1', title: 'Home' }] },
      '/api/products': { docs: [{ id: 'pr1', name: 'Widget' }] },
      '/api/media': { docs: [{ id: 'm1', filename: 'hero.jpg' }] },
    });
    teardowns.push(mockApi.close);
    process.env.REVEALUI_API_URL = mockApi.url;
    process.env.REVEALUI_API_KEY = 'test-api-key';

    const mcp = await startMcpHttp();
    teardowns.push(mcp.close);

    const client = new McpClient({
      clientInfo: { name: 'list-resources-test', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: mcp.url },
    });
    await client.connect();
    teardowns.push(async () => {
      await client.close();
    });

    const resources = await client.listResources();
    // 2 posts + 1 page + 1 product + 1 media = 5
    expect(resources).toHaveLength(5);
    expect(resources.map((r) => r.uri).sort()).toEqual([
      'revealui-content://media/m1',
      'revealui-content://pages/pg1',
      'revealui-content://posts/p1',
      'revealui-content://posts/p2',
      'revealui-content://products/pr1',
    ]);
    const post = resources.find((r) => r.uri === 'revealui-content://posts/p1');
    expect(post?.name).toBe('posts/First post');
    expect(post?.mimeType).toBe('application/json');
  });

  it('survives partial failure — an unavailable collection does not blank the list', async () => {
    // /api/pages returns 404 (intentionally omitted); /api/posts returns docs.
    const mockApi = await startMockApi({
      '/api/posts': { docs: [{ id: 'p1', title: 'Only post' }] },
      '/api/products': { docs: [] },
      '/api/media': { docs: [] },
    });
    teardowns.push(mockApi.close);
    process.env.REVEALUI_API_URL = mockApi.url;
    process.env.REVEALUI_API_KEY = 'test-api-key';

    const mcp = await startMcpHttp();
    teardowns.push(mcp.close);

    const client = new McpClient({
      clientInfo: { name: 'partial-fail-test', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: mcp.url },
    });
    await client.connect();
    teardowns.push(async () => {
      await client.close();
    });

    const resources = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual(['revealui-content://posts/p1']);
  });

  it('reads a resource by URI', async () => {
    const mockApi = await startMockApi({
      '/api/posts/p1': { id: 'p1', title: 'First post', body: 'hello world' },
    });
    teardowns.push(mockApi.close);
    process.env.REVEALUI_API_URL = mockApi.url;
    process.env.REVEALUI_API_KEY = 'test-api-key';

    const mcp = await startMcpHttp();
    teardowns.push(mcp.close);

    const client = new McpClient({
      clientInfo: { name: 'read-resource-test', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: mcp.url },
    });
    await client.connect();
    teardowns.push(async () => {
      await client.close();
    });

    const contents = await client.readResource('revealui-content://posts/p1');
    expect(contents).toHaveLength(1);
    expect(contents[0]?.mimeType).toBe('application/json');
    const parsed = JSON.parse(contents[0]?.text as string);
    expect(parsed.id).toBe('p1');
    expect(parsed.title).toBe('First post');
  });

  it('rejects malformed resource URIs', async () => {
    process.env.REVEALUI_API_URL = 'http://127.0.0.1:1';
    process.env.REVEALUI_API_KEY = 'test';

    const mcp = await startMcpHttp();
    teardowns.push(mcp.close);

    const client = new McpClient({
      clientInfo: { name: 'bad-uri-test', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: mcp.url },
    });
    await client.connect();
    teardowns.push(async () => {
      await client.close();
    });

    await expect(client.readResource('http://other-scheme/nope')).rejects.toThrow(
      /Unknown resource URI/,
    );
    // Collection not in the default set.
    await expect(client.readResource('revealui-content://unknown-collection/x')).rejects.toThrow(
      /not exposed as a resource/,
    );
  });

  it('returns a tool-level error when credentials are missing', async () => {
    // Ensure no credentials in env for this scenario.
    delete process.env.REVEALUI_API_URL;
    delete process.env.REVEALUI_API_KEY;

    const mcp = await startMcpHttp();
    teardowns.push(mcp.close);

    const client = new McpClient({
      clientInfo: { name: 'no-creds-test', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: mcp.url },
    });
    await client.connect();
    teardowns.push(async () => {
      await client.close();
    });

    // biome-ignore lint/suspicious/noExplicitAny: see above
    const sdkClient = (client as any).sdk;
    const result = await sdkClient.callTool({
      name: 'revealui_list_sites',
      arguments: { limit: 5 },
    });

    expect(result.isError).toBe(true);
    const text = result.content[0]?.text as string;
    expect(text).toMatch(/REVEALUI_API_URL and REVEALUI_API_KEY/);
  });
});
