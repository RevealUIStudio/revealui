# @revealui/harnesses

## 0.17.0

### Minor Changes

- 110e0a4: Add GrokAdapter (Level 2): programmatic `grok -p` dispatch. Interactive sessions stay on RevKit `rfg`.

### Patch Changes

- 40248b1: Grok SessionStart/SessionEnd call `revealui-harnesses hotfix check` and `tmpscript check` (or the monorepo dist CLI) instead of Claude-home wrapper scripts.
- 3bbda78: Grok adapter: `manager materialize` emits control-layer slash commands under `.grok/commands/` (same Claude-legacy markdown layout OpenCode already gets).
- e8448f7: Add a soft-optional durable memory helper and materialize the studio-local knowledge-graph stdio MCP server for Claude Code and Grok.
- fff5084: Prove Claude and Grok stdio clients share studio-local knowledge-graph memory; a down graph WARNs without blocking the other harness.
- 5bcbddd: Always-on rule: npm publish is OIDC on main only. Never local tokens, GAT, or npm login.
- Updated dependencies [ee58150]
- Updated dependencies [8486734]
- Updated dependencies [975d3c7]
  - @revealui/knowledge-graph@0.1.12
  - @revealui/core@0.14.2

## 0.16.1

### Patch Changes

- @revealui/core@0.14.1

## 0.16.0

### Minor Changes

- 992a042: Grok content generator: preamble tier 1 under `.grok/rules/`, remaining definition rules as on-demand skills, spawn map, and PreToolUse that can deny through `hook grok`.

### Patch Changes

- 539e216: Grok SessionStart prints the CURRENT-HANDOFF menu pointer (session deltas; continue = /pickup), matching Claude orientation.
- d55c50e: Grok generator emits in-repo `.grok/rules/00-revealui-manager.md` (public-safe adapter orientation). `$HOME/.grok` stays a vendor cache, not constitution.
- b1ff307: Grok adapter: `manager materialize` emits hook JSON in the project tree only. RevKit `rfg`/bootstrap deploys those templates (and the PreToolUse helper) to the vendor attach point. Drop the home `cp` recipe.
- 04cc011: Add a user systemd oneshot that runs `inference reconcile` at WSL boot so unsigned or unfit snaps cannot persist via `snap start --enable`.
- Updated dependencies [ff1137f]
- Updated dependencies [a5b8022]
- Updated dependencies [5a0fbe7]
  - @revealui/security@0.8.0
  - @revealui/core@0.14.0

## 0.15.1

### Patch Changes

- 8e53beb: Declare `@revealui/ai` as an optionalDependency so ACP headless prompts resolve the agent runtime in monorepo and install graphs (no hand symlinks / NODE_PATH).
- 158381f: Add always-on `ai-mechanics` rule (model/harness/context/smart zone/primary source diagnosis) with progressive disclosure to the fleet glossary.
- a7e172c: Harden revealui-review skill: Standards ‖ Spec parallel review axes + deep-module checks.
- ffd40ba: Harden control-layer `revealui-tdd` (seams, vertical slices, test anti-patterns) and `revealui-debugging` (red-capable feedback loop first, multi-hypothesis, instrument/cleanup).

## 0.15.0

### Minor Changes

- 3e52708: GAP-381 Phase D: RevealUI ACP agent server (`revealui-harnesses acp`) via official `@agentclientprotocol/sdk` (D-B).

## 0.14.0

### Minor Changes

- 9cf46d6: GAP-381 I-5: Ed25519 sign/verify for harness policy snapshots; enforced tier only when signature verifies.

### Patch Changes

- Updated dependencies [9cf46d6]
  - @revealui/security@0.7.0
  - @revealui/core@0.13.1

## 0.13.0

### Minor Changes

- 04d7fdb: Add control-layer `token-economy` hardline rule (GAP-362) to preamble tier 1.

### Patch Changes

- bcd515f: GAP-381 Phase A: flushSpoolAsync POSTs to /api/harness/receipts; server ingest route.
- Updated dependencies [fcd7273]
  - @revealui/core@0.13.0

