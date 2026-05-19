# @revealui/harnesses

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
