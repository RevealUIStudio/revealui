/**
 * MCP tool-browser route tests (Stage 3.2).
 *
 * Exercises the three new per-server routes:
 *   - GET   /api/mcp/remote-servers/[server]/tools
 *   - POST  /api/mcp/remote-servers/[server]/call-tool
 *   - POST  /api/mcp/remote-servers/[server]/complete
 *
 * `buildRemoteMcpClient` is stubbed to return a fake client so we can
 * assert the routes forward arguments correctly, propagate capability
 * errors, and always close the transport. Real HTTP + McpClient coverage
 * lives in `packages/mcp/__tests__/client.tools.test.ts` and the existing
 * OAuth + Streamable HTTP integration tests.
 */

import { McpCapabilityError } from '@revealui/mcp/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// -- Mocks ------------------------------------------------------------------

class FakeMcpClient {
  connectCalls = 0;
  closeCalls = 0;
  listToolsImpl: () => Promise<unknown[]> = async () => [];
  callToolImpl: (name: string, args?: unknown) => Promise<unknown> = async () => ({
    content: [],
  });
  completeImpl: (ref: unknown, arg: unknown) => Promise<unknown> = async () => ({
    values: [],
  });

  async connect(): Promise<void> {
    this.connectCalls++;
  }
  async close(): Promise<void> {
    this.closeCalls++;
  }
  async listTools(): Promise<unknown[]> {
    return this.listToolsImpl();
  }
  async callTool(name: string, args?: unknown): Promise<unknown> {
    return this.callToolImpl(name, args);
  }
  async complete(ref: unknown, arg: unknown): Promise<unknown> {
    return this.completeImpl(ref, arg);
  }
}

const fakeClients: FakeMcpClient[] = [];
let nextBuildThrows: Error | null = null;