## 0.12.0

### Minor Changes

- a22dbbf: Add the shared archive-check gate (`./gates` export): `scanInboundLinks`,
  `isHistoricalPath`, `countOccurrences`, `ARCHIVE_URL_PREFIX`, and the per-repo
  historical-path marker sets.

  Docs moved to the central fleet archive must leave no live inbound links
  behind. That rule was previously enforced only in the private coordination
  repo, so links could rot in the public repo — the one place a dead link is
  externally visible. The matching logic now has one home here and is consumed by
  both repos' thin adapters, so the two cannot drift (same reasoning as the
  existing doc-currency and guardrail2-verdict gate exports).

- 981b3f0: Retire the dead HTTP gateway twin and PGlite DaemonStore from `@revealui/harnesses` after the RevDev port (revdev#328/#329). Remote pairing lives only in `@revdev/daemon`. Breaking: removes `./storage` export and root `DaemonStore` / `SCHEMA_SQL` re-exports.
- a3f9f09: GAP-459: session peer panel + archive-on-exit into revfleet cold sessions/daemon (live set stays unpolluted)
- 4d4f384: GAP-459: session reap CLI — cold-archive abandoned rows then signed harness.prune

### Patch Changes

- aa721ea: Commit generated `.revealui/content/` and gate freshness (GAP-421 content materialization ADR phase 1): un-ignore the tree, require it in `checkManager`, add `validate:content-freshness` / CI hard-fail, and clarify adapter load paths until phase 2.
- 6fdf057: Add soft-optional `session register|end` CLI for RevDev daemon boundary; wire Grok SessionStart/End hooks to register/end with shared identity cache.
- 2c23487: Materialize Grok SessionStart/SessionEnd control-layer hook templates under `.revealui/adapters/grok/hooks/` (TRACKER + hotfix + temp-scripts; install to `~/.grok/hooks`).
- c12977e: Add `hook grok` normalizer + PreToolUse receipt spool; extend Grok hook templates with pre-tool.json.
  - @revealui/core@0.12.4

## 0.11.0

### Minor Changes

- b65c739: Delete the zero-consumer coordination-daemon twin per GAP-421's DELETE train
  (audit step 8, daemon-ownership ADR 2026-07-25): `goals/`, `server/rpc-server.ts`,
  `server/spawner-service.ts`, `server/shared-memory-client.ts`, `coordinator.ts`,
  and `coordination/` (3,002 source LOC + 1,211 test LOC), plus the `start` and
  `coordinate --init` CLI subcommands that were the only thing constructing the
  now-deleted `HarnessCoordinator`. The RevDev daemon owns the coordination
  runtime and the harness socket; this package keeps the CLI, content
  definitions, and `./gates`. The published `./goals` subpath export is removed
  — a breaking change for any external importer, hence the minor bump inside 0.x.

  `server/http-gateway.ts` stays (it is ported into the RevDev daemon separately);
  its `RpcServer` type import is replaced with a minimal local `RpcDispatch`
  structural interface covering its one real usage (`dispatchHttp`), plus
  `GatewayStore` and `SpawnerLike` structural interfaces covering its `DaemonStore`
  and `SpawnerService` couplings the same way, so the module keeps compiling
  without those two also-deleted types.

  `storage/` and `config/` were in the ADR's DELETE list but are NOT deleted here:
  `storage/` backs `server/__tests__/http-gateway.test.ts`'s real (non-mocked)
  security test suite (GAP-353 auth flow), and `config/` is a real production
  dependency of `adapters/cursor-adapter.ts` and `adapters/opencode-adapter.ts`
  (both staying, INCUBATE). Both are consumers the ADR's routing did not account
  for; deleting either would have required rewriting or gutting working code/tests
  outside this train's scope, so they were left in place and reported instead.

- ec8b2dc: Remove the `./protocol` subpath export. It was mapped in `package.json` but never listed in `tsup.config.ts`, so `dist/protocol/` never existed and the export 404'd (`ERR_MODULE_NOT_FOUND`) for anyone who tried it. GAP-421's routing audit found zero consumers of the subpath fleet-wide; protocol types, schemas, and factories remain available via the root `@revealui/harnesses` export, which already re-exports them.

### Patch Changes

- @revealui/core@0.12.2

## 0.10.0

### Minor Changes

- 03560dd: feat(harnesses): GAP-199 native master-spec coupling advisory on file-edit hooks

  Provider-agnostic twin of the Claude PostToolUse master-spec-pr-coupling hook.
  Warns (never blocks) when contracts/db schema/apps sources edit without the
  product canon doc dirty; wired through runHookCommand for all editor sources.

- d11130e: Add a `gates` subpath export (GAP-408 control-layer redesign): `evaluateGuardrail2` / `verdictForBody` / `collectVerdicts` (the guardrail-2 verdict-marker parser) and `SHARED_DETECTION_RULES` / `COMMON_EXON` / `STRIPE_LIVE_EXON` (the doc-currency stale-fact detection data). These are now the single editable source for logic that `scripts/validate/guardrail2-verdict.cjs` and `scripts/validate/doc-currency.ts` load at runtime, and that the private revealui-jv checkout's equivalent scripts resolve via an adapter — no vendored copies on either side of the public/private boundary.
- b5c7c57: Finish the `.revealui` project manager (GAP-406): default `content sync` lands under the manager tree, materialize preserves existing manager.json, structure/CI gate hard-fail on invalid manager when `.revealui` or harnesses change, equal-rank adapter stubs stay gitignored outside the manager tree.

### Patch Changes

- 4ff3280: Pin `parseOpenCodeRunOutput` (GAP-371 Phase 4) against the real `opencode run --format json` output shape, verified live against opencode 1.18.3: newline-delimited JSON (JSONL) events, one per line, not a single JSON document. The parser now extracts the assistant's final `text` event from a real turn instead of mis-treating the JSONL stream as invalid JSON and echoing it back verbatim.
  - @revealui/core@0.12.1

## 0.9.0

### Minor Changes

- bfd860b: add a normalized hook-event schema, a `hook <source>` CLI subcommand (spool-only mode), and a Cursor adapter, following the multi-editor harness design: `HarnessHookEvent` normalizes Cursor and Claude Code hook payloads into one internal shape (identity fields stay session-scoped only, never editor-supplied human identity); the CLI subcommand normalizes stdin, evaluates a local policy snapshot, emits the editor-native allow/deny/ask response, and spools an append-only receipt (server-side flush lands in a later change, so this ships spool-only behind explicit config); `CursorAdapter` promotes the existing data-only `cursor` profile into `TOOL_PROFILES` (mirroring the OpenCode adapter promotion) with `.cursor/hooks.json` and `.cursor/mcp.json` generators, the latter using Cursor's `${env:VAR}` reference syntax so no token value is ever emitted.
- c08c9d6: make the harness HTTP gateway fail-closed. The pre-pairing bypass that granted every unauthenticated `/rpc` and `/api/*` call (including `agent.spawn` and `agent.stop`) on a never-paired daemon is deleted; a never-paired daemon now refuses those calls with 401. Pairing uses challenge-response so the bootstrap secret never crosses the wire: `GET /api/pair` issues a single-use short-lived nonce, the client returns `HMAC-SHA256(secret, nonce)` keyed on the 32-byte 0600 secret file in the daemon data dir, and the server verifies with a timing-safe comparison. On success the gateway mints a 32-byte bearer token, persists only its SHA-256 hash (default 90-day TTL, revocable) in `gateway_tokens`, and authenticates by hashing the presented token and matching the durable store, so a daemon restart with valid tokens stays authenticated and never reopens the window. The pairing endpoints carry per-source exponential-backoff lockout plus a global cooldown, the pre-auth allowlist is an explicit tested constant (exactly `GET`/`POST /api/pair`), and boot reconciles the file against the persisted hash (fresh-DB re-hash, tamper/removal refusal, permissive-mode refusal). The retired 6-digit pairing code is removed.
- a3f1811: add the gateway authn persistence substrate and real process termination to the harness daemon: two additive PGlite tables (`gateway_bootstrap`, a singleton hash of the HTTP-gateway bootstrap secret; `gateway_tokens`, hashed durable bearer tokens with expiry/revocation) plus `DaemonStore` methods (`putBootstrapSecretHash`, `getBootstrapSecretHash`, `insertToken`, `findValidToken`, `revokeToken`, `pruneExpiredTokens`) as substrate for a later fail-closed gateway; and `SpawnerService.stop`/`stopAll` now escalate SIGTERM to SIGKILL after a bounded, configurable grace period (`terminationGraceMs`, default 5000ms) with event-driven status, so a child that ignores SIGTERM is actually killed and `agent.list` never reports a live process as stopped. Substrate only, no callers wired yet.
- 0b8864c: add a VS Code agent-plugin surface, following the multi-editor harness design: a `vscode` hook normalizer maps VS Code's agent-hook payloads (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PreCompact`, `SubagentStart`, `SubagentStop`, `Stop`) onto the existing `HarnessHookEvent` schema, with editor-supplied fields staying session-scoped only, never promoted to identity; the `hook <source>` CLI subcommand now accepts `vscode` and returns VS Code's native response shape (nested `hookSpecificOutput.permissionDecision` for `PreToolUse`, flat `decision`/`reason` for every other event); `VSCodeGenerator` emits a `plugin.json` agent-plugin manifest bundling command-based hook contributions plus a path reference to a governed MCP server contribution, and `protocolConfigToVSCodeMcpConfig` produces that `.mcp.json` content separately using VS Code's `${input:id}` reference syntax so no token value is ever emitted; no `HarnessAdapter` ships for `vscode` in this phase (VS Code's agent mode has no documented headless CLI to exec).

