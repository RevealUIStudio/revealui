---
'@revealui/harnesses': minor
---

Finish the VAUGHN → Harness Protocol rename: drop transitional aliases (no external consumers found) and split adapter-less profiles into `ROADMAP_PROFILES` for structural visibility.

0.4.0 left three transitional carry-overs to protect against a phantom daemon consumer — `vaughn.*` RPC method names, a `VAUGHN_AGENT_ID` env-var fallback with deprecation warning, and a `/tmp/vaughn-session-<ppid>.id` cache-file fallback. A post-publish audit (`grep` across the entire fleet, including revdev, hooks, shell configs, `.jv/`) confirmed **none had any external consumer**. The deprecation pattern was carrying weight for nothing. 0.5.0 removes the aliases for a clean final state.

**Breaking — RPC method names:** `vaughn.capabilities` / `vaughn.dispatch` / `vaughn.events` / `vaughn.config.sync` → `protocol.*` (same handlers, new wire names).

**Breaking — env var:** `VAUGHN_AGENT_ID` is no longer read. Use `PROTOCOL_AGENT_ID`.

**Breaking — session cache file:** `/tmp/vaughn-session-<ppid>.id` is no longer read. New path `/tmp/protocol-session-<ppid>.id` is used exclusively.

**Breaking — `TOOL_PROFILES` shape:** previously contained four entries (claude-code, codex, cursor, revealui-agent). Now contains only `revealui-agent` (the only tool with a working adapter). The three adapter-less entries moved to a new `ROADMAP_PROFILES` export from `@revealui/harnesses/protocol`. A merged view `ALL_KNOWN_PROFILES` is also exported for callers that want capability data for any known tool ID. `HarnessCoordinator.dispatchTask` consults explicit registered capabilities first, then `TOOL_PROFILES`, then `ROADMAP_PROFILES`, so dispatch behavior is preserved for callers that register stub adapters for unimplemented tools.

**Migration:** rename `vaughn.*` RPC calls to `protocol.*`; rename `VAUGHN_AGENT_ID` env var to `PROTOCOL_AGENT_ID`; import unimplemented-tool profiles from `ROADMAP_PROFILES` (or `ALL_KNOWN_PROFILES`) instead of `TOOL_PROFILES`.
