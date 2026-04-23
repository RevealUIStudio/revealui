---
'@revealui/mcp': minor
---

Add `McpClient` — a typed wrapper around `@modelcontextprotocol/sdk`'s `Client` class, scoped to the resources + prompts protocol surface (Stage 0 PR-0.1 of the MCP v1 plan).

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
