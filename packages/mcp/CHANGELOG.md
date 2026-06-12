# @revealui/mcp

## 0.6.1

### Patch Changes

- Updated dependencies [145975d]
- Updated dependencies [553a981]
- Updated dependencies [763e4f1]
- Updated dependencies [ebbe445]
- Updated dependencies [c77ac4f]
- Updated dependencies [a3dcac3]
- Updated dependencies [8024933]
  - @revealui/config@0.4.2
  - @revealui/core@0.10.0
  - @revealui/contracts@0.6.1
  - @revealui/security@0.4.1

## 0.6.0

### Minor Changes

- 239a642: Add the `revealui-docs` MCP server — first-party dependency intelligence. Resolves `@revealui/*` library names and serves curated docs (README + package metadata + public export subpaths) from the monorepo, exported via `@revealui/mcp/docs-server` with a stdio launcher at `servers/docs.ts`. Phase 1 covers first-party packages only; npm/third-party source via `opensrc` is a later phase.

### Patch Changes

- Updated dependencies [f8c74e6]
- Updated dependencies [ba61b20]
- Updated dependencies [6545491]
  - @revealui/core@0.9.0
  - @revealui/contracts@0.6.0

## 0.5.0

### Minor Changes

- 363d4b5: Remove the RevealCoin (RVUI) on-chain payment integration. RevealCoin is a separate pre-launch product; this drops its wiring from the framework while leaving x402 micropayments (USDC on Base) fully intact.

  - **@revealui/contracts**: removed the RevealCoin module exports (token config, mint addresses, allocations, amount helpers) and the `rvuiDiscount` pricing field; the agent `pricing` schema is now USDC-only.
  - **@revealui/db**: dropped the `revealcoin_payments` and `revealcoin_price_snapshots` tables (migration `0016`) and their generated types.
  - **@revealui/services**: removed the `./revealcoin` entry point (on-chain client, price oracle, payment safeguards).
  - **@revealui/core**: x402 observability is USDC-only — removed the safeguard-rejection counter and narrowed the payment-metric currency/scheme labels.
  - **@revealui/mcp**: removed the `revealcoin` contracts-introspection category.

  Breaking for any consumer importing the removed symbols (minor bumps under pre-1.0 SemVer).

