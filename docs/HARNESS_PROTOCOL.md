---
title: "Harness Protocol"
description: "Agent-tool coordination protocol shipped in @revealui/harnesses — capabilities, lifecycle events, configuration normalization, coordinator surface."
category: protocol
audience: developer
---

# Harness Protocol

> **Version:** 0.1.0  (Active — Phase 1 + 2 shipped; multi-tool adapters and full coordinator surface remain on the roadmap.)
> **Package:** [`@revealui/harnesses`](../packages/harnesses) at v0.4.0+
> **Renamed:** 2026-05-18, from the original "VAUGHN" backronym. See [§Why "Harness Protocol"](#why-harness-protocol) at the end.

A protocol for normalizing agent capabilities, lifecycle events, and configuration across AI coding tools, so a single coordinator can dispatch work to whichever adapter is available. Ships today with **one working adapter** (the RevealUI Agent) plus static capability profiles and degradation-strategy data for Claude Code / Codex / Cursor; adapters for those three tools are roadmap items.

This doc describes what's in the package today. Items in the [Roadmap](#roadmap) section are deferred work, not current behavior.

---

## What ships today

| Surface | Status | Location |
|---|---|---|
| Protocol type foundation | ✓ | [packages/harnesses/src/protocol/](../packages/harnesses/src/protocol) |
| Capability profiles (4 tools, static data) | ✓ | [protocol/capabilities.ts](../packages/harnesses/src/protocol/capabilities.ts) |
| 10 canonical lifecycle events + Zod schemas | ✓ | [protocol/event-envelope.ts](../packages/harnesses/src/protocol/event-envelope.ts) |
| Event normalization (HarnessEvent → ProtocolEventEnvelope) | ✓ partial — 5 of 10 events have emit paths today | [protocol/event-normalizer.ts](../packages/harnesses/src/protocol/event-normalizer.ts) |
| Degradation strategy lookup | ✓ | [protocol/degradation-strategies.ts](../packages/harnesses/src/protocol/degradation-strategies.ts) |
| Config normalization: Claude `settings.json` (bidirectional) | ✓ | [protocol/config-normalizer.ts](../packages/harnesses/src/protocol/config-normalizer.ts) |
| Config normalization: `.cursorrules` (write-only) | ✓ | same |
| Config normalization: `AGENTS.md` (write-only) | ✓ | same |
| Config normalization: `.claude/rules/*.md` (per-rule, write-only) | ✓ | same |
| Coordinator: start / stop / registerAdapter / dispatchTask / healthCheck | ✓ | [coordinator.ts](../packages/harnesses/src/coordinator.ts) |
| JSON-RPC server with `vaughn.*` methods | ✓ (historical wire-format names) | [server/rpc-server.ts](../packages/harnesses/src/server/rpc-server.ts) |
| HTTP gateway (optional, off by default) | ✓ existence; security audit pending | [server/http-gateway.ts](../packages/harnesses/src/server/http-gateway.ts) |
| **RevealUI Agent adapter** | ✓ working | [adapters/revealui-agent-adapter.ts](../packages/harnesses/src/adapters/revealui-agent-adapter.ts) |
| Workboard manager + PGlite daemon store | ✓ | [workboard/](../packages/harnesses/src/workboard), [storage/](../packages/harnesses/src/storage) |
| Session identity detector (3 session types + env-var override) | ✓ partial — 7-tier cascade is roadmap | [workboard/session-identity.ts](../packages/harnesses/src/workboard/session-identity.ts) |

---

## Adapter interface

[`ProtocolAdapter`](../packages/harnesses/src/protocol/adapter.ts) is the contract every tool-specific integration implements. Today only [`RevealUIAgentAdapter`](../packages/harnesses/src/adapters/revealui-agent-adapter.ts) is wired into the coordinator (via the legacy [`HarnessAdapter`](../packages/harnesses/src/types/adapter.ts) interface). The richer `ProtocolAdapter` interface is the target shape for adapters that need full protocol participation (capability declaration, normalized events, config generation, optional workboard access).

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

[`TOOL_PROFILES`](../packages/harnesses/src/protocol/capabilities.ts) is static reference data describing what each tool *would* support if an adapter wrapped it. Only `revealui-agent` has a working adapter today; the other three profiles inform the degradation table and future adapter work.

| Capability | Claude Code | Codex CLI | Cursor | **RevealUI Agent (shipped)** |
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

## Coordinator surface

[`HarnessCoordinator`](../packages/harnesses/src/coordinator.ts) is the runtime entry point. Today it exposes:

| Method | Purpose |
|---|---|
| `start()` | Auto-detect adapters, register session, start RPC + optional HTTP gateway |
| `stop()` | Tear down |
| `registerAdapter(adapter)` | Register a custom adapter before `start()` |
| `registerProtocolCapabilities(id, caps)` | Attach explicit capability declaration for an adapter |
| `dispatchTask(requirements, description)` | Pick the best adapter matching capability requirements (prefers `hooks.canBlock` for safety-critical work) |
| `healthCheck()` | Adapter availability + workboard readability + stale-session detection |
| `getRegistry()` / `getWorkboard()` / `getStore()` / `getHttpGateway()` | Accessors for internals |

---

## Transports

### File transport (workboard)

All adapters can coordinate through `.claude/workboard.md` directly. No daemon required.

### JSON-RPC transport (Unix domain socket)

`@revealui/harnesses` ships a JSON-RPC 2.0 server. Method names use the historical `vaughn.*` namespace — the protocol was renamed 2026-05-18; method names are preserved for wire-format stability with existing consumers (notably the [revdev daemon](https://github.com/RevealUIStudio/revdev) which talks to this socket).

| Method | Returns | Purpose |
|---|---|---|
| `vaughn.capabilities` | `Array<{ id, capabilities: ProtocolCapabilities }>` | List registered adapters + capability profiles |
| `vaughn.dispatch` | `{ adapterId: string \| null }` | Pick best adapter for capability requirements |
| `vaughn.events` | `ProtocolEventEnvelope[]` | Last 100 events from the queue |
| `vaughn.config.sync` | `{ files: Record<string, string> }` | Generate all configs from a `ProtocolConfig` |

Renaming these methods to `protocol.*` is tracked as a coordinated migration with the daemon consumer; see [Roadmap](#roadmap).

### HTTP transport (optional, off by default)

`HttpGateway` is wired into `HarnessCoordinator` when an `httpPort` is set. Security requirements (bearer-token auth, `127.0.0.1` default bind, rate limiting, TLS for non-localhost connections) are intended but not all enforced today. **Audit `HttpGateway` before exposing this to non-localhost networks.**

---

## Identity

Session type detection in [`workboard/session-identity.ts`](../packages/harnesses/src/workboard/session-identity.ts) resolves to one of `'claude' | 'codex' | 'zed' | 'cursor' | 'terminal'` via this cascade:

1. Explicit `PROTOCOL_AGENT_ID` env var (legacy fallback: `VAUGHN_AGENT_ID`)
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
- **Coordinator interface gaps:** `unregisterAdapter`, typed `listAdapters()` returning `ProtocolAdapterInfo[]`, `claimTask` / `completeTask` / `markPartial` / `releaseTask`, `checkConflicts`, `syncConfig` / `diffConfig`, `reserveTool` / `releaseTool`.
- **Five additional event emit paths:** `prompt.submit`, `tool.blocked`, `task.claimed`, `task.completed`, `agent.heartbeat` — currently defined but not produced from any `HarnessEvent`.
- **7-tier identity cascade** with structured identity formats.
- **MCP tool reservation** (concurrency control across adapters calling the same MCP tool).
- **HTTP transport security:** bearer-token auth enforcement, TLS, rate limiting, sandbox-mode-aware dispatch — audit before non-localhost exposure.
- **RPC method rename** from `vaughn.*` to `protocol.*` (coordinated with the daemon consumer).
- **Cross-machine coordination** (distributed lock for HTTP transport).

These are tracked in [docs/MASTER_PLAN.md](./MASTER_PLAN.md) under harness-related lanes.

---

## Why "Harness Protocol"

This protocol was originally named VAUGHN — a backronym (Versioned Agent Unification, Governance, Handoff, Normalization) derived from the author's surname. Two problems:

1. The original spec's customer claim ("coordination across heterogeneous AI tools") oversold what the code actually shipped — one adapter for the RevealUI Agent, plus static profile data for three tools that have no adapter.
2. The founder-name acronym read as a vanity stamp on engineering documentation.

Renamed 2026-05-18 to **Harness Protocol** — descriptive, matching the existing `@revealui/harnesses` package name and the existing `HarnessAdapter` / `HarnessCoordinator` types. The protocol describes how an adapter wraps a tool ("harnesses" it) and how the coordinator orchestrates work across registered adapters.

The previous name survives in three places, intentionally:

- **RPC method namespace** (`vaughn.capabilities`, etc.) — kept for wire-format stability with the daemon consumer
- **`CHANGELOG.md` entries** — history is history
- **Legacy env var alias** (`VAUGHN_AGENT_ID` still read as a fallback after `PROTOCOL_AGENT_ID`)

The principles, not the name, do the work.