### Patch Changes

- dff098c: Bound the `HttpGateway.initAuth` bootstrap-secret retry loop to 5 attempts before failing closed, so a persistent create/delete race on the secret file cannot livelock daemon startup. Fast-follow on a non-blocking finding from the #1975 guardrail-2 security verdict (DoS-only defense-in-depth; O_EXCL + O_NOFOLLOW already prevent secret substitution).
- Updated dependencies [16b235f]
- Updated dependencies [11ab999]
- Updated dependencies [83846a2]
- Updated dependencies [b029d2d]
- Updated dependencies [6a58057]
  - @revealui/core@0.12.0

## 0.8.0

### Minor Changes

- 95cf428: add OpenCodeAdapter, the first external-CLI harness adapter: detects and drives the `opencode` CLI (headless run, config apply/sync/diff, running-instance discovery), promotes the `opencode` capability profile from roadmap to shipped, registers an OpenCode content generator (commands + agents), and adds `protocolConfigToOpencodeConfig` for wiring the governed RevealUI MCP endpoint into `opencode.json` via env-var token substitution (never a literal token).
- c173e2e: Register OpenCode as a roadmap capability profile (data only): capability
  declaration, process-detection pattern, config paths, degradation row, and
  `SessionType`. No adapter class ships in this change — `TOOL_PROFILES` and
  `auto-detector.ts` are unchanged, so there is no new runtime behavior.

### Patch Changes

- Updated dependencies
  - @revealui/core@0.11.1

## 0.7.0

### Minor Changes

- 487b55f: Add the goal harness: goal-driven agent coordination with acceptance-criteria gating. New `GoalHarness` engine (exported at the root and at `@revealui/harnesses/goals`), `goals` + `goal_criteria` daemon tables, and DaemonStore goal methods. Completion is fail-closed (every criterion needs recorded evidence, every linked task must be completed) and the surface is propose-only: goals emit claimable tasks into the existing daemon task queue and never spawn agents.

### Patch Changes

- Updated dependencies [dc3e318]
- Updated dependencies [4778037]
- Updated dependencies [639dfa5]
  - @revealui/core@0.11.0

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
