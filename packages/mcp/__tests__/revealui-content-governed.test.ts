/**
 * Governed-path invariant tests for the `revealui-content` factory seams
 * (GAP-371 Phase 1). Drives a real MCP client over Streamable HTTP against the
 * factory, threading a per-request `AuthInfo` onto `req.auth` exactly as the
 * `/api/mcp` mount does, with a fake REST backend standing in for the app so
 * these stay fast and DB-free.
 *
 * Covers, at the factory/transport seam:
 *   I-1  identity comes only from the verified credential (args cannot change it)
 *   I-4  no ambient service credential on the governed path
 *   I-5  a receipt per call; fail-closed for mutations, degrade for reads;
 *        raw args never stored (digest + allowlisted scalars only)
 *
 * I-2 / I-3 / I-6 (which need the DB-backed middleware chain) live in the
 * server-side pglite test.
 */

import { createServer as createHttpServer, type Server as NodeHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { McpCapabilityError, McpClient } from '../src/client.js';
import {
  type CollectionMcpSummary,
  createRevealuiContentServer,
  type McpToolAuditRecord,
} from '../src/servers/factories/revealui-content.js';
import { createNodeStreamableHttpHandler } from '../src/streamable-http.js';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const teardowns: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (teardowns.length > 0) {
    const t = teardowns.pop();
    if (t) await t().catch(() => undefined);
  }
});

interface BackendCall {
  authorization: string | undefined;
  url: string;
}

