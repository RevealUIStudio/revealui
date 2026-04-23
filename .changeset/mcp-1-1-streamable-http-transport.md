---
'@revealui/mcp': minor
---

Add Streamable HTTP transport support — Stage 1 PR-1.1 of the MCP v1 plan. Opens the door to remote MCP servers (admin-as-client, agent-runtime-as-client, and in v1.1 the RevMarket third-party marketplace).

### Client-side

`McpClient`'s transport discriminated union extends with:

```ts
new McpClient({
  clientInfo: { name, version },
  transport: {
    kind: 'streamable-http',
    url: 'https://example.com/mcp',
    requestInit,        // optional Fetch RequestInit (headers, credentials, …)
    fetch,              // optional custom fetch
    sessionId,          // optional resumption token
    reconnectionOptions,// SSE reconnection tuning
  },
});
```

Wires through to the SDK's `StreamableHTTPClientTransport`. No OAuth wiring yet — Stage 2 adds `authProvider`. Callers who need bearer-token auth before then can pass `Authorization` via `requestInit.headers`.

### Server-side

New subpath export `@revealui/mcp/streamable-http` exposes `createNodeStreamableHttpHandler(options)`. Returns a Node `(req, res) => Promise<void>` handler that:

- Allocates a fresh `Server` + `StreamableHTTPServerTransport` pair per new session (via the caller-provided `createServer()` factory)
- Routes subsequent requests by `Mcp-Session-Id` header to the matching session's transport
- Cleans up on session termination
- Optional `onSessionInitialized` / `onSessionClosed` callbacks
- Dispatch-level options: `sessionIdGenerator`, `allowedHosts`, `allowedOrigins`, `enableJsonResponse`

The SDK's `StreamableHTTPServerTransport` is a one-session-per-instance primitive (see `this.sessionId` in its implementation). The external `Map<sessionId, { server, transport }>` this helper maintains is what makes multi-client deployments work.

```ts
import { createServer as createHttpServer } from 'node:http';
import { createNodeStreamableHttpHandler } from '@revealui/mcp/streamable-http';

const handler = createNodeStreamableHttpHandler({
  createServer: () => makeRevealUiContentServer(),
  onSessionInitialized: (id) => logger.info({ sessionId: id }, 'MCP session opened'),
});

createHttpServer(handler).listen(3000);
```

### Testing

6 new integration cases in `packages/mcp/__tests__/streamable-http.integration.test.ts` against a real `http.createServer` on an ephemeral port:

- Initialize → listResources → readResource round-trip via HTTP
- Server capabilities propagated through initialize
- Two concurrent clients get independent session state (fresh Server per session)
- `onSessionInitialized` fires with a well-formed session UUID
- Non-initialize POST without session → 400 "Session ID required"
- POST with unknown session → 400 "Unknown session ID"

MCP total: **161 passing / 5 skipped** (was 155 after Stage 0).

### Not in this PR

- **Web-Standard (Fetch API) handler** — for Next.js App Router / Cloudflare Workers / Deno / Bun. Same session-routing logic, different request primitive. Targeted for a follow-up in Stage 1.
- **PR-1.2 — dual-mode first-party servers.** Today's 13 first-party MCP servers under `packages/mcp/src/servers/` ship stdio-only. PR-1.2 makes them build both stdio (dev / Claude Code) and HTTP (admin / agent-runtime) targets.
- **OAuth 2.1** — Stage 2.

See `.jv/docs/mcp-productionization-scope.md` for the full v1 plan.
