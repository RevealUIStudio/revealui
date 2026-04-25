---
'admin': minor
---

Stage 3.4 of the MCP v1 plan — closes Stage 3. Adds the three server-push
surfaces to the inspector: inline elicitation forms, progress bars with
cancel, and a live log stream viewer.

**Routes:**
- `POST /api/mcp/remote-servers/[server]/call-tool-stream` — SSE streaming
  tool invoker. Emits `session`, `log`, `progress`, `elicitation`,
  `result`, and `error` events as they happen. Aborting the fetch
  forwards an AbortSignal to the SDK transport, which emits
  `notifications/cancelled` on the wire.
- `POST /api/mcp/remote-servers/[server]/elicitation-respond` — resolves
  a pending `elicitation/create` request on an active streaming session.
  Body: `{ sessionId, elicitationId, action: 'accept'|'decline'|'cancel',
  content? }`. One-shot; session-ownership bound.
- `GET /api/mcp/remote-servers/[server]/log-stream?tenant=X&level=info` —
  opens a long-lived SSE connection that sets the remote server's log
  level and forwards every `notifications/message` to the browser.

**Internals:**
- `lib/mcp/call-sessions.ts` — in-memory session registry bridging the
  streaming route (which creates a session + registers pending
  elicitations) to the respond route (which looks them up by session id
  and resolves the matching promise). Tears down cleanly on client
  disconnect — every outstanding elicitation is auto-cancelled.
- `buildRemoteMcpClient({ …, elicitationHandler })` option on the admin
  helper.

**UI:**
- `/admin/mcp/inspect` Tools tab now uses `StreamingToolCard`: surfaces
  a progress bar during the call, a cancel button, an inline
  elicitation form rendered from the server's `requestedSchema`, and a
  collapsible per-call log panel. Tools that don't emit progress or
  elicitation work unchanged — the final result simply arrives with no
  prior events.
- New **Logs** tab (fourth in the inspector) — live-tails
  `notifications/message` from the server with a level selector, cap
  of 500 entries, and start/stop/clear controls.

**Stage 2 + 3 complete** with this PR. Remaining MCP v1 stages: 4
(content pipeline as MCP resources), 5 (agent runtime consumes full
protocol), 6 (protocol-level observability + usage metering).

14 new tests (admin: 1571 → 1585 passing / 10 skipped).
