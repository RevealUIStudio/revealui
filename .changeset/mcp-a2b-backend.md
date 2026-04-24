---
'@revealui/ai': minor
---

A.2b-backend of the post-v1 MCP arc — wire Stage 5.3 elicitation handler
into agent-stream + emit side-channel SSE chunks for
sampling/elicitation. The backend plumbing the A.2b-frontend UI will sit
on top of.

When an MCP server connected to an in-flight `/api/agent-stream` run
calls `elicitation/create`, the handler now:

1. Writes an `elicitation_request` chunk to the SSE stream with
   `{ sessionId, elicitationId, requestedSchema, message, namespace }`.
2. Parks on the in-memory agent-run session registry until a matching
   `POST /api/agent-stream/elicit` resolves the pending promise.
3. Returns the user's decision to the MCP server so the tool call can
   continue.

Sampling requests (wired in A.2a) now also emit a `sampling_request`
chunk before running the LLM for observability.

**`@revealui/ai`:**
- Extend `AgentStreamChunk` with three side-channel types:
  `session_info`, `sampling_request`, `elicitation_request`. Adds
  `sessionId`, `namespace`, `sampling`, and `elicitation` optional
  fields to carry side-channel payloads. Runtime-level emission is
  unchanged — the generator still yields only the core turn events
  (`text`, `tool_call_start`, `tool_call_result`, `error`, `done`).
  Side-channel chunks are written directly by route-level handlers.

**`api`:**
- `apps/api/src/lib/agent-run-sessions.ts` (new) — process-local
  registry of `(sessionId, elicitationId) → pending Promise<ElicitResult>`.
  Adapted from Stage 3.4's admin-side `call-sessions.ts`, scoped to
  agent-run lifecycle rather than per-tool-invocation. Exports:
  `createAgentRunSession`, `getAgentRunSession`, `awaitElicitationResponse`,
  `resolveElicitation`, `deleteAgentRunSession` (plus a test-only
  `_resetAgentRunSessions`).
- `apps/api/src/routes/agent-stream-elicit.ts` (new) —
  `POST /api/agent-stream/elicit` endpoint. Body
  `{ sessionId, elicitationId, action: 'accept'|'decline'|'cancel',
  content? }`. Enforces `session.userId === c.var.user.id`. 404 on
  unknown session or elicitation id; 403 on user mismatch; 401 on
  unauthenticated.
- `apps/api/src/routes/agent-stream.ts` —
  - Create `runSession = createAgentRunSession(user.id)` before
    MCP-client construction; tear down in the streamSSE `finally`.
  - Declare `streamRef: { current: SSEStreamingApi | undefined }` as a
    late-binding mutable reference so per-server elicitation/sampling
    handlers (built before `streamSSE()` starts) can write into the
    stream once it exists.
  - Wrap the A.2a sampling handler with a chunk-emit wrapper writing a
    `sampling_request` chunk before calling the inner handler.
  - Build a per-server `elicitationHandler` that writes an
    `elicitation_request` chunk + parks on the run-session registry;
    falls back to `{ action: 'cancel' }` when the stream isn't yet
    bound or when the registry entry disappears mid-flight.
  - First SSE chunk is `session_info` so the client learns the
    `sessionId` to POST back to `/api/agent-stream/elicit`.
- `apps/api/src/index.ts` — mount the new route at
  `/api/agent-stream/elicit` (canonical + `/api/v1/…` alias), before
  the parent `/api/agent-stream` mount so the trie-based router matches
  the more-specific prefix first. CSRF (`writeProtected`) applied to
  the new POST.
