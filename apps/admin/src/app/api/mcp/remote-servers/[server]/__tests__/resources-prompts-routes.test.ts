/**
 * Resources + Prompts route tests (Stage 3.3).
 *
 * Four new per-server routes land in this PR:
 *   - GET  .../resources
 *   - GET  .../resource?uri=...
 *   - GET  .../prompts
 *   - POST .../get-prompt
 *
 * `buildRemoteMcpClient` is stubbed (same pattern as the tool-routes test)
 * so we can assert argument forwarding, error propagation, and transport
 * teardown without spinning up a real MCP server. Real-wire coverage lives
 * in `packages/mcp/__tests__/client.integration.test.ts`.
 */

import { McpCapabilityError } from '@revealui/mcp/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// -- Fake client ------------------------------------------------------------

class FakeMcpClient {
  connectCalls = 0;
  closeCalls = 0;
  listResourcesImpl: () => Promise<unknown[]> = async () => [];
  readResourceImpl: (uri: string) => Promise<unknown[]> = async () => [];
  listPromptsImpl: () => Promise<unknown[]> = async () => [];
  getPromptImpl: (name: string, args?: unknown) => Promise<unknown> = async () => ({
    messages: [],
  });

  async connect(): Promise<void> {
    this.connectCalls++;
  }
  async close(): Promise<void> {
    this.closeCalls++;
  }
  async listResources(): Promise<unknown[]> {
    return this.listResourcesImpl();
  }
  async readResource(uri: string): Promise<unknown[]> {
    return this.readResourceImpl(uri);
  }
  async listPrompts(): Promise<unknown[]> {
    return this.listPromptsImpl();
  }
  async getPrompt(name: string, args?: unknown): Promise<unknown> {
    return this.getPromptImpl(name, args);
  }
}

const fakeClients: FakeMcpClient[] = [];

const mockBuild = vi.fn(async (_opts: { tenant: string; server: string }) => {
  const client = new FakeMcpClient();
  fakeClients.push(client);
  return { client, meta: { serverUrl: 'http://remote.test/mcp' } };
});

vi.mock('@/lib/mcp/remote-server-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mcp/remote-server-client')>(
    '@/lib/mcp/remote-server-client',
  );
  return {
    ...actual,
    buildRemoteMcpClient: (opts: { tenant: string; server: string }) => mockBuild(opts),
  };
});

const mockGetSession = vi.fn();
vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/lib/utils/request-context', () => ({
  extractRequestContext: () => ({ userAgent: undefined, ipAddress: undefined }),
}));

function makeRequest(url: string, init?: RequestInit): Request {
  return new Request(url, {
    headers: { cookie: 'session=test' },
    ...init,
  });
}