- 0f2906c: Harden server-side fetches of user/tenant-supplied URLs against SSRF.

  `@revealui/security` gains `createSafeFetch()` — a `fetch` that validates the
  target resolves to a public IP and pins the connection to that IP via an undici
  dispatcher whose lookup re-validates at dial time (closing the DNS-rebinding
  TOCTOU that a bare `assertPublicUrl` + `fetch` leaves open), and refuses
  redirects (a classic SSRF-guard bypass). `assertPublicUrl()` now returns the
  validated public IPs and additionally blocks bracketed-IPv6 literals and
  hex-form IPv4-mapped loopback/private literals (e.g. `::ffff:7f00:1`) that the
  prior check missed.

  `@revealui/mcp` routes every remote MCP server connection through this guard in
  `buildRemoteMcpClient` (validating the stored server URL and pinning the
  transport's fetch). The API marketplace proxy and the admin MCP OAuth initiate
  flow now reject private/metadata/loopback targets instead of connecting to them.

### Patch Changes

- Updated dependencies [198fc08]
- Updated dependencies [9ec7c07]
- Updated dependencies [363d4b5]
- Updated dependencies [198e56a]
- Updated dependencies [1d5a9e4]
- Updated dependencies [0f2906c]
- Updated dependencies [e4a3779]
  - @revealui/core@0.8.0
  - @revealui/contracts@0.6.0
  - @revealui/security@0.4.0

## 0.4.0

### Minor Changes

- a8ca087: **F8 Phase 1 of the contracts protocol-pyramid ADR** (`docs/decisions/2026-05-03-contracts-protocol-pyramid.md`) — adds a new MCP server `revealui-contracts` that exposes every `@revealui/contracts` category as MCP **resources** (read-only catalog of JSON Schemas) and matching MCP **tools** that parse arbitrary JSON against any registered schema.

  ## `@revealui/mcp` (minor)

  **New: contracts introspection MCP server.** Lives at `packages/mcp/src/servers/factories/contracts.ts` (factory) + `packages/mcp/src/servers/contracts.ts` (stdio launcher). Exposed via the new `@revealui/mcp/contracts-server` subpath export.

  - **Resources:**
    - `revealui-contracts://catalog` — full discovery payload listing every category, primary schema name, secondary schema names, and human description.
    - `revealui-contracts://<category>` — JSON document for a single category, returning `{ category, primarySchema, schemas: Record<name, JSONSchema7> }`.
  - **Tools:**
    - `contracts_list_categories` — same payload as the catalog resource (tool form for clients that prefer tool-call ergonomics).
    - `contracts_get_schema({ category, schema? })` — return the JSON Schema for a single `(category, schemaName)` pair. Defaults to the category primary when `schema` is omitted.
    - `contracts_validate_<category>({ schema?, data })` — one tool per registered category. Parses `data` against the named schema (defaults to category primary). Returns `{ success: true, data }` | `{ success: false, issues }`.
  - **Categories surfaced (17):** a2a, admin, agents, api_auth, api_chat, api_gdpr, content, content_validation, devkit_profiles, entities, generated, providers, representation, revealcoin, secrets, security, stripe_webhook_events.
  - **License:** intentionally NOT Pro-gated. `@revealui/contracts` is MIT and agent-side schema introspection is meant to enable any MCP client (Claude Code, Cursor, custom agents) to integrate cleanly. Pro-gating a public-package primitive would defeat the purpose.
  - **Tests:** 70+ unit tests at `packages/mcp/src/__tests__/contracts-server.test.ts` (≥1 happy + 1 sad path per category, ADR's 34-minimum target comfortably exceeded).
  - **README:** new section #8 + bumped "12 MCP Servers" → "13 MCP Servers" (claim-drift CI requires ground-truth count).

  Also exposes `validatePayload(category, schemaName, data)` and `REGISTERED_CATEGORIES` for in-process consumers (the `@revealui/ai` package + future hypervisor wiring).

  ## `@revealui/contracts` (minor — additive)

  **New subpath exports** for categories that already existed in `src/` but weren't exposed via `package.json` `exports`:

  - `@revealui/contracts/a2a` — A2A AgentCard / Task / Message / Skill / Artifact / JSON-RPC envelopes.
  - `@revealui/contracts/api/auth` — sign-in / sign-up / password reset / MFA / passkey / recovery.
  - `@revealui/contracts/api/chat` — ChatRequest / ChatMessage.
  - `@revealui/contracts/api/gdpr` — GDPRDeleteRequest / GDPRExportRequest.

  These were already accessible via the root barrel (`from '@revealui/contracts'`); the new subpaths give consumers per-category granularity matching the existing pattern (`/entities`, `/representation`, etc.). Purely additive — no existing imports change behavior.

  No code changes elsewhere in the contracts package.

- 7ad9ddb: Remove unused `checkMcpLicense` export and all 11 per-server gate call sites. Per
  the 2026-05-08 charge-readiness audit Phase 2 Path A: the gates were theater —
  `MCPHypervisor`, `MCPClient`, and `createMCPAdapter` shipped ungated regardless;
  bypass was "import the class directly, never call `launchXMcp`." Drop the gates.

  License normalized from MIT to FSL-1.1-MIT: a runtime tier check was incoherent
  with MIT's "use without restriction" grant. LICENSE file added to the package.

- 5040b7c: Add `McpClient` — a typed wrapper around `@modelcontextprotocol/sdk`'s `Client` class, scoped to the resources + prompts protocol surface (Stage 0 PR-0.1 of the MCP v1 plan).

  The existing hypervisor speaks its own custom JSON-RPC 2.0 and only calls `tools/list` / `tools/call` / `ping`. That serves the 13 first-party servers well but leaves resources, prompts, sampling, elicitation, roots, logging, progress, cancellation, completions, and notifications entirely unavailable to RevealUI callers. `McpClient` is a parallel surface for non-tool primitives; later stages migrate the hypervisor to route through it.

  **Ships in this release:**

  - `McpClient` class with `connect()` / `close()` (idempotent), `getServerCapabilities()`, `ping()`.
  - Resources: `listResources()`, `readResource(uri)`, `subscribeResource(uri, handler)` → returns unsubscribe function; automatic protocol-level subscribe/unsubscribe based on subscriber count per URI.
  - Prompts: `listPrompts()`, `getPrompt(name, args?)`.
  - List-changed subscriptions: `onResourcesListChanged(handler)`, `onPromptsListChanged(handler)`, `onToolsListChanged(handler)` — each returns an unregister function.
  - Transport discriminated union: `{ kind: 'stdio', command, args?, env?, cwd? }` or `{ kind: 'custom', transport }` (the second form accepts any SDK `Transport`, used today for tests via `InMemoryTransport`). Stage 1 will extend this with `{ kind: 'streamable-http' }`.
  - Typed errors: `McpCapabilityError` (thrown by any method whose server-side capability wasn't advertised) and `McpNotConnectedError` (method called before `connect()`).

  **Testing:** the SDK's `InMemoryTransport.createLinkedPair()` is used for a real wire-protocol round-trip in tests — no subprocess spawning, no stdio flakiness. Integration test covers 19 cases including connect idempotency, resource read, per-URI subscription fan-out with multiple subscribers, unsubscribe after close, prompt argument passthrough, list-changed fan-out, and capability-error enforcement against minimal servers.

  **Not yet:**

  - Sampling, elicitation, roots, completions, logging, progress, cancellation, notifications — PR-0.2 / PR-0.3.
  - Streamable HTTP transport — Stage 1.
  - OAuth 2.1 — Stage 2.
  - Admin UI surface — Stage 3.

  See `.jv/docs/mcp-productionization-scope.md` for the full v1 plan.

- 0d4e1c4: Extend `McpClient` (shipped in PR-0.1) with the second slice of Stage 0 protocol coverage: sampling, elicitation, roots, and completions.

  **New handler-based surface** (advertised capabilities are auto-derived from which handlers the caller supplies at construction):

  - **`samplingHandler`** — the server's `sampling/createMessage` requests route here. Lets servers use the client's LLM without bundling a provider. Advertises `sampling: {}`.
  - **`elicitationHandler`** — the server's `elicitation/create` requests route here. Handler returns one of `accept` / `decline` / `cancel`. Advertises `elicitation: {}` (form mode).
  - **`rootsProvider`** — called on every server `roots/list` request (not cached; provider is authoritative). Advertises `roots: { listChanged: true }`.

  **New client methods:**

  - **`notifyRootsListChanged()`** — emits `notifications/roots/list_changed` so the server re-fetches. Throws if the client was not constructed with a `rootsProvider`.
  - **`complete(reference, argument)`** — client-initiated `completions/complete` for prompt or resource-template argument autocomplete. Checks the server advertises `completions` and throws `McpCapabilityError` otherwise.

  **Capability auto-advertisement** is the key ergonomic: callers declare their intent by wiring a handler/provider; the client ensures the initialize capability set matches what it can actually service. Advertising a capability without a handler is nonsensical, so it's impossible by construction.

  **Testing:** 11 additional integration cases via `InMemoryTransport.createLinkedPair()` — sampling call/result, sampling handler error propagation, sampling absence of capability, elicit accept/decline round-trips, roots list/dynamic/notify/error, completions round-trip + capability error.

  **Not yet:** logging (`logging/setLevel` + server log notifications), progress (per-request progress tokens + notifications), cancellation (`notifications/cancelled` request cancellation), generic notification pattern — PR-0.3.

  See `.jv/docs/mcp-productionization-scope.md` for the full v1 plan.

- a9b377e: Close Stage 0 of the MCP v1 plan. Extends `McpClient` with the transport-level protocol primitives: logging, progress, cancellation, and generic notification routing. With this PR merged, `@revealui/mcp` speaks the full MCP client surface defined by the current spec.

  **New on McpClient:**

  - **`setLoggingLevel(level, options?)`** — set the server's minimum log level. Requires `logging` capability.
  - **`onLog(handler)`** — subscribe to server-emitted `notifications/message` log events. Returns unregister. Multiple subscribers fan out.
  - **`on(schema, handler)`** — generic notification subscription. First call per schema installs a single SDK handler; later calls join the fan-out. Returns unregister. Used internally by `onLog` and by the constructor's resource-updated wiring, so external `on(ResourceUpdatedNotificationSchema, …)` calls coexist with `subscribeResource` without overwriting each other.

  **New per-request options** (threaded through `listResources`, `readResource`, `listPrompts`, `getPrompt`, `complete`, `ping`, `subscribeResource`, `setLoggingLevel`):

  - `signal` — `AbortSignal` for cancellation. Aborting sends `notifications/cancelled` and rejects the pending promise.
  - `onProgress` — subscribe to per-request progress notifications. SDK auto-correlates by the generated progress token.
  - `timeout` — request-level timeout in ms.
  - `resetTimeoutOnProgress` — if true, incoming progress resets the timeout clock.

  No explicit `cancelRequest()` method — `AbortSignal` is the web-idiomatic cancellation primitive and the SDK handles it natively.

  **Testing:** 8 new integration cases in `packages/mcp/__tests__/client.transport-primitives.test.ts` via `InMemoryTransport`:

  - **Logging** — setLoggingLevel round-trip, onLog fan-out with multiple subscribers + unregister, `McpCapabilityError` without logging capability
  - **Progress** — server emits `notifications/progress` with the request's progress token; client's `onProgress` callback receives all events in order
  - **Cancellation** — mid-flight abort rejects the promise; pre-aborted signal rejects immediately
  - **Generic `on()`** — fan-out to multiple handlers, unregister, coexistence with `subscribeResource`'s resource-updated path

  MCP total: **155 passing / 5 skipped** (was 147 after PR-0.2).

  Stage 0 is now closed. Stage 1 (Streamable HTTP transport + dual-mode first-party servers) is the next unit of work. See `.jv/docs/mcp-productionization-scope.md`.

- 4dd26d8: Add Streamable HTTP transport support — Stage 1 PR-1.1 of the MCP v1 plan. Opens the door to remote MCP servers (admin-as-client, agent-runtime-as-client, and in v1.1 the RevMarket third-party marketplace).

  ### Client-side

  `McpClient`'s transport discriminated union extends with:

  ```ts
  new McpClient({
    clientInfo: { name, version },
    transport: {
      kind: "streamable-http",
      url: "https://example.com/mcp",
      requestInit, // optional Fetch RequestInit (headers, credentials, …)
      fetch, // optional custom fetch
      sessionId, // optional resumption token
      reconnectionOptions, // SSE reconnection tuning
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
  import { createServer as createHttpServer } from "node:http";
  import { createNodeStreamableHttpHandler } from "@revealui/mcp/streamable-http";

  const handler = createNodeStreamableHttpHandler({
    createServer: () => makeRevealUiContentServer(),
    onSessionInitialized: (id) =>
      logger.info({ sessionId: id }, "MCP session opened"),
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

- c22b22d: Establish the Stage 1 PR-1.2 dual-mode template by refactoring `revealui-content` — the first of 13 first-party MCP servers — to be transport-agnostic. The remaining 12 servers port to the same shape in follow-up PRs.

  ### Pattern

  Each first-party server splits into two files:

  | File                                | Role                                                                                                                                                          |
  | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `servers/factories/<name>.ts` (new) | Exports `create<Name>Server(): Server` + `setCredentials(creds)`. Pure factory, no transport coupling.                                                        |
  | `servers/<name>.ts` (refactored)    | Thin stdio launcher. Imports the factory, connects to `StdioServerTransport`, runs as subprocess. Shebang preserved; hypervisor `spawn()` pipeline unchanged. |

  Consumers who need HTTP hosting (admin dashboard, agent runtime, the future Streamable HTTP binary launcher) import the factory directly and wrap it via `createNodeStreamableHttpHandler` from `@revealui/mcp/streamable-http` (PR-1.1).

  ### This PR ships

  - **`packages/mcp/src/servers/factories/revealui-content.ts`** — new. Owns the 5 tools (`revealui_list_sites`, `revealui_list_content`, `revealui_get_content`, `revealui_list_users`, `revealui_site_stats`), credential override mechanism, and REST-proxy helpers. Lives under `servers/factories/` so the `claim-drift` validator's MCP server counter (which reads only the top-level `servers/` directory) doesn't mis-count shared infrastructure as a standalone server.
  - **`packages/mcp/src/servers/revealui-content.ts`** — refactored from 314 → 37 lines. Still the canonical stdio entry point. Re-exports `setCredentials` for hypervisor compatibility.
  - **`createRevealuiContentServer` + `setRevealuiContentCredentials`** exported from `@revealui/mcp` top-level. External consumers can instantiate + wire credentials without importing from an internal path.

  ### Testing

  3 new integration cases in `packages/mcp/__tests__/revealui-content-factory.integration.test.ts` — factory + `createNodeStreamableHttpHandler` + real HTTP server + `McpClient` + mock upstream REST API:

  - Client initializes + discovers the `tools` capability over HTTP
  - Tool call proxies through: `McpClient → HTTP handler → factory-created Server → mock REST API`; result body + `_meta` propagated correctly; mock API sees the `Authorization: Bearer …` header
  - Missing credentials → tool returns structured error (`isError: true`) with the canonical "REVEALUI_API_URL and REVEALUI_API_KEY must be set" message

  MCP total: **164 passing / 5 skipped** (was 161 after PR-1.1).

  ### Follow-ups

  The remaining 12 first-party servers port to this pattern in subsequent PRs — same shape per server:

  1. Move the Server instance + handlers into `<name>-factory.ts`, exposing `create<Name>Server()`
  2. Reduce `<name>.ts` to ~35 lines (stdio-only shell)
  3. Export factory from `@revealui/mcp`

  Servers pending port: `code-validator`, `neon`, `next-devtools`, `playwright`, `revealui-email`, `revealui-memory`, `revealui-stripe`, `stripe`, `supabase`, `vercel`, `vultr-test`, `_email-provider`.

  See `.jv/docs/mcp-productionization-scope.md` for the full v1 plan.

- 95cd94b: Add OAuth 2.1 client support — Stage 2 PR-2.1 of the MCP v1 plan. Remote MCP
  servers can now be authorized end-to-end without hand-rolling the flow.

  - `McpOAuthProvider` implements the SDK's `OAuthClientProvider` interface:
    Authorization Code + PKCE, Dynamic Client Registration (RFC 7591), and
    automatic refresh with OAuth 2.1 §4.12 refresh-token rotation handled
    transparently.
  - `Vault` abstracts durable credential storage. `createRevvaultVault()`
    (default) shells out to the `revvault` CLI and persists under
    `mcp/<tenant>/<server>/{tokens,client,verifier,discovery}`. `createMemoryVault()`
    is provided for tests and ephemeral flows.
  - `StreamableHttpTransportOptions.authProvider` wires a provider into
    `StreamableHTTPClientTransport`; the SDK drives discovery, DCR, PKCE, and
    refresh from there. `McpClient.finishAuth(code)` delegates to the transport
    to complete the code-for-token exchange after the user returns from consent.
  - Importable from `@revealui/mcp` (top level) or `@revealui/mcp/oauth`.

- 1aa36b1: Stage 3.1 of the MCP v1 plan — admin-side server catalog for OAuth-authorized
  remote servers plus a disconnect action.

  **`@revealui/mcp`:**

  - `Vault.list(prefix)` on the core interface. Returns every path under
    `prefix`. `createRevvaultVault()` shells out to `revvault list <prefix>`
    and parses line-oriented output; `createMemoryVault()` implements the
    same semantics over its `Map`. Enables catalog tooling to enumerate
    configured servers without an out-of-band registry.

  **admin:**

  - `GET /api/mcp/remote-servers?tenant=X` — enumerates OAuth-authorized
    servers for a tenant by walking `mcp/<tenant>/<server>/tokens`. Returns
    `{ tenant, server, connectionState: 'connected' }[]`. Reserved tenant
    segments (e.g. `oauth`) are rejected.
  - `POST /api/mcp/remote-servers/[server]/disconnect` — revokes every
    credential path for `(tenant, server)` via
    `McpOAuthProvider.invalidateCredentials('all')`. Idempotent.
  - `/admin/mcp` — server catalog page. Lists built-in servers (shared
    endpoint with `/admin/agents` MCP tab) plus remote servers for the
    entered tenant, with disconnect action and a "Connect new server"
    link to the existing `/admin/mcp/connect` flow.

- 17f2912: Stage 3.2 of the MCP v1 plan — tool browser + ad-hoc invoker for connected
  remote MCP servers. Builds on Stages 2 + 3.1.

  **`@revealui/mcp`:**

  - `McpClient.listTools()` and `callTool(name, arguments?)` — full-protocol
    tool coverage, following the Stage 0 pattern (capability-gated,
    per-request options threaded through). Tool failures surface in-band
    (`isError: true, content: [...]`) rather than throwing — transport-level
    failures still throw. Stage 0 deliberately skipped tools because the
    hypervisor handled stdio tool calls through its own JSON-RPC; Stage 3.2
    needs them for remote HTTP servers.
  - `Tool` and `CallToolResult` types exported.
  - New `@revealui/mcp/client` subpath export — admin/edge consumers can
    import the client surface without pulling in the stdio launcher scripts
    that auto-execute and call `checkMcpLicense()` during bundling.

  **admin:**

  - OAuth callback now writes a non-credential meta record at
    `mcp/<tenant>/<server>/meta` (`serverUrl` + `connectedAt` + `connectedBy`)
    so subsequent tool calls know where to connect. Best-effort — tokens
    remain the load-bearing state.
  - `lib/mcp/remote-server-client.ts` — helper that rebuilds an `McpClient`
    from stored credentials for a given `(tenant, server)`.
  - Three new per-server routes:
    - `GET /api/mcp/remote-servers/[server]/tools?tenant=X` — lists tools.
    - `POST /api/mcp/remote-servers/[server]/call-tool` — invokes a tool.
    - `POST /api/mcp/remote-servers/[server]/complete` — prompt / resource
      argument completions (the completions protocol is for prompts +
      resource templates, not tool arguments).
  - `/admin/mcp/inspect?tenant=X&server=Y` — tool browser page. Renders each
    tool's `inputSchema` as a form (best-effort: strings, numbers, booleans,
    enums, JSON for complex types), invokes the tool, displays the
    `CallToolResult` content blocks.
  - Catalog page (`/admin/mcp`) gets a per-row "Inspect" link.

- 0eb6f62: Delete the raw-SQL `CRDT_TABLE_SQL` bootstrap from `connectPglite()` and `connectPostgres()`.

  These factories previously executed a `CREATE TABLE IF NOT EXISTS crdt_operations (...)` statement at connect time with a document-oriented shape (`document_id`, `vector_clock`, `applied_at`) that conflicted silently with the operation-log shape (`crdt_id`, `crdt_type`, `timestamp`) that `@revealui/db` migrates into the same-named table. No MCP server invokes the factories today, but the collision was a real latent failure mode for any external caller.

  **Breaking behavior:** after upgrade, `connectPglite()` / `connectPostgres()` / `createMcpDbClient()` no longer bootstrap any tables. Callers must apply drizzle-kit migrations (or the PGlite equivalent) before issuing queries. There are no known external consumers.

  **Removed type re-exports:** `CrdtOperationsInsert` and `CrdtOperationsRow` are no longer re-exported from `@revealui/mcp` or `@revealui/mcp/db`. They were Drizzle-`crdt_operations`-shaped typings that did not match the document-oriented SQL the adapter actually ran — keeping them around was a type-checker lie. Import the canonical types from `@revealui/contracts` directly if still needed.

  See `.jv/docs/mcp-crdt-reconciliation-design.md` for the full Phase 3b design. Two follow-up PRs land the replacement:

  - **3b.2** — add `mcp_document_operations` as a Drizzle-tracked schema + migration.
  - **3b.3** — rewire MCP's integration test to the new table and re-export typed helpers.

- 3d09425: Stage 4.1 of the MCP v1 plan — expose RevealUI content as MCP resources.
  First cut of the content-pipeline-as-resources arc; the admin UI opt-out
  toggle + `revealui://<tenant>/…` URI scheme land with Stage 4.2.

  **`@revealui/contracts`:**

  - `CollectionStructure.mcpResource?: boolean` — declarative opt-out for
    exposing a collection's rows to MCP clients. Default behavior (when
    absent) is to expose. Added to both the TypeScript interface and the
    `CollectionStructureSchema` Zod schema.

  **`@revealui/mcp`:**

  - `revealui-content` server advertises the `resources` capability.
  - `resources/list` walks a curated default set (`posts`, `pages`,
    `products`, `media`) and returns one resource per row under the URI
    scheme `revealui-content://<collection>/<id>`. Partial upstream
    failure is tolerated — an unavailable collection doesn't blank the
    rest of the list.
  - `resources/read` parses the URI, fetches the record from
    `/api/<collection>/<id>`, and returns the JSON verbatim as an
    `application/json` text block.
  - Malformed URIs + collections outside the default set throw with
    clear messages.

  5 new integration tests (mcp: 195 → 200 passing / 5 skipped). The
  curated default set is the minimum-viable surface — collection-config
  introspection (which consults `mcpResource`) lands with Stage 4.2
  alongside the admin UI toggle.

- 387200e: A.1 of the post-v1 MCP arc — first production consumer of Stage 5 + Stage 6
  primitives at `/api/agent-stream`. `usage_meters` rows now flow for real
  agent runs whose session resolves to a billing account, and MCP protocol
  events land in the central log aggregator.

  **`@revealui/mcp`:**

  - New `@revealui/mcp/remote-client` export. Extracts the admin-local
    `buildRemoteMcpClient` + adds `listConnectedMcpServers(vault, tenant)` so
    the API app can discover a tenant's OAuth-authorized servers and connect
    to them without duplicating admin code.

  **`api`:**

  - New `apps/server/src/lib/metering.ts` — `recordUsageMeter()` thin writer
    around `db.insert(usageMeters).values(row).onConflictDoNothing()`.
    `@revealui/db` stays schema-only.
  - `apps/server/src/routes/agent-stream.ts` resolves the tenant (from
    `X-Tenant-ID` via `tenantMiddleware`) and the `accountId` (from the
    global `entitlementMiddleware`), builds `McpClient`s for every
    OAuth-authorized server the tenant has, merges those tools into the
    agent's tool list, and composes an `onEvent` sink that fans Stage 6.1
    protocol events into `createCoreLoggerSink()` plus — when `accountId`
    is known — `createUsageMeterSink({ accountId, write: recordUsageMeter })`.
  - Safe fallbacks hold the existing behavior when a request has no tenant
    or no active account membership: empty `mcpClients`, logger-only sink.
  - MCP clients opened during the request are closed in the streamSSE
    finally so sockets + OAuth-refresh timers don't leak.

  **`admin`:**

  - `apps/admin/src/lib/mcp/remote-server-client.ts` becomes a re-export
    shim pointing at `@revealui/mcp/remote-client`; existing admin route
    imports keep working untouched.
  - `apps/admin/src/app/api/mcp/remote-servers/route.ts` consumes the
    shared `listConnectedMcpServers` helper instead of the inline
    enumeration.

- 4700845: A.2a of the post-v1 MCP arc — wire Stage 5.2 sampling handler into agent-stream.

  When an OAuth-authorized MCP server connected to an agent run at
  `/api/agent-stream` requests `sampling/create`, the handler now routes the
  request through the configured LLM (defaulting to Canonical Inference Snap
  via `INFERENCE_SNAPS_BASE_URL` env precedence). Model-hint allowlist guards
  against servers routing us to expensive models.

  **`@revealui/mcp`:**

  - `BuildRemoteMcpClientOptions.samplingHandler?: SamplingHandler` — new
    pass-through slot on `buildRemoteMcpClient` that forwards to the
    `McpClient` constructor (the slot already existed on `McpClient`; A.2a
    exposes it to callers via `@revealui/mcp/remote-client`).

  **`api`:**

  - `apps/server/src/routes/agent-stream.ts` — per connected MCP server, build
    a sampling handler via `aiMod.createSamplingHandler({ llm: llmClient,
allowedModels, defaultModel, namespace: server, onEvent })` and pass
    to `buildRemoteMcpClient`. Same `onEvent` sink as A.1's tool adapters,
    so Stage 6.1 logger + Stage 6.2 `usage_meters` capture
    `mcp.sampling.create` events alongside tool calls.

- 01a3166: Remove parallel migration pipeline and unused Postgres idempotency store (Phase 3a of the raw-SQL migration plan).

  **Breaking changes:**

  - `createPostgresIdempotencyStore` and the `@revealui/mcp/stores/postgres` subpath export are removed. The store had no internal consumers, a schema that diverged from the canonical `@revealui/db`'s `idempotency_keys` table, and a lazy `CREATE TABLE` that sidestepped drizzle-kit. Future MCP-owned idempotency needs should be built on the tracked Drizzle schema.

  **Non-breaking cleanups:**

  - `packages/mcp/migrations/0001_add_crdt_columns.sql`, `0001_rollback.sql`, and `backfill_crdt_meta.js` are deleted. They targeted `documents` / `subscription_state` tables that have never existed in the RevealUI schema, were invoked by no CI/CD or deploy path, and could not have run successfully in any environment.
  - `packages/mcp/migrations/005_performance_indexes.sql` is retained — its indexes target core RevealUI tables (users, posts, sessions, media, …) and will be ported into the main Drizzle schema as proper `index()` definitions in a follow-up. Tracked in `.jv/docs/raw-sql-migration-plan.md`.

  **Version bump rationale:**

  Removing a publicly exported subpath + function from a pre-1.0 package. Per the SemVer + pre-1.0 policy, this is a minor bump (0.1.11 → 0.2.0).

- 7b481c8: F8 Phase 3 Stage 1 — Contracts OpenAPI mirror codegen pipeline.

  `@revealui/openapi` (0.2.3 → 0.3.0):

  - New `scripts/emit-from-mcp.ts` emits a contracts-types-only OpenAPI 3.1 doc from the contracts MCP server's catalog
  - New committed reference `packages/openapi/contracts.openapi.json` (109 components from 17 categories)
  - New `pnpm emit:contracts` and `pnpm check:contracts` package scripts
  - New CI gate `Contracts OpenAPI mirror drift` (hard-fail) wired into `pnpm gate` Phase 1
  - Added 23 unit tests in `src/__tests__/emit-from-mcp.test.ts` (deterministic output, schema completeness, OpenAPI 3.1 conformance, regression pins for PR #731's contracts surface)
  - README section "Contracts mirror — cross-language codegen pipeline"

  `@revealui/mcp` (0.3.0 → 0.4.0):

  - New public exports `getContractsCatalog()` and `ContractCategoryName` / `ContractCategorySchemas` types from `@revealui/mcp/contracts-server`
  - The factory's previously-private `buildJsonSchemaCache` is refactored into the public `getContractsCatalog`; the contracts MCP server still calls it internally — single source of truth for the JSON Schema catalog
  - Bypasses the package's index.ts barrel (consumers import via `@revealui/mcp/contracts-server` to avoid triggering other server launchers' license-check side effects on import)

  Stages 2 (apps/server `/openapi.json` route exposing the contracts doc) and 3 (revdev/apps/console oapi-codegen + revvault Rust progenitor consumer wiring) are deferred to follow-on PRs — Stage 1 is complete-on-its-own infrastructure.

  Per [`docs/decisions/2026-05-03-contracts-protocol-pyramid.md`](https://github.com/RevealUIStudio/revealui-jv/blob/main/docs/decisions/2026-05-03-contracts-protocol-pyramid.md) §"Phase 3" in the internal `revealui-jv` repo.

### Patch Changes

- dbf405a: Restore typed helpers for the `mcp_document_operations` table and rewire the integration test to target it.

  - `McpDocumentOperationsInsert` and `McpDocumentOperationsRow` are re-exported from `@revealui/mcp` (and `@revealui/mcp/db`). These are the Drizzle-generated source-of-truth types from the schema landed in PR-3b.2, so consumers get column-accurate typing without a separate `@revealui/contracts` import.
  - `packages/mcp/__tests__/crdt.integration.test.ts` renamed to `packages/mcp/__tests__/mcp-document-operations.integration.test.ts`. The dormant skip-by-default integration block is restored and all queries retargeted from `crdt_operations` to `mcp_document_operations`. A new `applied_at` marker test documents the idempotent-replay semantic. The block activates when `TEST_DATABASE_URL` points at a Postgres with the `0009_mcp_document_operations` migration applied; otherwise it skips, keeping `pnpm test` hermetic.

  Closes Phase 3b of the raw-SQL migration arc. Design doc: `.jv/docs/mcp-crdt-reconciliation-design.md`.

- Updated dependencies [54557b7]
- Updated dependencies [6afae69]
- Updated dependencies [f7ea9b4]
- Updated dependencies [ad6aa4c]
- Updated dependencies [0eb3131]
- Updated dependencies [25dba49]
- Updated dependencies [9a6ebb3]
- Updated dependencies [47c75fe]
- Updated dependencies [a8ca087]
- Updated dependencies [1f7ae24]
- Updated dependencies [f56d3d3]
- Updated dependencies [f8199c8]
- Updated dependencies [b0bab95]
- Updated dependencies [3ff25bb]
- Updated dependencies [af12683]
- Updated dependencies [37952d2]
- Updated dependencies [dbf405a]
- Updated dependencies [3d09425]
- Updated dependencies [2eb63dc]
- Updated dependencies [5479d59]
  - @revealui/contracts@0.5.0
  - @revealui/core@0.7.0
  - @revealui/config@0.4.1
  - @revealui/security@0.3.1

## 0.1.11

### Patch Changes

- Updated dependencies [80cc561]
- Updated dependencies [77a9a68]
- Updated dependencies [284fd1f]
- Updated dependencies [f6ba434]
- Updated dependencies [0e459ca]
- Updated dependencies [59c670b]
- Updated dependencies [2204021]
- Updated dependencies [f6ba434]
  - @revealui/core@0.6.0
  - @revealui/config@0.4.0
  - @revealui/contracts@1.4.0

## 0.1.10

### Patch Changes

- Complete CRDT implementation with sync, replay, and GC. MCP default reply-to from env var. Autonomous agent architecture phases 2-3.
- Updated dependencies
- Updated dependencies
  - @revealui/config@0.3.4
  - @revealui/core@0.5.6
  - @revealui/contracts@1.3.7

## 0.1.9

### Patch Changes

- 0f195e4: SDLC hardening, content overhaul, and cms→admin rename.

  - Promote all CI quality checks from warn-only to hard-fail
  - Kill banned phrases across 58 files (headless CMS → agentic business runtime)
  - Rename apps/cms to apps/admin throughout the codebase
  - Remove proprietary AI providers (Anthropic, OpenAI direct) — keep OpenAI-compatible base
  - Add Gmail-first email provider to MCP server (Resend deprecated)
  - Fix CodeQL security alerts (XSS validation, path traversal guard, prototype-safe objects)
  - Align all coverage thresholds with actual coverage
  - Add 4 ADRs (dual-database, Fair Source licensing, session-only auth, two-repo model)

- Updated dependencies [0f195e4]
  - @revealui/core@0.5.5
  - @revealui/contracts@1.3.6
  - @revealui/config@0.3.3

## 0.1.8

### Patch Changes

- add PGlite adapters for rate limiter, circuit breaker, and cache invalidation channel with atomic rate limit checks and backslash escaping fix
- Updated dependencies
- Updated dependencies
  - @revealui/core@0.5.4
  - @revealui/contracts@1.3.5
  - @revealui/config@0.3.2

## 0.1.7

### Patch Changes

- f6a81c7: Add engines field and update doc comments to reference PGlite/ElectricSQL instead of Redis

## 0.1.6

### Patch Changes

- fix: security hardening, CodeQL fixes, docs, and dependency cleanup

  - Replace regex with string methods across source code (CodeQL)
  - Harden CLI content pull and remove trivial conditionals
  - Fix router dependency (core → utils) to resolve DTS build OOM
  - Add migration 0006 indexes for agent_actions, crdt_operations, boards, ticket_labels
  - Remove legacy Supabase-era billing handlers from services
  - Re-export agentMemories from db schema for published @revealui/ai compat
  - Add publishConfig.registry consistency to editors, mcp, services
  - Add READMEs and JSDoc across all packages

- Updated dependencies
  - @revealui/config@0.3.1
  - @revealui/contracts@1.3.4
  - @revealui/core@0.5.3

## 0.1.5

### Patch Changes

- @revealui/contracts@1.3.3
- @revealui/core@0.5.2

## 0.1.4

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.3.2
  - @revealui/core@0.5.1

## 0.1.3

### Patch Changes

- Migrate to MIT license (open-core model)
- Updated dependencies
  - @revealui/core@0.5.0

## 0.1.2

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/core@0.4.0
  - @revealui/contracts@1.3.1
