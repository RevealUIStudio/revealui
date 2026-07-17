/**
 * Governed-path authorization / quota / metering SEAM tests for the
 * `revealui-content` factory (GAP-371 Phase 2). Drives a real MCP client over
 * Streamable HTTP against the factory with injected `toolAuthorizer`,
 * `rateLimiter`, and `meterSink`, and a fake REST backend. DB-free — the
 * end-to-end policy wiring (real RBAC + tier + `McpRateLimiter` + entitlements)
 * lives in the server-side pglite test.
 *
 * Covers, at the factory/transport seam:
 *   I-7  deny-by-default per-tool authz gates BOTH `tools/list` (filtered) and
 *        `tools/call` (denied + audited with reason `authz`, no REST call)
 *   I-8  the rate limiter denies with reason `rate-limit` (no REST call)
 *   §5.5 tail  one meter event per EXECUTED call, with the errored flag; a
 *        denied call is never metered
 */

import { createServer as createHttpServer, type Server as NodeHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { McpClient } from '../src/client.js';
import {
  createRevealuiContentServer,
  type McpToolAuditRecord,
  type McpToolMeterEvent,
} from '../src/servers/factories/revealui-content.js';
import { createNodeStreamableHttpHandler } from '../src/streamable-http.js';

const teardowns: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (teardowns.length > 0) {
    const t = teardowns.pop();
    if (t) await t().catch(() => undefined);
  }
});

interface BackendCall {
  url: string;
}

async function startFakeBackend(
  respond: () => { status: number; body: unknown } = () => ({ status: 200, body: { docs: [] } }),
): Promise<{ url: string; calls: BackendCall[] }> {
  const calls: BackendCall[] = [];
  const server = createHttpServer((req, res) => {
    calls.push({ url: req.url ?? '' });
    const { status, body } = respond();
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  teardowns.push(() => new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))));
  return { url: `http://127.0.0.1:${port}`, calls };
}

interface GovernedServer {
  url: string;
  audits: McpToolAuditRecord[];
  meters: McpToolMeterEvent[];
}

async function startGoverned(opts: {
  backendUrl: string;
  allowTools?: ReadonlySet<string>;
  rateOk?: () => boolean;
  backendStatus?: () => { status: number; body: unknown };
}): Promise<GovernedServer> {
  const audits: McpToolAuditRecord[] = [];
  const meters: McpToolMeterEvent[] = [];
  const handler = createNodeStreamableHttpHandler({
    enableJsonResponse: true,
    createServer: () =>
      createRevealuiContentServer({
        credentialsProvider: () => ({ apiUrl: opts.backendUrl, apiKey: 'tokenA' }),
        auditSink: async (record) => {
          audits.push(record);
        },
        toolAuthorizer: opts.allowTools ? (_ctx, tool) => opts.allowTools!.has(tool) : undefined,
        rateLimiter: opts.rateOk ? () => opts.rateOk!() : undefined,
        meterSink: (_ctx, event) => {
          meters.push(event);
        },
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
  return { url: `http://127.0.0.1:${port}/`, audits, meters };
}

function connectClient(url: string): Promise<McpClient> {
  const client = new McpClient({
    clientInfo: { name: 'authz-test', version: '0.0.1' },
    transport: { kind: 'streamable-http', url },
  });
  return client.connect().then(() => client);
}

// ---------------------------------------------------------------------------
// I-7 — deny-by-default authz gates discovery AND execution
// ---------------------------------------------------------------------------

describe('I-7 authz gates discovery and execution independently', () => {
  it('tools/list shows only authorized tools', async () => {
    const backend = await startFakeBackend();
    const governed = await startGoverned({
      backendUrl: backend.url,
      allowTools: new Set(['revealui_list_sites', 'revealui_list_content']),
    });
    const client = await connectClient(governed.url);
    const names = (await client.listTools()).map((t) => t.name);
    await client.close();

    expect(names).toContain('revealui_list_sites');
    expect(names).not.toContain('revealui_list_users');
  });

  it('a direct call to an unauthorized tool is denied + audited (reason authz), never reaching the backend', async () => {
    const backend = await startFakeBackend();
    const governed = await startGoverned({
      backendUrl: backend.url,
      // list_users is hidden from discovery AND must be independently denied.
      allowTools: new Set(['revealui_list_sites']),
    });
    const client = await connectClient(governed.url);
    const result = await client.callTool('revealui_list_users', {});
    await client.close();

    expect(result.isError).toBe(true);
    expect(backend.calls).toHaveLength(0);
    expect(governed.audits).toHaveLength(1);
    expect(governed.audits[0]?.outcome).toBe('denied');
    expect(governed.audits[0]?.reason).toBe('authz');
    // A denied call is not billable usage.
    expect(governed.meters).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// I-8 — rate limiter denies with reason rate-limit
// ---------------------------------------------------------------------------

describe('I-8 rate-limit denial', () => {
  it('denies with reason rate-limit and does not reach the backend or meter', async () => {
    const backend = await startFakeBackend();
    const governed = await startGoverned({
      backendUrl: backend.url,
      allowTools: new Set(['revealui_list_sites']),
      rateOk: () => false,
    });
    const client = await connectClient(governed.url);
    const result = await client.callTool('revealui_list_sites', {});
    await client.close();

    expect(result.isError).toBe(true);
    expect(backend.calls).toHaveLength(0);
    expect(governed.audits[0]?.outcome).toBe('denied');
    expect(governed.audits[0]?.reason).toBe('rate-limit');
    expect(governed.meters).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Metering — one event per executed call, carrying the errored flag
// ---------------------------------------------------------------------------

describe('metering fires once per executed call', () => {
  it('meters a successful call with errored=false', async () => {
    const backend = await startFakeBackend();
    const governed = await startGoverned({ backendUrl: backend.url, rateOk: () => true });
    const client = await connectClient(governed.url);
    await client.callTool('revealui_list_sites', {});
    await client.close();

    expect(governed.meters).toHaveLength(1);
    expect(governed.meters[0]?.tool).toBe('revealui_list_sites');
    expect(governed.meters[0]?.errored).toBe(false);
  });

  it('meters a failed call with errored=true', async () => {
    const backend = await startFakeBackend(() => ({ status: 503, body: { error: 'down' } }));
    const governed = await startGoverned({ backendUrl: backend.url });
    const client = await connectClient(governed.url);
    const result = await client.callTool('revealui_list_sites', {});
    await client.close();

    expect(result.isError).toBe(true);
    expect(governed.meters).toHaveLength(1);
    expect(governed.meters[0]?.errored).toBe(true);
  });
});