const mockBuild = vi.fn(async (_opts: { tenant: string; server: string }) => {
  if (nextBuildThrows) {
    const err = nextBuildThrows;
    nextBuildThrows = null;
    throw err;
  }
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
  nextBuildThrows = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/mcp/remote-servers/[server]/tools
// ---------------------------------------------------------------------------

describe('GET /api/mcp/remote-servers/[server]/tools', () => {
  it('returns 401 without a session', async () => {
    mockGetSession.mockResolvedValue(null);
    const { GET } = await import('../tools/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/tools?tenant=acme') as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin sessions', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'user' } });
    const { GET } = await import('../tools/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/tools?tenant=acme') as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 on missing or malformed tenant', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { GET } = await import('../tools/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/tools') as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when the server has no stored OAuth meta', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const actual = await vi.importActual<typeof import('@/lib/mcp/remote-server-client')>(
      '@/lib/mcp/remote-server-client',
    );
    nextBuildThrows = new actual.RemoteServerNotConnectedError('acme', 'linear');

    const { GET } = await import('../tools/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/tools?tenant=acme') as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('not_connected');
  });

  it('returns 412 when the server does not advertise the tools capability', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.listToolsImpl = async () => {
        throw new McpCapabilityError('tools');
      };
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });

    const { GET } = await import('../tools/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/tools?tenant=acme') as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(412);
    // Transport was still closed despite the error.
    expect(fakeClients[0]?.closeCalls).toBe(1);
  });

  it('connects, lists tools, and always closes the transport', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.listToolsImpl = async () => [
        { name: 'echo', description: 'Echoes input', inputSchema: { type: 'object' } },
      ];
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });

    const { GET } = await import('../tools/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/tools?tenant=acme') as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: Array<{ name: string }>; serverUrl: string };
    expect(body.tools.map((t) => t.name)).toEqual(['echo']);
    expect(body.serverUrl).toBe('http://remote.test/mcp');
    expect(fakeClients[0]?.connectCalls).toBe(1);
    expect(fakeClients[0]?.closeCalls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/mcp/remote-servers/[server]/call-tool
// ---------------------------------------------------------------------------

describe('POST /api/mcp/remote-servers/[server]/call-tool', () => {
  it('returns 400 when body.arguments is not a plain object', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../call-tool/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/call-tool', {
        method: 'POST',
        body: JSON.stringify({ tenant: 'acme', name: 'echo', arguments: [1, 2, 3] }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when body.name is missing', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../call-tool/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/call-tool', {
        method: 'POST',
        body: JSON.stringify({ tenant: 'acme' }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(400);
  });

  it('forwards name + arguments to callTool and returns the result', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    let observedName: string | undefined;
    let observedArgs: unknown;
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.callToolImpl = async (name, args) => {
        observedName = name;
        observedArgs = args;
        return { content: [{ type: 'text', text: 'ok' }] };
      };
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });

    const { POST } = await import('../call-tool/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/call-tool', {
        method: 'POST',
        body: JSON.stringify({
          tenant: 'acme',
          name: 'echo',
          arguments: { text: 'hello' },
        }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { content: Array<{ text: string }> } };
    expect(body.result.content[0]?.text).toBe('ok');
    expect(observedName).toBe('echo');
    expect(observedArgs).toEqual({ text: 'hello' });
    expect(fakeClients[0]?.closeCalls).toBe(1);
  });

  it('returns 502 on transport/call failures', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.callToolImpl = async () => {
        throw new Error('wire exploded');
      };
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });

    const { POST } = await import('../call-tool/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/call-tool', {
        method: 'POST',
        body: JSON.stringify({ tenant: 'acme', name: 'echo', arguments: {} }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(502);
    expect(fakeClients[0]?.closeCalls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/mcp/remote-servers/[server]/complete
// ---------------------------------------------------------------------------

describe('POST /api/mcp/remote-servers/[server]/complete', () => {
  it('rejects body.ref when type is not recognized', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../complete/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/complete', {
        method: 'POST',
        body: JSON.stringify({
          tenant: 'acme',
          ref: { type: 'ref/unknown', name: 'x' },
          argument: { name: 'arg', value: '' },
        }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(400);
  });

  it('rejects body.argument when shape is wrong', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../complete/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/complete', {
        method: 'POST',
        body: JSON.stringify({
          tenant: 'acme',
          ref: { type: 'ref/prompt', name: 'summarize' },
          argument: { name: 'arg' }, // missing value
        }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(400);
  });

  it('forwards prompt-ref completions and returns suggestions', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    let observedRef: unknown;
    let observedArg: unknown;
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.completeImpl = async (ref, arg) => {
        observedRef = ref;
        observedArg = arg;
        return { values: ['apple', 'apricot'], hasMore: false };
      };
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });

    const { POST } = await import('../complete/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/complete', {
        method: 'POST',
        body: JSON.stringify({
          tenant: 'acme',
          ref: { type: 'ref/prompt', name: 'summarize' },
          argument: { name: 'topic', value: 'ap' },
        }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { completion: { values: string[] } };
    expect(body.completion.values).toEqual(['apple', 'apricot']);
    expect(observedRef).toEqual({ type: 'ref/prompt', name: 'summarize' });
    expect(observedArg).toEqual({ name: 'topic', value: 'ap' });
    expect(fakeClients[0]?.closeCalls).toBe(1);
  });

  it('accepts resource-template references', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    let observedRef: unknown;
    mockBuild.mockImplementationOnce(async () => {
      const client = new FakeMcpClient();
      client.completeImpl = async (ref) => {
        observedRef = ref;
        return { values: [] };
      };
      fakeClients.push(client);
      return { client: client as never, meta: { serverUrl: 'http://remote.test/mcp' } };
    });

    const { POST } = await import('../complete/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/complete', {
        method: 'POST',
        body: JSON.stringify({
          tenant: 'acme',
          ref: { type: 'ref/resource', uri: 'revealui://acme/posts/{id}' },
          argument: { name: 'id', value: '1' },
        }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(200);
    expect(observedRef).toEqual({
      type: 'ref/resource',
      uri: 'revealui://acme/posts/{id}',
    });
  });
});
