# @revealui/harnesses

## 0.6.4

### Patch Changes

- Updated dependencies [6ac1c0d]
  - @revealui/core@0.10.2

## 0.6.3

### Patch Changes

- Updated dependencies [ff8096d]
- Updated dependencies [ed45978]
  - @revealui/core@0.10.1

## 0.6.2

### Patch Changes

- Updated dependencies [553a981]
- Updated dependencies [763e4f1]
- Updated dependencies [ebbe445]
- Updated dependencies [a3dcac3]
- Updated dependencies [8024933]
  - @revealui/core@0.10.0

## 0.6.1

### Patch Changes

- Updated dependencies [f8c74e6]
- Updated dependencies [ba61b20]
- Updated dependencies [6545491]
  - @revealui/core@0.9.0

## 0.6.0

### Minor Changes

- 23aa094: Rename VAUGHN protocol → Harness Protocol. Trim companion spec doc to match shipping reality.

  The 2026-05-18 audit found the original VAUGHN spec oversold what the code actually shipped — one working adapter for the RevealUI Agent, plus static capability-profile data for three tools (Claude Code, Codex, Cursor) that have no adapter wrapping them. The founder-name backronym also read as a vanity stamp on engineering documentation. Renamed to "Harness Protocol" — matches the existing `@revealui/harnesses` package name and the existing `HarnessAdapter` / `HarnessCoordinator` types. See `docs/HARNESS_PROTOCOL.md` for the trimmed, honestly-scoped spec (714 → ~200 lines).

  **Breaking — code symbols renamed** (1:1 mapping):

  - All `Vaughn*` types → `Protocol*` (`VaughnAdapter`, `VaughnAdapterInfo`, `VaughnCapabilities`, `VaughnCommand`, `VaughnCommandResult`, `VaughnConfig`, `VaughnError`, `VaughnErrorCode`, `VaughnEvent`, `VaughnEventEnvelope`, `VaughnRule`, `VaughnSkill`)
  - Constants: `VAUGHN_VERSION` → `PROTOCOL_VERSION`, `VAUGHN_EVENTS` → `PROTOCOL_EVENTS`
  - Schemas: `vaughnEventSchema` → `protocolEventSchema`, `vaughnEventEnvelopeSchema` → `protocolEventEnvelopeSchema`
  - Class `VaughnEventNormalizer` → `EventNormalizer`
  - Config functions: `vaughnConfigTo*` → `protocolConfigTo*`, `claudeSettingsToVaughnConfig` → `claudeSettingsToProtocolConfig`
  - `HarnessCoordinator.registerVaughnCapabilities` → `registerProtocolCapabilities`
  - `RpcServer.setVaughnDispatch` → `setProtocolDispatch`, `RpcServer.pushVaughnEvent` → `pushProtocolEvent`
  - `RevealUIAgentAdapter.getVaughnCapabilities` → `getProtocolCapabilities`, `onVaughnEvent` → `onProtocolEvent`

  **Breaking — package subpath export:** `@revealui/harnesses/vaughn` → `@revealui/harnesses/protocol`.

  **Breaking — env var:** `VAUGHN_AGENT_ID` → `PROTOCOL_AGENT_ID`. Legacy variable still read as a fallback with a one-time deprecation warning on stderr.

  **Breaking — session-cache file path:** `/tmp/vaughn-session-<ppid>.id` → `/tmp/protocol-session-<ppid>.id`. Legacy path still read as a fallback.

  **Preserved for wire-format stability:** JSON-RPC method names `vaughn.capabilities`, `vaughn.dispatch`, `vaughn.events`, `vaughn.config.sync` are unchanged so existing daemon consumers (notably revdev) keep working. A coordinated rename to `protocol.*` is tracked separately.

- 23aa094: Finish the VAUGHN → Harness Protocol rename: drop transitional aliases (no external consumers found) and split adapter-less profiles into `ROADMAP_PROFILES` for structural visibility.

  0.4.0 left three transitional carry-overs to protect against a phantom daemon consumer — `vaughn.*` RPC method names, a `VAUGHN_AGENT_ID` env-var fallback with deprecation warning, and a `/tmp/vaughn-session-<ppid>.id` cache-file fallback. A post-publish audit (`grep` across the entire fleet, including revdev, hooks, shell configs, `.jv/`) confirmed **none had any external consumer**. The deprecation pattern was carrying weight for nothing. 0.5.0 removes the aliases for a clean final state.

  **Breaking — RPC method names:** `vaughn.capabilities` / `vaughn.dispatch` / `vaughn.events` / `vaughn.config.sync` → `protocol.*` (same handlers, new wire names).

  **Breaking — env var:** `VAUGHN_AGENT_ID` is no longer read. Use `PROTOCOL_AGENT_ID`.

  **Breaking — session cache file:** `/tmp/vaughn-session-<ppid>.id` is no longer read. New path `/tmp/protocol-session-<ppid>.id` is used exclusively.

  **Breaking — `TOOL_PROFILES` shape:** previously contained four entries (claude-code, codex, cursor, revealui-agent). Now contains only `revealui-agent` (the only tool with a working adapter). The three adapter-less entries moved to a new `ROADMAP_PROFILES` export from `@revealui/harnesses/protocol`. A merged view `ALL_KNOWN_PROFILES` is also exported for callers that want capability data for any known tool ID. `HarnessCoordinator.dispatchTask` consults explicit registered capabilities first, then `TOOL_PROFILES`, then `ROADMAP_PROFILES`, so dispatch behavior is preserved for callers that register stub adapters for unimplemented tools.

  **Migration:** rename `vaughn.*` RPC calls to `protocol.*`; rename `VAUGHN_AGENT_ID` env var to `PROTOCOL_AGENT_ID`; import unimplemented-tool profiles from `ROADMAP_PROFILES` (or `ALL_KNOWN_PROFILES`) instead of `TOOL_PROFILES`.

