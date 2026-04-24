---
'@revealui/ai': minor
---

A.2b-frontend of the post-v1 MCP arc — first user-visible Stage 5 surface.

New `/admin/agents/[agentId]/run` page consumes the `/api/agent-stream`
SSE backend (A.1 + A.2a + A.2b-backend) and renders chunks live: tool
calls, sampling requests, and inline elicitation forms. Mid-run when a
connected MCP server requests user input via `elicitation/create`, the
page renders an inline form derived from `requestedSchema` and POSTs the
response to `/api/agent-stream/elicit` (A.2b-backend's endpoint).

**`@revealui/ai`:**
- Extend `useAgentStream` (`packages/ai/src/client/hooks/useAgentStream.ts`)
  with the three side-channel chunk types from A.2b-backend (`session_info`,
  `sampling_request`, `elicitation_request`) plus the optional payload
  fields (`sessionId`, `namespace`, `sampling`, `elicitation`).
- Track `sessionId` in hook state when the leading `session_info` chunk
  arrives. Track outstanding form-mode elicitation requests in
  `pendingElicitations` (a `PendingElicitation[]`).
- New `submitElicitation(elicitationId, action, content?)` method —
  POSTs to `/api/agent-stream/elicit` with the resolved `sessionId` +
  removes the entry from `pendingElicitations` on success. Throws if
  called before `start()` resolves a sessionId, or if the server
  returns non-2xx.
- Pure `applyChunk(state, chunk)` reducer extracted for test-friendliness
  + exported as `_applyChunkForTesting`. Pending elicitations are
  cleared on `done`/`error` so stale forms don't sit on screen after the
  stream tears down.
- 12 new tests covering the chunk reducer + the submitElicitation
  round-trip + error paths. `@revealui/ai` 951 → 963 passing.

**`admin`:**
- New page `apps/admin/src/app/(backend)/admin/agents/[agentId]/run/page.tsx`.
  Submit-an-instruction form, status bar (streaming/idle/error +
  sessionId + chunk count), pending-elicitations stack rendered as
  inline forms, accumulated `text` panel, full event log with
  per-event-type rows. Cancel button uses `useAgentStream.abort`. Reset
  clears state for a fresh run.
- Extracted `ElicitationForm` + `ArgumentField` from Stage 3.4's
  `StreamingToolCard` into a new shared component
  `apps/admin/src/lib/components/mcp/elicitation-form.tsx`. The form
  now accepts a flat `(message, requestedSchema, onSubmit)` shape so
  it's reusable across the inspector flow and the agent-run flow.
  `StreamingToolCard` updated to import the extracted component;
  zero behavior change for the inspector. The Stage 3.4 inspector
  tests stay green.
- Added a "Watch live ↗" link button to the Task Tester card on the
  agent detail page (`page.tsx`), routing to the new `/run` page.
  `TaskTester` itself unchanged — coexists as a polling A2A fallback.

**Discipline notes:**
- Boundary validation continues to pass — admin imports `useAgentStream`
  via the `@revealui/ai/client/hooks/useAgentStream` subpath which is
  already the existing module path; no new static imports of
  `@revealui/ai` from admin code.
- `pendingElicitations` is cleared on `done` and `error` so a stream
  teardown can't leave a phantom form on screen — matches the
  registry's `deleteAgentRunSession` cancel-on-cleanup semantics.
- Malformed `requestedSchema` (e.g. missing `properties`) degrades to
  an empty-fields form rather than a render error; user can still
  decline/cancel.
