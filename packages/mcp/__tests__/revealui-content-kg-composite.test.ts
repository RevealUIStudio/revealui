/**
 * Hosted composite: knowledge-graph tools on the governed revealui-content
 * Server. Intercepts kg_* before credentialsProvider; write receipts
 * fail-closed before dispatch; read receipts after, log-and-continue.
 */

import { createServer as createHttpServer, type Server as NodeHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { CallToolRequest, CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { McpClient } from '../src/client.js';
import {
  type AdditionalMcpToolset,
  createRevealuiContentServer,
  type McpToolAuditRecord,
} from '../src/servers/factories/revealui-content.js';
import { createNodeStreamableHttpHandler } from '../src/streamable-http.js';

const teardowns: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (teardowns.length > 0) {
    const t = teardowns.pop();
    if (t) await t().catch(() => undefined);
  }
});

const kgSearchTool: Tool = {
  name: 'kg_search',
  description: 'search',
  inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
};
const kgAddTool: Tool = {
  name: 'kg_add_episode',
  description: 'write',
  inputSchema: { type: 'object', properties: {} },
};

function envelope(
  status: 'ok' | 'denied' | 'unavailable',
  extra: Record<string, unknown> = {},
): CallToolResult {
  const body =
    status === 'ok'
      ? { status, available: true, enforcement: 'enforced', deniedCount: 0, data: extra }
      : status === 'denied'
        ? {
            status,
            available: true,
            reason: 'scope-denied',
            scope: { tenantId: 'acct_1', classification: 'workspace' },
            message: 'out of scope',
            deniedCount: 1,
          }
        : {
            status,
            available: false,
            reason: extra.reason ?? 'kg-database-unavailable',
            message: 'down',
          };
  return {
    content: [{ type: 'text', text: JSON.stringify(body) }],
    isError: status !== 'ok',
  };
}

function fakeKg(opts: {
  dispatch: (request: CallToolRequest) => Promise<CallToolResult>;
}): AdditionalMcpToolset {
  return {
    tools: [kgSearchTool, kgAddTool],
    names: new Set(['kg_search', 'kg_add_episode']),
    dispatch: (request) => opts.dispatch(request),
  };
}

async function startFakeBackend(): Promise<{ url: string; calls: number }> {
  const state = { calls: 0 };
  const server = createHttpServer((_req, res) => {
    state.calls += 1;
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ docs: [] }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  teardowns.push(() => new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))));
  return {
    url: `http://127.0.0.1:${port}`,
    get calls() {
      return state.calls;
    },
  };
}