### Patch Changes

- Updated dependencies [198fc08]
- Updated dependencies [363d4b5]
- Updated dependencies [198e56a]
- Updated dependencies [1d5a9e4]
  - @revealui/core@0.8.0

## 0.5.0

### Minor Changes

- Finish the VAUGHN → Harness Protocol rename: drop transitional aliases (no external consumers) and split adapter-less profiles into `ROADMAP_PROFILES` for structural visibility.

  **Audit finding behind this release:** 0.4.0 (the rename release) left three transitional carry-overs in place to protect against a phantom daemon consumer — `vaughn.*` RPC method names, a `VAUGHN_AGENT_ID` env-var fallback with deprecation warning, and a `/tmp/vaughn-session-<ppid>.id` cache-file fallback. A post-publish audit (`grep` across the entire fleet, including revdev, hooks, shell configs, `.jv/`) confirmed **none of those had any external consumer**. The deprecation pattern was carrying weight for nothing. 0.5.0 removes the aliases for a clean final state.

  **Breaking — RPC method names** (`@revealui/harnesses/server/rpc-server`):

  - `vaughn.capabilities` → `protocol.capabilities`
  - `vaughn.dispatch` → `protocol.dispatch`
  - `vaughn.events` → `protocol.events`
  - `vaughn.config.sync` → `protocol.config.sync`

  **Breaking — env var:** `VAUGHN_AGENT_ID` is no longer read. Use `PROTOCOL_AGENT_ID`.

  **Breaking — session cache file:** `/tmp/vaughn-session-<ppid>.id` is no longer read. The new path `/tmp/protocol-session-<ppid>.id` is used exclusively.

  **Breaking — `TOOL_PROFILES` shape:** previously contained four entries (`claude-code`, `codex`, `cursor`, `revealui-agent`). Now contains only `revealui-agent` — the only tool with a working adapter in this package. The three adapter-less entries moved to a new export `ROADMAP_PROFILES` from `@revealui/harnesses/protocol`. A merged view `ALL_KNOWN_PROFILES` is also exported for callers that want capability data for any known tool ID regardless of adapter status.

  - `TOOL_PROFILES` → shipped adapters only (revealui-agent)
  - `ROADMAP_PROFILES` → declared but unimplemented (claude-code, codex, cursor)
  - `ALL_KNOWN_PROFILES` → merged view (shipped entries take precedence on key collision)

  `HarnessCoordinator.dispatchTask` consults explicit registered capabilities first, then `TOOL_PROFILES`, then `ROADMAP_PROFILES` — so coordinators that register stub adapters for spec'd-but-unimplemented tools still get capability data for dispatch decisions.

  **Migration:**

  - If you call the harnesses RPC server: rename your method strings from `vaughn.*` to `protocol.*`.
  - If you set `VAUGHN_AGENT_ID` in any environment: rename to `PROTOCOL_AGENT_ID`.
  - If you import `TOOL_PROFILES['claude-code']` / `['codex']` / `['cursor']`: import `ROADMAP_PROFILES` (or `ALL_KNOWN_PROFILES`) from `@revealui/harnesses/protocol` instead.

## 0.4.0

### Minor Changes