beforeEach(() => {
  mockGetSession.mockReset();
  mockBuild.mockClear();
  fakeClients.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /resources
// ---------------------------------------------------------------------------

describe('GET /api/mcp/remote-servers/[server]/resources', () => {
  it('returns 401 without a session', async () => {
    mockGetSession.mockResolvedValue(null);
    const { GET } = await import('../resources/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/resources?tenant=acme') as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when tenant is missing', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { GET } = await import('../resources/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/resources') as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 412 when the server does not advertise the resources capability', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.listResourcesImpl = async () => {
        throw new McpCapabilityError('resources');
      };
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });
    const { GET } = await import('../resources/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/resources?tenant=acme') as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(412);
    expect(fakeClients[0]?.closeCalls).toBe(1);
  });

  it('connects, lists resources, and closes the transport', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.listResourcesImpl = async () => [
        { uri: 'revealui://acme/posts/1', name: 'First post' },
      ];
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });
    const { GET } = await import('../resources/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/resources?tenant=acme') as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { resources: Array<{ uri: string }> };
    expect(body.resources).toHaveLength(1);
    expect(body.resources[0]?.uri).toBe('revealui://acme/posts/1');
    expect(fakeClients[0]?.connectCalls).toBe(1);
    expect(fakeClients[0]?.closeCalls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /resource?uri=...
// ---------------------------------------------------------------------------

describe('GET /api/mcp/remote-servers/[server]/resource', () => {
  it('returns 400 when uri is missing', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { GET } = await import('../resource/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/resource?tenant=acme') as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(400);
  });

  it('forwards uri to readResource and returns contents', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    let observedUri: string | undefined;
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.readResourceImpl = async (uri) => {
        observedUri = uri;
        return [{ uri, mimeType: 'text/plain', text: 'hello from post' }];
      };
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });
    const uri = 'revealui://acme/posts/1';
    const { GET } = await import('../resource/route.js');
    const res = await GET(
      makeRequest(
        `http://admin.test/api/mcp/remote-servers/linear/resource?tenant=acme&uri=${encodeURIComponent(uri)}`,
      ) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      contents: Array<{ uri: string; text: string; mimeType: string }>;
    };
    expect(observedUri).toBe(uri);
    expect(body.contents[0]?.text).toBe('hello from post');
    expect(fakeClients[0]?.closeCalls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /prompts
// ---------------------------------------------------------------------------

describe('GET /api/mcp/remote-servers/[server]/prompts', () => {
  it('connects, lists prompts, and closes the transport', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.listPromptsImpl = async () => [
        {
          name: 'summarize',
          description: 'Summarize a topic',
          arguments: [{ name: 'topic', required: true }],
        },
      ];
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });
    const { GET } = await import('../prompts/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/prompts?tenant=acme') as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { prompts: Array<{ name: string }> };
    expect(body.prompts.map((p) => p.name)).toEqual(['summarize']);
    expect(fakeClients[0]?.closeCalls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /get-prompt
// ---------------------------------------------------------------------------

describe('POST /api/mcp/remote-servers/[server]/get-prompt', () => {
  it('returns 400 when body.name is missing', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../get-prompt/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/get-prompt', {
        method: 'POST',
        body: JSON.stringify({ tenant: 'acme' }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(400);
  });

  it('rejects non-string argument values (MCP prompt args are string-valued)', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../get-prompt/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/get-prompt', {
        method: 'POST',
        body: JSON.stringify({
          tenant: 'acme',
          name: 'summarize',
          arguments: { topic: 42 },
        }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(400);
  });

  it('forwards name + arguments and returns the GetPromptResult', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    let observedName: string | undefined;
    let observedArgs: unknown;
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.getPromptImpl = async (name, args) => {
        observedName = name;
        observedArgs = args;
        return {
          description: 'resolved',
          messages: [
            {
              role: 'user' as const,
              content: { type: 'text', text: 'hello' },
            },
          ],
        };
      };
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });
    const { POST } = await import('../get-prompt/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/get-prompt', {
        method: 'POST',
        body: JSON.stringify({
          tenant: 'acme',
          name: 'summarize',
          arguments: { topic: 'OAuth 2.1' },
        }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { messages: Array<{ content: { text: string } }> };
    };
    expect(observedName).toBe('summarize');
    expect(observedArgs).toEqual({ topic: 'OAuth 2.1' });
    expect(body.result.messages[0]?.content.text).toBe('hello');
    expect(fakeClients[0]?.closeCalls).toBe(1);
  });

  it('accepts get-prompt with no arguments', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    let observedArgs: unknown = 'not-seen';
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.getPromptImpl = async (_name, args) => {
        observedArgs = args;
        return { messages: [] };
      };
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });
    const { POST } = await import('../get-prompt/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/get-prompt', {
        method: 'POST',
        body: JSON.stringify({ tenant: 'acme', name: 'greeting' }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(200);
    expect(observedArgs).toBeUndefined();
  });

  it.each([
    '__proto__',
    'constructor',
    'prototype',
  ])('rejects an argument key named %s with HTTP 400', async (reservedKey) => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../get-prompt/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/get-prompt', {
        method: 'POST',
        body: JSON.stringify({
          tenant: 'acme',
          name: 'greeting',
          arguments: { [reservedKey]: 'value' },
        }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain(reservedKey);
    expect(body.error).toMatch(/reserved/i);
    // Object.prototype must not be polluted, even though the request
    // was rejected — the guard runs before any property write.
    expect((Object.prototype as Record<string, unknown>).value).toBeUndefined();
  });

  it('forwards args via a null-prototype object (defense in depth)', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    let observedArgs: Record<string, string> | undefined;
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.getPromptImpl = async (_name, args) => {
        observedArgs = args as Record<string, string>;
        return { messages: [] };
      };
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });
    const { POST } = await import('../get-prompt/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/get-prompt', {
        method: 'POST',
        body: JSON.stringify({
          tenant: 'acme',
          name: 'greeting',
          arguments: { topic: 'safe' },
        }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(200);
    expect(observedArgs?.topic).toBe('safe');
    expect(Object.getPrototypeOf(observedArgs)).toBeNull();
  });
});
