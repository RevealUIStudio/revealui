---
'@revealui/mcp': minor
---

Extend `McpClient` (shipped in PR-0.1) with the second slice of Stage 0 protocol coverage: sampling, elicitation, roots, and completions.

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
