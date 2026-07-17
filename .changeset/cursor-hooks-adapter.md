---
"@revealui/harnesses": minor
---

add a normalized hook-event schema, a `hook <source>` CLI subcommand (spool-only mode), and a Cursor adapter, following the multi-editor harness design: `HarnessHookEvent` normalizes Cursor and Claude Code hook payloads into one internal shape (identity fields stay session-scoped only, never editor-supplied human identity); the CLI subcommand normalizes stdin, evaluates a local policy snapshot, emits the editor-native allow/deny/ask response, and spools an append-only receipt (server-side flush lands in a later change, so this ships spool-only behind explicit config); `CursorAdapter` promotes the existing data-only `cursor` profile into `TOOL_PROFILES` (mirroring the OpenCode adapter promotion) with `.cursor/hooks.json` and `.cursor/mcp.json` generators, the latter using Cursor's `${env:VAR}` reference syntax so no token value is ever emitted.