- Rename VAUGHN protocol → Harness Protocol. Trim companion spec doc to match shipping reality.

  **Why:** The 2026-05-18 audit confirmed VAUGHN's customer claim ("coordination across heterogeneous AI tools") oversold the code (one working adapter for the RevealUI Agent; Claude Code, Codex, and Cursor live as static capability-profile data without adapters). The founder-name backronym also read as vanity in customer docs. See `docs/HARNESS_PROTOCOL.md` for the renamed + honestly-scoped spec (714 → ~200 lines).

  **Breaking — code symbols renamed:**

  - Types: `VaughnAdapter` → `ProtocolAdapter`, `VaughnAdapterInfo` → `ProtocolAdapterInfo`, `VaughnCapabilities` → `ProtocolCapabilities`, `VaughnCommand` → `ProtocolCommand`, `VaughnCommandResult` → `ProtocolCommandResult`, `VaughnConfig` → `ProtocolConfig`, `VaughnError` → `ProtocolError`, `VaughnErrorCode` → `ProtocolErrorCode`, `VaughnEvent` → `ProtocolEvent`, `VaughnEventEnvelope` → `ProtocolEventEnvelope`, `VaughnRule` → `ProtocolRule`, `VaughnSkill` → `ProtocolSkill`
  - Constants: `VAUGHN_VERSION` → `PROTOCOL_VERSION`, `VAUGHN_EVENTS` → `PROTOCOL_EVENTS`
  - Schemas: `vaughnEventSchema` → `protocolEventSchema`, `vaughnEventEnvelopeSchema` → `protocolEventEnvelopeSchema`
  - Class: `VaughnEventNormalizer` → `EventNormalizer`
  - Config functions: `vaughnConfigToClaudeSettings` → `protocolConfigToClaudeSettings`, `claudeSettingsToVaughnConfig` → `claudeSettingsToProtocolConfig`, `vaughnConfigToCursorrules` → `protocolConfigToCursorrules`, `vaughnConfigToAgentsMd` → `protocolConfigToAgentsMd`
  - `HarnessCoordinator.registerVaughnCapabilities` → `registerProtocolCapabilities`
  - `RpcServer.setVaughnDispatch` → `setProtocolDispatch`, `RpcServer.pushVaughnEvent` → `pushProtocolEvent`
  - `RevealUIAgentAdapter.getVaughnCapabilities` → `getProtocolCapabilities`, `onVaughnEvent` → `onProtocolEvent`

  **Breaking — package subpath export:** `@revealui/harnesses/vaughn` → `@revealui/harnesses/protocol`. Source directory moved `packages/harnesses/src/vaughn/` → `packages/harnesses/src/protocol/`.

  **Breaking — env var:** `VAUGHN_AGENT_ID` → `PROTOCOL_AGENT_ID`. The legacy variable is still read as a fallback and emits a one-time deprecation warning on stderr; remove the fallback in a future release.

  **Breaking — session-cache file:** `/tmp/vaughn-session-<ppid>.id` → `/tmp/protocol-session-<ppid>.id`. The legacy path is still read as a fallback; remove the fallback in a future release.

  **Preserved for wire-format stability:** JSON-RPC method names `vaughn.capabilities`, `vaughn.dispatch`, `vaughn.events`, `vaughn.config.sync` are unchanged so existing daemon consumers (notably revdev) keep working. A coordinated rename to `protocol.*` is tracked as separate follow-up work.

  **Migration:** rename all `Vaughn*` imports to `Protocol*` (1:1 mapping). Rename the subpath import from `@revealui/harnesses/vaughn` to `@revealui/harnesses/protocol`. Set `PROTOCOL_AGENT_ID` instead of `VAUGHN_AGENT_ID` in any environment that uses it.

## 0.3.0

### Minor Changes

- 7ad9ddb: Remove `checkHarnessesLicense` export and all CLI gate call sites (import, pull
  tier check, main gate). Per the 2026-05-08 charge-readiness audit Phase 2 Path A:
  the CLI gate was theater — library exports (`HarnessCoordinator`, `HarnessRegistry`,
  `RpcServer`, etc.) were always ungated; the gate only applied to the CLI entrypoint,
  which customers could bypass by importing directly. Drop the gate. Strip the `[Pro]`
  description prefix to match enforcement reality.

### Patch Changes

- Updated dependencies [b0bab95]
- Updated dependencies [3ff25bb]
- Updated dependencies [af12683]
  - @revealui/core@0.7.0

## 0.1.10

### Patch Changes

- Updated dependencies [80cc561]
- Updated dependencies [77a9a68]
- Updated dependencies [284fd1f]
- Updated dependencies [f6ba434]
- Updated dependencies [0e459ca]
- Updated dependencies [2204021]
  - @revealui/core@0.6.0

## 0.1.9

### Patch Changes

- VAUGHN Phase 2 protocol implementation: type foundation (adapter interface, capabilities, event envelope, degradation strategies), runtime wiring (event normalizer, config normalizer, capability-aware dispatch, RPC methods), and RevealUI Agent adapter upgrade with VAUGHN bridge.
- Updated dependencies
  - @revealui/core@0.5.6

## 0.1.8

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

## 0.1.7

### Patch Changes

- Updated dependencies
  - @revealui/core@0.5.4

## 0.1.6

### Patch Changes

- Updated dependencies
  - @revealui/core@0.5.3

## 0.1.5

### Patch Changes

- @revealui/core@0.5.2

## 0.1.4

### Patch Changes

- @revealui/core@0.5.1

## 0.1.3

### Patch Changes

- Updated dependencies
  - @revealui/core@0.5.0

## 0.1.2

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/core@0.4.0
