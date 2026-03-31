# The VAUGHN Protocol

**Versioned Agent Unification, Governance, Handoff, and Normalization**

**Version:** 0.1.0 (Draft)
**Status:** Specification complete, implementation in progress

---

## What is VAUGHN?

VAUGHN is a protocol for normalizing agent capabilities, lifecycle events, and inter-agent coordination across heterogeneous AI coding tools. It sits between the tool-specific runtime (Claude Code, Codex CLI, Cursor, etc.) and the coordination layer (Holster workboard), providing a uniform interface that lets any compliant agent participate in multi-agent workflows.

VAUGHN is part of the **[JOSHUA Stack](./JOSHUA.md)** — specifically, it embodies the **Orthogonal** (clean boundaries between agents and tools), **Hermetic** (sealed coordination contracts), and **Adaptive** (new tools join without rebuilding) principles.

---

## The Problem

AI coding agents share no common runtime interface. Each tool has its own:

- Lifecycle events (Claude Code: 8+, Codex: 5, Cursor: 0)
- Instruction format (CLAUDE.md vs AGENTS.md vs .cursorrules)
- Configuration schema (JSON vs TOML vs YAML)
- Permission model (hooks vs OS sandbox vs manual approval)
- Tool invocation (MCP vs native tools vs API calls)
- Session persistence (none vs SQLite vs file-based)

This means rules written for one tool don't work in another, agents from different tools can't coordinate, and adding support for a new tool requires reimplementing everything.

