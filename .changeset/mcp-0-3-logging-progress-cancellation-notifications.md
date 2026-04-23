---
'@revealui/mcp': minor
---

Close Stage 0 of the MCP v1 plan. Extends `McpClient` with the transport-level protocol primitives: logging, progress, cancellation, and generic notification routing. With this PR merged, `@revealui/mcp` speaks the full MCP client surface defined by the current spec.

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
