---
visibility: public
status: verified
title: "Harness Protocol"
description: "Agent-tool coordination protocol shipped in @revealui/harnesses — capabilities, lifecycle events, configuration normalization."
category: protocol
audience: developer
---

> **Version:** 0.1.0  (Active — Phase 1 + 2 shipped; multi-tool adapters remain on the roadmap.)
> **Package:** [`@revealui/harnesses`](../packages/harnesses) at v0.5.0+
> **Renamed:** 2026-05-18, from the original "VAUGHN" backronym. See [§Why "Harness Protocol"](#why-harness-protocol) at the end.
>
> **2026-07-25:** the in-package `HarnessCoordinator` and its JSON-RPC server described in earlier revisions of this doc were removed. The coordination runtime (the socket that session/mail/file-reservation/task calls dispatch to) is served by the RevDev daemon; this package ships the capability/event/config-normalization protocol described below as data and pure functions, plus the adapters, for a caller to build orchestration on top of.

A protocol for normalizing agent capabilities, lifecycle events, and configuration across AI coding tools, so a caller can dispatch work to whichever adapter is available. Ships today with **one working adapter** (the RevealUI Agent — in `TOOL_PROFILES`) plus declared-but-unimplemented profiles for Claude Code / Codex / Cursor (in `ROADMAP_PROFILES`); adapters for those three tools are roadmap items.

This doc describes what's in the package today. Items in the [Roadmap](#roadmap) section are deferred work, not current behavior.

---

## What ships today

| Surface | Status | Location |
|---|---|---|
| Protocol type foundation | ✓ | [packages/harnesses/src/protocol/](../packages/harnesses/src/protocol) |
| Capability profiles for shipped adapters (`TOOL_PROFILES`) | ✓ — revealui-agent only | [protocol/capabilities.ts](../packages/harnesses/src/protocol/capabilities.ts) |
| Capability profiles for unimplemented tools (`ROADMAP_PROFILES`) | ✓ — claude-code, codex, cursor | [protocol/roadmap-profiles.ts](../packages/harnesses/src/protocol/roadmap-profiles.ts) |
| 10 canonical lifecycle events + Zod schemas | ✓ | [protocol/event-envelope.ts](../packages/harnesses/src/protocol/event-envelope.ts) |
| Event normalization (HarnessEvent → ProtocolEventEnvelope) | ✓ partial — 5 of 10 events have emit paths today | [protocol/event-normalizer.ts](../packages/harnesses/src/protocol/event-normalizer.ts) |
| Degradation strategy lookup | ✓ | [protocol/degradation-strategies.ts](../packages/harnesses/src/protocol/degradation-strategies.ts) |
| Config normalization: Claude `settings.json` (bidirectional) | ✓ | [protocol/config-normalizer.ts](../packages/harnesses/src/protocol/config-normalizer.ts) |
| Config normalization: `.cursorrules` (write-only) | ✓ | same |
| Config normalization: `AGENTS.md` (write-only) | ✓ | same |
| Config normalization: `.claude/rules/*.md` (per-rule, write-only) | ✓ | same |
| In-package coordinator (start / stop / registerAdapter / dispatchTask / healthCheck) | removed 2026-07-25 | see the daemon-ownership ADR; superseded by the RevDev daemon |
| JSON-RPC server with `protocol.*` methods | removed 2026-07-25 | none — no daemon implements `protocol.*` today |
| HTTP gateway (fail-closed pairing auth) | removed from this package 2026-07-29 | lives in `@revdev/daemon` (`http-gateway.ts`, revdev#328/#329); opt-in via `httpPort` |
| **RevealUI Agent adapter** | ✓ working | [adapters/revealui-agent-adapter.ts](../packages/harnesses/src/adapters/revealui-agent-adapter.ts) |
| Workboard manager | ✓ | [workboard/](../packages/harnesses/src/workboard) (PGlite daemon store removed with the gateway twin) |
| Session identity detector (3 session types + env-var override) | ✓ partial — 7-tier cascade is roadmap | [workboard/session-identity.ts](../packages/harnesses/src/workboard/session-identity.ts) |

---

## Adapter interface

[`ProtocolAdapter`](../packages/harnesses/src/protocol/adapter.ts) is the contract every tool-specific integration implements. [`RevealUIAgentAdapter`](../packages/harnesses/src/adapters/revealui-agent-adapter.ts) (via the legacy [`HarnessAdapter`](../packages/harnesses/src/types/adapter.ts) interface), `CursorAdapter`, and `OpenCodeAdapter` are written and capability-profiled, but no in-package orchestrator constructs them today (the coordinator that did was removed — see the version note above); they are reachable only via direct import. The richer `ProtocolAdapter` interface is the target shape for adapters that need full protocol participation (capability declaration, normalized events, config generation, optional workboard access).

```typescript
export interface ProtocolAdapter {
  readonly id: string;
  readonly capabilities: ProtocolCapabilities;

  initialize(): Promise<void>;
  dispose(): Promise<void>;
  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string | null>;

  onEvent(handler: (event: ProtocolEventEnvelope) => void): void;
  execute?(command: ProtocolCommand): Promise<ProtocolCommandResult>;

  generateConfig(config: ProtocolConfig): Promise<GeneratedFiles>;
  readConfig?(): Promise<Partial<ProtocolConfig>>;

  readWorkboard?(): Promise<WorkboardState>;
  writeWorkboard?(state: WorkboardState): Promise<void>;
}
```

---

## Capability model

[`ProtocolCapabilities`](../packages/harnesses/src/protocol/capabilities.ts) covers dispatch, coordination, lifecycle, safety (hooks + sandbox), context (skills, MCP, memory), and which lifecycle events the tool emits natively.

### Capability profiles

Capability data is split across two named exports to make the spec-vs-shipped gap structurally visible:

- [`TOOL_PROFILES`](../packages/harnesses/src/protocol/capabilities.ts) — profiles for tools that have working adapters in this package. **One entry today: `revealui-agent`.**
- [`ROADMAP_PROFILES`](../packages/harnesses/src/protocol/roadmap-profiles.ts) — declared profiles for tools the spec targets but where no adapter is implemented yet. **Three entries today: `claude-code`, `codex`, `cursor`.**
- [`ALL_KNOWN_PROFILES`](../packages/harnesses/src/protocol/roadmap-profiles.ts) — merged view for callers that want capability data for any known tool ID. Shipped entries take precedence on key collision.

A capability-aware dispatcher would consult explicit registered capabilities first, then `TOOL_PROFILES`, then `ROADMAP_PROFILES` — so an orchestrator that registers stub adapters for spec'd-but-unimplemented tools still gets capability data for dispatch decisions. No such dispatcher ships in this package today (see the version note above).

| Capability | Claude Code _(roadmap)_ | Codex CLI _(roadmap)_ | Cursor _(roadmap)_ | **RevealUI Agent (shipped)** |
|---|---|---|---|---|
| dispatch.generateCode / analyzeCode / applyEdit / executeCommand | false × 4 | false × 4 | false × 4 | **true × 4** |
| readWorkboard / writeWorkboard | true / true | true / true | false / false | **true / true** |
| headless | true | true | false | **true** |
| hooks.canBlock | true | true | false | **true** |
| supportsWorktrees | true | false | false | **true** |
| supportsMcp | true | true | false | **true** |
| memory.backend | none | sqlite | none | **crdt** |
| maxContextTokens | 200k | 200k | 128k | **200k** |

---

## Lifecycle events

10 canonical events ([`PROTOCOL_EVENTS`](../packages/harnesses/src/protocol/event-envelope.ts)):

`session.start`, `session.stop`, `session.crash`, `prompt.submit`, `tool.before`, `tool.after`, `tool.blocked`, `task.claimed`, `task.completed`, `agent.heartbeat`

### Emit paths in code today

The [`EventNormalizer`](../packages/harnesses/src/protocol/event-normalizer.ts) translates internal `HarnessEvent` types into `ProtocolEventEnvelope`. **Five** of the ten canonical events have emit paths today:

| HarnessEvent | → ProtocolEvent |
|---|---|
| `harness-connected` | `session.start` |
| `harness-disconnected` | `session.stop` |
| `generation-started` | `tool.before` |
| `generation-completed` | `tool.after` |
| `error` | `session.crash` |

The remaining five — `prompt.submit`, `tool.blocked`, `task.claimed`, `task.completed`, `agent.heartbeat` — exist in the canonical event set, Zod schema, and degradation table, but no `HarnessEvent` currently maps to them. They're available for future emit paths or for adapters that emit them directly.

### Event envelope

```typescript
interface ProtocolEventEnvelope {
  version: typeof PROTOCOL_VERSION;
  event: ProtocolEvent;
  timestamp: string;
  agentId: string;
  toolName: string;
  sessionId: string;
  payload: Record<string, unknown>;
}
```

### Degradation strategies

When a tool can't emit a canonical event natively, the [degradation table](../packages/harnesses/src/protocol/degradation-strategies.ts) declares one of three strategies:

- **polyfill** — adapter synthesizes from other signals (same semantics, higher latency)
- **degrade** — partial functionality, weaker guarantee, explicitly documented
- **absent** — no meaningful approximation; capability reported as missing

---

## Configuration normalization

`generateAllConfigs(config: ProtocolConfig)` produces tool-native config files from a canonical `ProtocolConfig`:

| Output file | Direction | Notes |
|---|---|---|
| `.claude/settings.json` | bidirectional | round-trips via `protocolConfigToClaudeSettings` ↔ `claudeSettingsToProtocolConfig` |
| `.claude/rules/<id>.md` | write-only | one file per rule, with YAML frontmatter |
| `.cursorrules` | write-only | single markdown file |
| `AGENTS.md` | write-only | generic agent-tool instructions |

MCP server names emitted into `settings.json` are validated against an allowlist pattern + denylist that blocks prototype-pollution vectors. See [`isSafeMcpServerName`](../packages/harnesses/src/protocol/config-normalizer.ts).

---

## Coordinator surface (removed)

`HarnessCoordinator` was the runtime entry point through 2026-07-25: it auto-detected adapters, registered a session, started an in-package JSON-RPC server plus an optional HTTP gateway, and dispatched tasks to the best-matching adapter. It shipped a second, zero-consumer coordination daemon on the same Unix socket path the RevDev daemon already served in production. The daemon-ownership ADR (2026-07-25) resolved that duplication in the daemon's favor: `HarnessCoordinator`, its JSON-RPC server, and the coordination modules it drove were deleted, and the daemon is now the single implementation of `session.*`, `mail.*`, `files.*`, `tasks.*`, and `events.*` on that socket.

What the coordinator's method table described conceptually still applies to whatever orchestrates on top of this package's data (capability profiles, event schemas, config normalizers, adapters) — there just isn't a shipped class doing it in-package anymore. A future orchestrator, wherever it lives, would still need: session registration, adapter auto-detection, capability-matched task dispatch, and health checking. Recovering any of that means writing it against the current adapters and capability data, not restoring the deleted class.

---

## Transports

### File transport (workboard)

All adapters can coordinate through `.claude/workboard.md` directly. No daemon required.

### JSON-RPC transport (Unix domain socket)

The RevDev daemon serves JSON-RPC 2.0 on `~/.local/share/revealui/harness.sock`; `@revealui/harnesses` no longer ships a server on that socket (see the version note above). The `protocol.*` method family below was implemented in the deleted in-package server and is not implemented anywhere today — recorded here for anyone tracing an old reference, not as current behavior:

| Method | Returns | Purpose (historical) |
|---|---|---|
| `protocol.capabilities` | `Array<{ id, capabilities: ProtocolCapabilities }>` | List registered adapters + capability profiles (shipped only — `TOOL_PROFILES`) |
| `protocol.dispatch` | `{ adapterId: string \| null }` | Pick best adapter for capability requirements |
| `protocol.events` | `ProtocolEventEnvelope[]` | Last 100 events from the queue |
| `protocol.config.sync` | `{ files: Record<string, string> }` | Generate all configs from a `ProtocolConfig` |

> 0.5.0 renamed these methods from the historical `vaughn.*` namespace. A pre-publish audit confirmed no external consumers (the revdev daemon was never wired into these methods), so the rename was a clean break with no backward-compat alias. The methods themselves were removed entirely in the 2026-07-25 daemon-ownership cleanup, for the same reason: zero consumers.

### HTTP transport (RevDev daemon)

The fail-closed HMAC challenge-response HTTP gateway was **ported to
`@revdev/daemon`** (revdev#328; SSE ticket auth revdev#329) and **removed from
this package** (2026-07-29). Enable with daemon `httpPort` (default off). Studio
pairs via Settings → connection (`pairWithDaemon`). See
`revdev/packages/daemon/src/http-gateway.ts` and the daemon package docs.

---

## Identity

Session type detection in [`workboard/session-identity.ts`](../packages/harnesses/src/workboard/session-identity.ts) resolves to one of `'claude' | 'codex' | 'zed' | 'cursor' | 'terminal'` via this cascade:

1. Explicit `PROTOCOL_AGENT_ID` env var
2. Tool-specific env var (`CLAUDE_AGENT_ROLE`)
3. Session cache (`/tmp/protocol-session-<ppid>.id`)
4. Process tree walk
5. IDE detection (Zed, Cursor)
6. `TERM_PROGRAM` env var
7. Default to `terminal`

A richer 7-tier cascade with structured identity formats (`<tool>-<role>[-<index>]`) was described in the original spec and remains on the roadmap.

---

## Roadmap

Items defined in the original spec but not implemented today:

- **Additional adapters:** Claude Code, Codex CLI, and Cursor adapters. Capability profiles exist; no adapter wraps these tools.
- **Codex `config.toml` bidirectional normalization.** Currently only Claude `settings.json` is bidirectional.
- **`CLAUDE.md` generation** from `ProtocolConfig` (distinct from per-rule `.claude/rules/*.md` generation).
- **No orchestrator ships in-package anymore.** Whatever eventually dispatches tasks against these adapters and capability profiles (in-package or in the RevDev daemon) still needs: `unregisterAdapter`, typed `listAdapters()` returning `ProtocolAdapterInfo[]`, `claimTask` / `completeTask` / `markPartial` / `releaseTask`, `checkConflicts`, `syncConfig` / `diffConfig`, `reserveTool` / `releaseTool` — none of which the deleted `HarnessCoordinator` had either.
- **Five additional event emit paths:** `prompt.submit`, `tool.blocked`, `task.claimed`, `task.completed`, `agent.heartbeat` — currently defined but not produced from any `HarnessEvent`.
- **7-tier identity cascade** with structured identity formats.
- **MCP tool reservation** (concurrency control across adapters calling the same MCP tool).
- **HTTP transport security:** bearer-token auth enforcement, TLS, rate limiting, sandbox-mode-aware dispatch — audit before non-localhost exposure.
- **Cross-machine coordination** (distributed lock for HTTP transport).

These are tracked in the internal master plan under harness-related lanes.

---

## Why "Harness Protocol"

This protocol was originally named VAUGHN — a backronym (Versioned Agent Unification, Governance, Handoff, Normalization) derived from the author's surname. Two problems:

1. The original spec's customer claim ("coordination across heterogeneous AI tools") oversold what the code actually shipped — one adapter for the RevealUI Agent, plus static profile data for three tools that have no adapter.
2. The founder-name acronym read as a vanity stamp on engineering documentation.

Renamed 2026-05-18 to **Harness Protocol** — descriptive, matching the existing `@revealui/harnesses` package name and the (since-removed) `HarnessAdapter` / `HarnessCoordinator` types. The protocol describes how an adapter wraps a tool ("harnesses" it) and, at the time of the rename, how the coordinator orchestrated work across registered adapters; `HarnessCoordinator` itself was removed 2026-07-25 (see the version note at the top), but the name still describes what an adapter does.

0.4.0 (the rename release) left three transitional carry-overs in place — `vaughn.*` RPC method aliases, a `VAUGHN_AGENT_ID` env-var fallback with deprecation warning, and a `/tmp/vaughn-session-<ppid>.id` cache-file fallback. A 0.5.0 audit confirmed none of those had any external consumer (no shell config, hook, script, or repo in the fleet referenced them), so the deprecation pattern was protecting phantoms. 0.5.0 removed the aliases and fallbacks for a clean final state.

The previous name now survives only in `CHANGELOG.md` entries — history is history.

The principles, not the name, do the work.