/** Fake REST backend the governed tools forward to. Records every call. */
async function startFakeBackend(
  respond: (call: BackendCall) => { status: number; body: unknown },
): Promise<{ url: string; calls: BackendCall[] }> {
  const calls: BackendCall[] = [];
  const server = createHttpServer((req, res) => {
    const call: BackendCall = { authorization: req.headers.authorization, url: req.url ?? '' };
    calls.push(call);
    const { status, body } = respond(call);
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
}

/**
 * Start the governed MCP handler over HTTP. `authInfo` is a getter so a test
 * can decide, per-connection, what identity (if any) is threaded onto
 * `req.auth` — mirroring the real mount.
 */
async function startGoverned(opts: {
  backendUrl: string;
  authInfo: () => unknown;
  mutatingTools?: Set<string>;
  auditFails?: boolean;
  collectionsProvider?: () => Promise<CollectionMcpSummary[] | null>;
}): Promise<GovernedServer> {
  const audits: McpToolAuditRecord[] = [];
  const handler = createNodeStreamableHttpHandler({
    enableJsonResponse: true,
    createServer: () =>
      createRevealuiContentServer({
        mutatingTools: opts.mutatingTools ?? new Set<string>(),
        collectionsProvider: opts.collectionsProvider,
        credentialsProvider: (ctx) => {
          const info = ctx.authInfo as { token?: string } | undefined;
          if (!info?.token) throw new Error('no per-request credential');
          return { apiUrl: opts.backendUrl, apiKey: info.token };
        },
        auditSink: async (record) => {
          audits.push(record);
          if (opts.auditFails) throw new Error('audit store down');
        },
      }),
  });

  const server: NodeHttpServer = createHttpServer((req, res) => {
    (req as { auth?: unknown }).auth = opts.authInfo();
    void handler(req, res).catch((err) => {
      if (!res.headersSent) res.statusCode = 500;
      res.end(JSON.stringify({ error: String(err) }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  teardowns.push(() => new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))));
  return { url: `http://127.0.0.1:${port}/`, audits };
}

function connectClient(url: string): Promise<McpClient> {
  const client = new McpClient({
    clientInfo: { name: 'governed-test', version: '0.0.1' },
    transport: { kind: 'streamable-http', url },
  });
  return client.connect().then(() => client);
}

const okBackend = () => ({ status: 200, body: { docs: [{ id: 'row-1' }] } });

// ---------------------------------------------------------------------------
// I-1 — identity comes only from the verified credential
// ---------------------------------------------------------------------------

describe('I-1 identity comes only from the verified credential', () => {
  it('forwards the token from AuthInfo and audits that identity, not any arg', async () => {
    const backend = await startFakeBackend(okBackend);
    const governed = await startGoverned({
      backendUrl: backend.url,
      authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
    });
    const client = await connectClient(governed.url);

    await client.callTool('revealui_list_content', { collection: 'posts', site_id: 'site-A' });
    await client.close();

    // The forwarded REST call carried A's token, sourced from AuthInfo.
    expect(backend.calls.length).toBeGreaterThan(0);
    for (const call of backend.calls) {
      expect(call.authorization).toBe('Bearer tokenA');
    }
    // The receipt's identity is A, taken from AuthInfo — never from a request arg.
    expect(governed.audits).toHaveLength(1);
    const extra = (governed.audits[0]?.context.authInfo as { extra?: { userId?: string } }).extra;
    expect(extra?.userId).toBe('A');
  });

  it('rejects an identity-shaped arg outright — args cannot smuggle a userId', async () => {
    const backend = await startFakeBackend(okBackend);
    const governed = await startGoverned({
      backendUrl: backend.url,
      authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
    });
    const client = await connectClient(governed.url);

    // The strict schemas admit no userId field; injecting one is denied before
    // any REST call, so an arg can never become the acting identity.
    const result = await client.callTool('revealui_list_sites', { userId: 'B' });
    await client.close();

    expect(result.isError).toBe(true);
    expect(backend.calls).toHaveLength(0);
    expect(governed.audits[0]?.outcome).toBe('denied');
  });
});

// ---------------------------------------------------------------------------
// I-4 — no ambient service credential on the governed path
// ---------------------------------------------------------------------------

describe('I-4 no ambient service credential on the governed path', () => {
  it('refuses the call when no per-request credential exists, even with REVEALUI_API_KEY set', async () => {
    const prev = process.env.REVEALUI_API_KEY;
    const prevUrl = process.env.REVEALUI_API_URL;
    try {
      const backend = await startFakeBackend(okBackend);
      // Point the ambient env credentials at the REAL backend, so an env
      // fallback would be observable as a backend call with the ambient key.
      process.env.REVEALUI_API_KEY = 'ambient-admin-key';
      process.env.REVEALUI_API_URL = backend.url;
      const governed = await startGoverned({
        backendUrl: backend.url,
        // No AuthInfo threaded — governed provider has no credential.
        authInfo: () => undefined,
      });
      const client = await connectClient(governed.url);

      const result = await client.callTool('revealui_list_sites', {});
      await client.close();

      expect(result.isError).toBe(true);
      // No env fallback: the ambient key never reached the backend.
      expect(backend.calls).toHaveLength(0);
    } finally {
      if (prev === undefined) delete process.env.REVEALUI_API_KEY;
      else process.env.REVEALUI_API_KEY = prev;
      if (prevUrl === undefined) delete process.env.REVEALUI_API_URL;
      else process.env.REVEALUI_API_URL = prevUrl;
    }
  });
});

// ---------------------------------------------------------------------------
// I-5 — a receipt per call
// ---------------------------------------------------------------------------

describe('I-5 a receipt per call', () => {
  it('records one invoked receipt on success with only a digest + allowlisted scalars', async () => {
    const backend = await startFakeBackend(okBackend);
    const governed = await startGoverned({
      backendUrl: backend.url,
      authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
    });
    const client = await connectClient(governed.url);

    const secret = 'sk_live_super_secret_value';
    await client.callTool('revealui_list_content', {
      collection: 'posts',
      site_id: 'site-A',
      status: secret,
    });
    await client.close();

    expect(governed.audits).toHaveLength(1);
    const rec = governed.audits[0]!;
    expect(rec.outcome).toBe('invoked');
    expect(rec.tool).toBe('revealui_list_content');
    // Digest is a 64-char lowercase-hex sha256; raw args are NOT present.
    expect(rec.argsDigest).toHaveLength(64);
    expect([...rec.argsDigest].every((ch) => '0123456789abcdef'.includes(ch))).toBe(true);
    // Allowlisted scalars only: collection + site_id, never the secret-shaped status.
    expect(rec.scalars).toEqual({ collection: 'posts', site_id: 'site-A' });
    const serialized = JSON.stringify(rec);
    expect(serialized).not.toContain(secret);
  });

  it('records a denied receipt for an unknown tool', async () => {
    const backend = await startFakeBackend(okBackend);
    const governed = await startGoverned({
      backendUrl: backend.url,
      authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
    });
    const client = await connectClient(governed.url);

    await client.callTool('revealui_delete_everything', {});
    await client.close();

    expect(governed.audits).toHaveLength(1);
    expect(governed.audits[0]?.outcome).toBe('denied');
  });

  it('records a failed receipt with httpStatus when the backend errors', async () => {
    const backend = await startFakeBackend(() => ({ status: 503, body: { error: 'down' } }));
    const governed = await startGoverned({
      backendUrl: backend.url,
      authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
    });
    const client = await connectClient(governed.url);

    const result = await client.callTool('revealui_list_sites', {});
    await client.close();

    expect(result.isError).toBe(true);
    expect(governed.audits).toHaveLength(1);
    expect(governed.audits[0]?.outcome).toBe('failed');
    expect(governed.audits[0]?.httpStatus).toBe(503);
  });

  it('fails a mutating tool closed when the audit write fails, and never executes it', async () => {
    const backend = await startFakeBackend(okBackend);
    const governed = await startGoverned({
      backendUrl: backend.url,
      authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
      mutatingTools: new Set(['revealui_list_sites']),
      auditFails: true,
    });
    const client = await connectClient(governed.url);

    const result = await client.callTool('revealui_list_sites', {});
    await client.close();

    expect(result.isError).toBe(true);
    // Fail-closed: the tool never reached the backend, so nothing "mutated".
    expect(backend.calls).toHaveLength(0);
  });

  it('degrades a read tool when the audit write fails, still returning data', async () => {
    const backend = await startFakeBackend(okBackend);
    const governed = await startGoverned({
      backendUrl: backend.url,
      authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
      mutatingTools: new Set<string>(),
      auditFails: true,
    });
    const client = await connectClient(governed.url);

    const result = await client.callTool('revealui_list_sites', {});
    await client.close();

    expect(result.isError).toBeFalsy();
    // The read executed despite the audit failure (degrade, not fail-closed).
    expect(backend.calls.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Collection allowlist — a content tool may only reach an EXPOSED collection
// ---------------------------------------------------------------------------
//
// Per-tool authz (I-7) is only sound if one tool cannot reach another tool's
// endpoint. `revealui_list_content` / `revealui_get_content` interpolate the
// `collection` arg into `/api/<collection>`, so a free-string collection would
// let a content tool reach e.g. `/api/users` — bypassing the admin gate on the
// separate `revealui_list_users` tool. The factory now validates `collection`
// against the RESOLVED exposed-collections allowlist, deny-by-default.

describe('content tools reject collections outside the exposed allowlist', () => {
  it('revealui_list_content denies collection=users — denied receipt, /api/users never reached', async () => {
    const backend = await startFakeBackend(okBackend);
    // No collectionsProvider → curated fallback (posts/pages/products/media)
    // is the exposed set; `users` is not in it.
    const governed = await startGoverned({
      backendUrl: backend.url,
      authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
    });
    const client = await connectClient(governed.url);

    const result = await client.callTool('revealui_list_content', { collection: 'users' });
    await client.close();

    expect(result.isError).toBe(true);
    // The ambient/user backend is never reached for an unexposed collection.
    expect(backend.calls).toHaveLength(0);
    expect(backend.calls.some((c) => c.url.startsWith('/api/users'))).toBe(false);
    expect(governed.audits).toHaveLength(1);
    expect(governed.audits[0]?.outcome).toBe('denied');
    expect(governed.audits[0]?.reason).toBe('collection-not-exposed');
  });

  it('revealui_get_content denies an unexposed collection — denied receipt, backend never reached', async () => {
    const backend = await startFakeBackend(okBackend);
    const governed = await startGoverned({
      backendUrl: backend.url,
      authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
    });
    const client = await connectClient(governed.url);

    const result = await client.callTool('revealui_get_content', {
      collection: 'users',
      id: 'u-1',
    });
    await client.close();

    expect(result.isError).toBe(true);
    expect(backend.calls).toHaveLength(0);
    expect(governed.audits).toHaveLength(1);
    expect(governed.audits[0]?.outcome).toBe('denied');
    expect(governed.audits[0]?.reason).toBe('collection-not-exposed');
  });

  it('an exposed collection (posts) still lists normally, reaching the backend', async () => {
    const backend = await startFakeBackend(okBackend);
    const governed = await startGoverned({
      backendUrl: backend.url,
      authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
    });
    const client = await connectClient(governed.url);

    const result = await client.callTool('revealui_list_content', { collection: 'posts' });
    await client.close();

    expect(result.isError).toBeFalsy();
    expect(backend.calls.some((c) => c.url.startsWith('/api/posts'))).toBe(true);
    expect(governed.audits[0]?.outcome).toBe('invoked');
  });

  it('the allowlist is the RESOLVED exposed set, not a hardcoded curated list', async () => {
    const backend = await startFakeBackend(okBackend);
    // Provider exposes ONLY `articles`; curated `posts` is NOT exposed here.
    const governed = await startGoverned({
      backendUrl: backend.url,
      authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
      collectionsProvider: async () => [
        { slug: 'articles', label: 'Article', labelPlural: 'Articles', mcpResource: true },
      ],
    });
    const client = await connectClient(governed.url);

    const exposed = await client.callTool('revealui_list_content', { collection: 'articles' });
    const curatedButNotExposed = await client.callTool('revealui_list_content', {
      collection: 'posts',
    });
    await client.close();

    expect(exposed.isError).toBeFalsy();
    expect(backend.calls.some((c) => c.url.startsWith('/api/articles'))).toBe(true);
    // `posts` is in the curated fallback but NOT in the resolved provider set → denied.
    expect(curatedButNotExposed.isError).toBe(true);
    expect(backend.calls.some((c) => c.url.startsWith('/api/posts'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GAP-373 — the governed path exposes no resources surface (#1910 Blocker 2)
// ---------------------------------------------------------------------------
//
// The resource handlers read through the process-global resolveCredentials()
// (ambient REVEALUI_API_KEY), never the per-request credentialsProvider, and
// write no receipt. On the governed mount that is a cross-tenant read channel:
// any authenticated client could resources/read with the ambient admin key,
// unaudited. Per the countersigned design §4-D, Phase 1's governed endpoint
// exposes ONLY the five read tools — the resources capability must be
// structurally absent when a credentialsProvider is present, not merely
// credential-gated. (Stdio/local mode keeps resources; see the stdio launcher.)

describe('GAP-373 governed path exposes no resources surface', () => {
  it('does not advertise the resources capability on the governed mount', async () => {
    const backend = await startFakeBackend(okBackend);
    const governed = await startGoverned({
      backendUrl: backend.url,
      authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
    });
    const client = await connectClient(governed.url);
    const caps = client.getServerCapabilities();
    await client.close();

    // Tools stay; resources is structurally absent on the governed path.
    expect(caps?.tools).toBeDefined();
    expect(caps?.resources).toBeUndefined();
  });

  it('refuses resources/list and resources/read, never reaching the ambient-key backend', async () => {
    const prev = process.env.REVEALUI_API_KEY;
    const prevUrl = process.env.REVEALUI_API_URL;
    try {
      const backend = await startFakeBackend(okBackend);
      // Ambient admin-equivalent credentials point at the real backend, so a
      // resource handler that consulted resolveCredentials() (the bug) would be
      // observable here as a backend call carrying the ambient key.
      process.env.REVEALUI_API_KEY = 'ambient-admin-key';
      process.env.REVEALUI_API_URL = backend.url;
      const governed = await startGoverned({
        backendUrl: backend.url,
        authInfo: () => ({ token: 'tokenA', extra: { userId: 'A', accountId: 'acct-A' } }),
      });
      const client = await connectClient(governed.url);

      await expect(client.listResources()).rejects.toThrow(McpCapabilityError);
      await expect(client.readResource('revealui-content://posts/row-1')).rejects.toThrow(
        McpCapabilityError,
      );
      await client.close();

      // The ambient key never reached the backend: no cross-tenant read channel.
      expect(backend.calls).toHaveLength(0);
    } finally {
      if (prev === undefined) delete process.env.REVEALUI_API_KEY;
      else process.env.REVEALUI_API_KEY = prev;
      if (prevUrl === undefined) delete process.env.REVEALUI_API_URL;
      else process.env.REVEALUI_API_URL = prevUrl;
    }
  });
});