VAUGHN solves this by defining a **canonical representation** for agent capabilities, events, and configuration, plus **adapters** that translate between the canonical form and each tool's native interface.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User / Orchestrator                    │
├─────────────────────────────────────────────────────────┤
│                   Holster Coordinator                    │
│  (task assignment, conflict resolution, lifecycle mgmt)  │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│  VAUGHN  │  VAUGHN  │  VAUGHN  │  VAUGHN  │   VAUGHN    │
│ Adapter  │ Adapter  │ Adapter  │ Adapter  │   Adapter   │
│ (Claude) │ (Codex)  │ (Cursor) │ (Custom) │ (RevAgent)  │
├──────────┼──────────┼──────────┼──────────┼─────────────┤
│  Claude  │  Codex   │  Cursor  │  Any AI  │  RevealUI   │
│  Code    │  CLI     │  IDE     │  Tool    │  Agent      │
└──────────┴──────────┴──────────┴──────────┴─────────────┘
```

### Protocol Boundaries

Each protocol owns one concern:

| Protocol | Concern |
| --- | --- |
| **A2A** | "Here are the agents available and what they can do" |
| **MCP** | "Here are the tools available and how to call them" |
| **VAUGHN** | "Here is how agents coordinate to use tools safely together" |
| **Holster** | "Here is the shared state where coordination happens" |

VAUGHN does not replace MCP, A2A, or the Holster workboard. It translates between them so they can interoperate.

---

## Design Principles

1. **Canonical, not lowest-common-denominator.** VAUGHN defines the full superset of capabilities. Adapters degrade gracefully when a tool lacks a feature, rather than omitting the feature entirely.
2. **Translation, not abstraction.** VAUGHN translates between protocols so they can interoperate — it does not wrap or replace them.
3. **Statically verifiable.** An adapter declares its capabilities at registration time. The coordinator knows what each agent can and cannot do before dispatching work.
4. **Wire-format agnostic.** VAUGHN defines operations and types, not serialization. Implementations may use JSON-RPC, protobuf, file I/O, or HTTP.
5. **Additive only.** New capabilities extend the protocol without breaking existing adapters. Unknown capabilities are ignored, not rejected.

---

## Key Concepts

### Adapters

The adapter is the boundary between a tool's native interface and the VAUGHN protocol. Each adapter:

- Declares its **capabilities** (what the tool can do)
- Translates **lifecycle events** (tool-native → VAUGHN canonical)
- Generates **configuration files** (VAUGHN canonical → tool-native)
- Exposes **operations** (VAUGHN commands → tool-native execution)

### Capability Model

Adapters declare a static capability set at registration. The coordinator uses this to make dispatch decisions:

| Capability | Claude Code | Codex CLI | Cursor | RevealUI Agent |
| --- | --- | --- | --- | --- |
| Headless execution | Yes (`-p`) | Yes (`exec`) | No | Yes |
| Hook granularity | All tools | Bash only | None | All tools |
| Can block tool calls | Yes | Yes (Bash only) | No | Yes |
| OS sandbox | No | Yes | No | No |
| Git worktrees | Yes | No | No | Yes |
| MCP support | Yes | Yes | No | Yes |
| Cross-session memory | No | SQLite | No | CRDT |

When a tool lacks a capability, the adapter applies one of three degradation strategies:

- **Polyfill**: Synthesize the event from other signals (same semantics, higher latency)
- **Degrade**: Partial functionality with explicitly documented weaker guarantees
- **Absent**: No meaningful approximation — capability is reported as missing

### Lifecycle Events

VAUGHN defines 10 canonical lifecycle events that adapters map from tool-native events:

| Event | Meaning |
| --- | --- |
| `session.start` | Agent session begins |
| `session.stop` | Agent session ends (graceful) |
| `session.crash` | Agent session ends (unexpected) |
| `prompt.submit` | User submits a prompt |
| `tool.before` | Before a tool call executes |
| `tool.after` | After a tool call completes |
| `tool.blocked` | A tool call was denied |
| `task.claimed` | Agent claimed a workboard task |
| `task.completed` | Agent completed a workboard task |
| `agent.heartbeat` | Periodic liveness signal |

### Configuration Normalization

Rules, permissions, and environment are defined once in canonical form and generated to each tool's native format:

| Source Format | Tool | Direction |
| --- | --- | --- |
| `settings.json` | Claude Code | Bidirectional |
| `config.toml` | Codex CLI | Bidirectional |
| `.cursorrules` | Cursor | Write-only (generate from canonical) |
| `CLAUDE.md` | Claude Code | Write-only |
| `AGENTS.md` | Codex CLI | Write-only |

---

## The Holster

The Holster is RevealUI's workboard-based coordination layer. It provides:

- **Task claiming** — agents claim tasks before starting work
- **File conflict detection** — agents see what files others are editing
- **Lifecycle management** — registration, heartbeat, crash recovery
- **Workboard state** — a single markdown file readable by humans and agents alike

The workboard at `.claude/workboard.md` is the single source of truth for who is doing what right now. It's designed to be human-readable (it's just a markdown table) and machine-parseable (fixed column format).

### RevHolster

**RevHolster** is the combined system: Holster (workboard state) + VAUGHN (normalization layer). Together they manage multiple agents across all RevealUI surfaces — CLI, editor, desktop, and mobile.

---

## Wire Formats

VAUGHN is wire-format agnostic. The reference implementation supports three transports:

| Transport | Use Case | Format |
| --- | --- | --- |
| **File** (hooks) | Claude Code, Codex CLI | Workboard file mutations — the markdown IS the state |
| **RPC** (daemon) | `@revealui/harnesses` | JSON-RPC 2.0 over Unix domain socket |
| **HTTP** (remote) | Studio desktop, mobile | REST endpoints with bearer token auth |

---

## Security

- **Adapters are trusted but validated.** On registration, the coordinator runs a capability verification probe. Adapters that fail verification are registered with degraded capabilities.
- **Tool output is untrusted.** Adapters sanitize all data parsed from tool CLI output.
- **Workboard is untrusted.** The coordinator validates workboard state on read (rejects malformed rows, future timestamps, invalid identity formats).
- **Credentials are never stored by VAUGHN.** Tool-specific credentials remain in each tool's native store.
- **HTTP transport** binds to localhost only by default, requires bearer tokens, and enforces TLS for non-localhost connections.

---

## Implementation Status

| Phase | Status | What |
| --- | --- | --- |
| **Phase 1: Foundation** | Complete | Holster workboard, file locks, identity cascade, Claude Code adapter, RPC server |
| **Phase 2: VAUGHN Core** | In progress | `VaughnAdapter` interface, event normalization, config sync, Codex adapter |
| **Phase 3: Interop** | Planned | MCP tool reservation, A2A agent cards, HTTP transport, cross-tool config sync |
| **Phase 4: Advanced** | Planned | Session persistence bridge, sandbox abstraction, cloud execution, mobile access |

---

## Related

- **[JOSHUA Stack](./JOSHUA.md)** — Engineering principles that VAUGHN embodies
- **[Pro Guide](./PRO.md)** — Commercial features including harnesses and MCP
- **[Architecture](./ARCHITECTURE.md)** — System design overview
- **[Blog: Three AI Agents, One Codebase](./blog/03-multi-agent-coordination.md)** — The problem that led to the Holster