async function startGoverned(opts: {
  backendUrl: string;
  kg: AdditionalMcpToolset;
  timeoutMs?: number;
  auditFails?: boolean;
}): Promise<{ url: string; audits: McpToolAuditRecord[]; dispatches: string[] }> {
  const audits: McpToolAuditRecord[] = [];
  const dispatches: string[] = [];
  const wrapped: AdditionalMcpToolset = {
    ...opts.kg,
    dispatch: async (request, extra) => {
      dispatches.push(request.params.name);
      return opts.kg.dispatch(request, extra);
    },
  };
  const handler = createNodeStreamableHttpHandler({
    enableJsonResponse: true,
    createServer: () =>
      createRevealuiContentServer({
        credentialsProvider: () => ({ apiUrl: opts.backendUrl, apiKey: 'tokenA' }),
        auditSink: async (record) => {
          if (opts.auditFails) throw new Error('audit down');
          audits.push(record);
        },
        additionalToolsets: [wrapped],
        additionalToolsetTimeoutMs: opts.timeoutMs ?? 0,
        mutatingTools: new Set(['kg_add_episode']),
      }),
  });
  const server: NodeHttpServer = createHttpServer((req, res) => {
    (req as { auth?: unknown }).auth = {
      token: 'tokenA',
      extra: { userId: 'A', accountId: 'acct-A' },
    };
    void handler(req, res).catch((err) => {
      if (!res.headersSent) res.statusCode = 500;
      res.end(JSON.stringify({ error: String(err) }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  teardowns.push(() => new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))));
  return { url: `http://127.0.0.1:${port}/`, audits, dispatches };
}

function connectClient(url: string): Promise<McpClient> {
  const client = new McpClient({
    clientInfo: { name: 'kg-composite-test', version: '0.0.1' },
    transport: { kind: 'streamable-http', url },
  });
  return client.connect().then(() => client);
}

describe('governed knowledge-graph composite', () => {
  it('lists kg tools beside content tools', async () => {
    const backend = await startFakeBackend();
    const governed = await startGoverned({
      backendUrl: backend.url,
      kg: fakeKg({ dispatch: async () => envelope('ok') }),
    });
    const client = await connectClient(governed.url);
    const names = (await client.listTools()).map((t) => t.name);
    await client.close();
    expect(names).toContain('revealui_list_sites');
    expect(names).toContain('kg_search');
    expect(names).toContain('kg_add_episode');
  });

  it('skips credentialsProvider for kg names (no REST call)', async () => {
    const backend = await startFakeBackend();
    const governed = await startGoverned({
      backendUrl: backend.url,
      kg: fakeKg({ dispatch: async () => envelope('ok', { nodes: [] }) }),
    });
    const client = await connectClient(governed.url);
    const result = await client.callTool('kg_search', { query: 'x' });
    await client.close();
    expect(result.isError).toBeFalsy();
    expect(backend.calls).toBe(0);
    expect(governed.dispatches).toEqual(['kg_search']);
  });

  it('fail-closes kg_add_episode before dispatch when the audit write fails', async () => {
    const backend = await startFakeBackend();
    const governed = await startGoverned({
      backendUrl: backend.url,
      kg: fakeKg({ dispatch: async () => envelope('ok') }),
      auditFails: true,
    });
    const client = await connectClient(governed.url);
    const result = await client.callTool('kg_add_episode', { episodeType: 'agent-fact' });
    await client.close();
    expect(result.isError).toBe(true);
    expect(governed.dispatches).toEqual([]);
  });

  it('records a read receipt AFTER dispatch; audit failure does not fail the read', async () => {
    const backend = await startFakeBackend();
    const governed = await startGoverned({
      backendUrl: backend.url,
      kg: fakeKg({ dispatch: async () => envelope('ok', { nodes: [] }) }),
      auditFails: true,
    });
    const client = await connectClient(governed.url);
    const result = await client.callTool('kg_search', { query: 'x' });
    await client.close();
    expect(result.isError).toBeFalsy();
    expect(governed.dispatches).toEqual(['kg_search']);
  });

  it('maps denied and unavailable envelopes onto read receipts', async () => {
    const backend = await startFakeBackend();
    const deniedGov = await startGoverned({
      backendUrl: backend.url,
      kg: fakeKg({ dispatch: async () => envelope('denied') }),
    });
    const deniedClient = await connectClient(deniedGov.url);
    await deniedClient.callTool('kg_search', { query: 'x' });
    await deniedClient.close();
    expect(deniedGov.audits[0]?.outcome).toBe('denied');

    const failedGov = await startGoverned({
      backendUrl: backend.url,
      kg: fakeKg({ dispatch: async () => envelope('unavailable') }),
    });
    const failedClient = await connectClient(failedGov.url);
    await failedClient.callTool('kg_search', { query: 'x' });
    await failedClient.close();
    expect(failedGov.audits[0]?.outcome).toBe('failed');
  });

  it('races a hung kg dispatch at the wrapper', async () => {
    const backend = await startFakeBackend();
    const governed = await startGoverned({
      backendUrl: backend.url,
      timeoutMs: 50,
      kg: fakeKg({ dispatch: () => new Promise(() => undefined) }),
    });
    const client = await connectClient(governed.url);
    const result = await client.callTool('kg_search', { query: 'hang' });
    await client.close();
    expect(result.isError).toBe(true);
    const text = result.content.find((c) => c.type === 'text')?.text ?? '';
    expect(text).toContain('timeout');
  });
});
