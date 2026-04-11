# VAUGHN — Versioned Agent Unification, Governance, Handoff, and Normalization

**Version:** 0.1.0 (Draft)
**Status:** Proposal
**Authors:** RevealUI Studio
**Date:** 2026-03-30

> VAUGHN is a protocol for normalizing agent capabilities, lifecycle events, and
> inter-agent coordination across heterogeneous AI coding tools. It sits between
> the tool-specific runtime (Claude Code, Codex CLI, Cursor, etc.) and the
> coordination layer (Holster workboard), providing a uniform interface that
> lets any compliant agent participate in multi-agent workflows.

---

## 1. Problem Statement

AI coding agents share no common runtime interface. Each tool has its own:

- Lifecycle events (Claude Code: 8+, Codex: 5, Cursor: 0)
- Instruction format (CLAUDE.md vs AGENTS.md vs .cursorrules)
- Configuration schema (JSON vs TOML vs YAML)
- Permission model (hooks vs OS sandbox vs manual approval)
- Tool invocation (MCP vs native tools vs API calls)
- Session persistence (none vs SQLite vs file-based)
- Multi-agent model (teams vs threads vs none)

This means:
1. Rules written for one tool don't work in another
2. Agents from different tools can't coordinate
3. Adding support for a new tool requires reimplementing everything
4. Users must maintain parallel configs that drift

VAUGHN solves this by defining a **canonical representation** for agent capabilities, events, and configuration, plus **adapters** that translate between the canonical form and each tool's native interface.

---

## 2. Design Principles

1. **Canonical, not lowest-common-denominator.** VAUGHN defines the full superset of capabilities. Adapters degrade gracefully when a tool lacks a feature, rather than omitting the feature entirely.
2. **Translation, not abstraction.** VAUGHN does not replace MCP, A2A, or the Holster workboard. It translates between them so they can interoperate.
3. **Statically verifiable.** An adapter declares its capabilities at registration time. The coordinator knows what each agent can and cannot do before dispatching work.
4. **Wire-format agnostic.** VAUGHN defines operations and types, not serialization. Implementations may use JSON-RPC, protobuf, file I/O, or HTTP — the protocol is the same.
5. **Additive only.** New capabilities extend the protocol without breaking existing adapters. Unknown capabilities are ignored, not rejected.

---

## 3. Protocol Layers

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

Orthogonal:
┌────────────┐  ┌────────────┐
│    MCP     │  │    A2A     │
│ (tools)    │  │ (discovery)│
└────────────┘  └────────────┘
```

### 3.1 VAUGHN Adapter

The adapter is the boundary between a tool's native interface and the VAUGHN protocol. Each adapter:

- Declares its **capabilities** (what the tool can do)
- Translates **lifecycle events** (tool-native → VAUGHN canonical)
- Generates **configuration files** (VAUGHN canonical → tool-native)
- Exposes **operations** (VAUGHN commands → tool-native execution)

### 3.2 Holster Coordinator

The coordinator consumes VAUGHN adapters and provides:

- Task assignment based on agent capabilities
- File conflict detection across agents
- Lifecycle management (registration, heartbeat, crash recovery)
- Workboard state synchronization

### 3.3 MCP Integration

MCP servers are available to all VAUGHN-registered agents through the hypervisor. VAUGHN does not wrap MCP — it ensures that MCP tool access is coordinated (e.g., two agents don't call `stripe_create_customer` for the same tenant simultaneously).

### 3.4 A2A Integration

A2A agent cards can advertise VAUGHN capabilities. A VAUGHN-aware agent can discover other agents via A2A, then coordinate via the Holster workboard.

---

## 4. Capability Model

### 4.1 Capability Declaration

Each adapter declares a static capability set at registration:

```typescript
interface VaughnCapabilities {
  // Dispatch operations — can the ADAPTER programmatically invoke these?
  // Note: all AI tools generate code, analyze code, etc. under their own
  // control. These flags indicate whether the adapter can programmatically
  // REQUEST the tool to perform these operations (e.g., send a prompt and
  // receive structured output). Interactive-only tools score false here
  // because the adapter cannot invoke them without a human at the keyboard.
  dispatch: {
    generateCode: boolean;      // Adapter can send a prompt and get code back
    analyzeCode: boolean;       // Adapter can request code analysis
    applyEdit: boolean;         // Adapter can send a diff to apply
    executeCommand: boolean;    // Adapter can invoke shell commands
  };

  // Coordination
  readWorkboard: boolean;       // Can query workboard state
  writeWorkboard: boolean;      // Can modify workboard state
  claimTasks: boolean;          // Can participate in task claiming protocol
  reportConflicts: boolean;     // Can detect file conflicts

  // Lifecycle
  headless: boolean;            // Can run without user interaction
  resumable: boolean;           // Can resume from a saved session
  forkable: boolean;            // Can fork a session into a new branch
  backgroundable: boolean;      // Can run tasks in background

  // Safety
  hooks: {
    supported: boolean;         // Can intercept tool calls via hooks
    granularity: 'none' | 'bash-only' | 'all-tools';
    canBlock: boolean;          // Hook can deny/block a tool call
  };
  sandbox: {
    supported: boolean;         // Has OS-level sandboxing
    modes: SandboxMode[];       // Available configurations
    writablePaths?: string[];   // Current sandbox write scope
  };
  supportsWorktrees: boolean;   // Can work in isolated git worktrees

  // Context
  supportsSkills: boolean;      // Can load skill definitions
  supportsMcp: boolean;         // Can connect to MCP servers
  memory: {
    supported: boolean;         // Has persistent cross-session memory
    backend: 'none' | 'sqlite' | 'crdt' | 'file';
  };
  maxContextTokens: number;     // Approximate context window size

  // Events
  lifecycleEvents: VaughnEvent[]; // Which lifecycle events the tool emits
}
```

### 4.2 Known Capability Profiles

| Capability | Claude Code | Codex CLI | Cursor | RevealUI Agent |
|---|---|---|---|---|
| dispatch.generateCode | false | false | false | **true** |
| dispatch.analyzeCode | false | false | false | **true** |
| dispatch.applyEdit | false | false | false | **true** |
| dispatch.executeCommand | false | false | false | **true** |
| headless | **true** (`-p`) | **true** (`exec`) | false | **true** |
| resumable | false | **true** (`resume`) | false | false |
| forkable | false | **true** (`fork`) | false | false |
| hooks.granularity | `all-tools` | `bash-only` | `none` | `all-tools` |
| hooks.canBlock | **true** | **true** (Bash only) | false | **true** |
| sandbox.supported | false | **true** | false | false |
| supportsWorktrees | **true** | false | false | **true** |
| supportsMcp | **true** | **true** | false | **true** |
| memory.backend | `none` | `sqlite` | `none` | `crdt` |

**Why `dispatch.*` is false for Claude Code and Codex:** These tools are interactive — a human submits prompts and approves actions. The adapter can observe and coordinate (via hooks and workboard) but cannot programmatically send prompts and receive structured results. The RevealUI Agent adapter CAN do this because it exposes a headless API for programmatic dispatch.

---

## 5. Lifecycle Events

### 5.1 Canonical Event Set

VAUGHN defines 10 canonical lifecycle events. Adapters map tool-native events to this set.

```typescript
type VaughnEvent =
  | 'session.start'        // Agent session begins
  | 'session.stop'         // Agent session ends (graceful)
  | 'session.crash'        // Agent session ends (unexpected)
  | 'prompt.submit'        // User submits a prompt
  | 'tool.before'          // Before a tool call executes
  | 'tool.after'           // After a tool call completes
  | 'tool.blocked'         // A tool call was denied
  | 'task.claimed'         // Agent claimed a workboard task
  | 'task.completed'       // Agent completed a workboard task
  | 'agent.heartbeat'      // Periodic liveness signal
```

### 5.2 Event Mapping

| VAUGHN Event | Claude Code | Codex CLI | Cursor | RevealUI Agent |
|---|---|---|---|---|
| `session.start` | SessionStart | SessionStart | (manual) | start() |
| `session.stop` | Stop | Stop | (manual) | stop() |
| `session.crash` | (inferred from stale row) | (inferred) | (inferred) | process.on('exit') |
| `prompt.submit` | UserPromptSubmit | UserPromptSubmit | N/A | executePrompt() |
| `tool.before` | PreToolUse (all tools) | PreToolUse (Bash only) | N/A | beforeTool() |
| `tool.after` | PostToolUse | PostToolUse | N/A | afterTool() |
| `tool.blocked` | PreToolUse exit(2) | PreToolUse exit(2) | N/A | blockTool() |
| `task.claimed` | (workboard write) | (workboard write) | N/A | claimTask() |
| `task.completed` | (workboard write) | (workboard write) | N/A | completeTask() |
| `agent.heartbeat` | (workboard timestamp) | (workboard timestamp) | N/A | heartbeat() |

### 5.3 Degradation Model

When a tool does not emit a native event for a VAUGHN event, the adapter applies one of three strategies:

| Strategy | When Used | Guarantee |
|---|---|---|
| **Polyfill** | The adapter can synthesize the event from other signals | Same semantics, higher latency |
| **Degrade** | Partial functionality is possible | Weaker guarantee, explicitly documented |
| **Absent** | No meaningful approximation exists | Capability is reported as missing |

**Per-event degradation:**

| VAUGHN Event | Absent Tool Support | Strategy | Fallback Behavior |
|---|---|---|---|
| `tool.before` | Codex (non-Bash tools) | **Degrade** | No pre-execution blocking. Safety relies on (1) Codex's OS sandbox, (2) workboard file reservations, (3) post-execution conflict detection. The coordinator MUST NOT assume `tool.before` provides safety guarantees for Codex non-Bash operations. |
| `tool.before` | Cursor | **Absent** | Cursor adapter operates in passive/read-only mode. Cannot block any operation. |
| `session.crash` | All tools | **Polyfill** | Inferred from stale heartbeat (>4h without workboard timestamp update). Coordinator marks claimed tasks as `partial (orphaned)`. Latency: up to 4h detection delay. |
| `prompt.submit` | Cursor | **Absent** | No prompt interception. Cursor adapter only observes file changes. |
| `agent.heartbeat` | All tools | **Polyfill** | Synthesized from workboard timestamp updates. Not a real heartbeat signal — accuracy depends on tool's workboard write frequency. |

**Safety implications of degradation:**
- A degraded `tool.before` is NOT equivalent to a present `tool.before`. The coordinator MUST track which agents have blocking capability and which don't. When dispatching safety-critical tasks (e.g., database migrations), prefer agents with `hooks.canBlock: true`.
- Cursor's passive mode means it can participate in read-only coordination (seeing what others are working on) but cannot enforce any VAUGHN protocol rules. It is an observer, not a participant.

### 5.4 Event Envelope

Every VAUGHN event carries a standard envelope:

```typescript
interface VaughnEventEnvelope {
  version: '0.1.0';
  event: VaughnEvent;
  timestamp: string;          // ISO 8601
  agentId: string;            // Holster agent identity
  toolName: string;           // 'claude-code' | 'codex' | 'cursor' | 'revealui-agent' | string
  sessionId: string;          // Unique per session
  payload: Record<string, unknown>;  // Event-specific data
}
```

---

## 6. Configuration Normalization

### 6.1 Canonical Configuration

VAUGHN defines a canonical configuration schema that adapters translate to/from tool-native formats.

```typescript
interface VaughnConfig {
  // Identity
  identity: {
    name: string;              // Display name
    email: string;             // Git identity
    role?: string;             // Agent role hint
  };

  // Permissions
  permissions: {
    autoApprove: string[];     // Tool patterns to auto-approve
    deny: string[];            // Tool patterns to always deny
    sandboxMode?: 'read-only' | 'workspace-write' | 'full-access';
  };

  // Environment
  environment: {
    variables: Record<string, string>;
    mcpServers: McpServerConfig[];
  };

  // Rules (tool-agnostic instructions)
  rules: VaughnRule[];

  // Skills
  skills: VaughnSkill[];

  // Commands (slash commands / custom actions)
  commands: VaughnCommand[];
}
```

### 6.2 Format Adapters

| Source Format | Tool | Adapter Direction |
|---|---|---|
| `settings.json` (JSON) | Claude Code | Bidirectional |
| `config.toml` (TOML) | Codex CLI | Bidirectional |
| `.cursorrules` (Markdown) | Cursor | Write-only (generate from canonical) |
| `CLAUDE.md` (Markdown) | Claude Code | Write-only (generate from canonical) |
| `AGENTS.md` (Markdown) | Codex CLI | Write-only (generate from canonical) |

### 6.3 Rule Normalization

Rules are defined once in canonical form and generated to each tool's format:

```typescript
interface VaughnRule {
  id: string;                  // 'biome', 'database-boundaries', etc.
  description: string;
  content: string;             // Markdown with template variables
  appliesTo: string[];         // File glob patterns where rule is relevant
  variables: Record<string, string>;  // Template variable defaults
}
```

**Generation targets:**
- Claude Code: `.claude/rules/{id}.md` (YAML frontmatter + markdown)
- Codex CLI: Inlined into `AGENTS.md` or `.agents/skills/{id}/SKILL.md`
- Cursor: Appended to `.cursorrules`

---

## 7. Operations

### 7.1 Adapter Operations

Every VAUGHN adapter implements this interface:

```typescript
interface VaughnAdapter {
  // Identity
  readonly id: string;                    // 'claude-code', 'codex', etc.
  readonly capabilities: VaughnCapabilities;

  // Lifecycle
  initialize(): Promise<void>;
  dispose(): Promise<void>;
  isAvailable(): Promise<boolean>;        // Can the tool be detected?
  getVersion(): Promise<string | null>;   // Tool version string

  // Events (adapter → coordinator)
  onEvent(handler: (event: VaughnEventEnvelope) => void): void;

  // Operations (coordinator → adapter)
  execute?(command: VaughnCommand): Promise<VaughnCommandResult>;

  // Configuration
  generateConfig(config: VaughnConfig): Promise<GeneratedFiles>;
  readConfig?(): Promise<Partial<VaughnConfig>>;

  // Workboard (if capable)
  readWorkboard?(): Promise<WorkboardState>;
  writeWorkboard?(state: WorkboardState): Promise<void>;
}
```

### 7.2 Coordinator Operations

The coordinator exposes these to consumers (CLI, RPC, HTTP):

```typescript
interface VaughnCoordinator {
  // Registration
  registerAdapter(adapter: VaughnAdapter): void;
  unregisterAdapter(id: string): Promise<void>;
  listAdapters(): VaughnAdapterInfo[];

  // Task management (delegates to Holster workboard)
  claimTask(taskId: string, agentId: string): Promise<ClaimResult>;
  completeTask(taskId: string, agentId: string): Promise<void>;
  markPartial(taskId: string, notes: string): Promise<void>;
  releaseTask(taskId: string): Promise<void>;

  // Conflict detection
  checkConflicts(agentId: string, files: string[]): ConflictReport;

  // Configuration sync
  syncConfig(direction: 'push' | 'pull'): Promise<SyncResult>;
  diffConfig(): Promise<ConfigDiff[]>;

  // Health
  healthCheck(): Promise<HealthReport>;

  // MCP tool access coordination
  reserveTool(agentId: string, toolName: string): Promise<boolean>;
  releaseTool(agentId: string, toolName: string): void;
}
```

---

## 8. Identity

### 8.1 Agent Identity Resolution

VAUGHN uses a 7-tier identity cascade (extending Holster's 6-tier):

| Priority | Source | Example |
|---|---|---|
| 1 | Explicit env var (`VAUGHN_AGENT_ID`) | `conductor` |
| 2 | Tool-specific env var (`CLAUDE_AGENT_ROLE`) | `revealui-terminal` |
| 3 | Session cache (`/tmp/vaughn-session-<ppid>.id`) | (reuse) |
| 4 | Process tree walk (`/proc` for tool binaries) | `claude-1`, `codex-1` |
| 5 | IDE detection (Zed, VS Code, Cursor) | `agent-extension` |
| 6 | CWD inference | `conductor` |
| 7 | Generic indexed | `agent-system-1` |

### 8.2 Identity Format

VAUGHN supports two identity formats:

**Structured format** (new agents):
```
<tool>-<role>[-<index>]
```
Examples: `claude-root`, `codex-builder-2`, `cursor-edit`, `revagent-headless-1`

**Legacy format** (existing Holster identities):
```
<role>[-<qualifier>][-<index>]
```
Examples: `conductor`, `agent-extension`, `agent-system-2`, `revealui-terminal`

Both formats are valid. The coordinator accepts either. The `tool` prefix is optional — when absent, the coordinator infers the tool from the adapter that registered the identity. Legacy identities from existing Holster deployments continue to work without migration.

---

## 9. Wire Formats

VAUGHN is wire-format agnostic. Reference implementations use:

### 9.1 File Transport (hooks)

Events are communicated via workboard file mutations. No separate wire format — the workboard markdown IS the state.

### 9.2 RPC Transport (daemon)

JSON-RPC 2.0 over Unix domain socket:

```json
{"jsonrpc": "2.0", "id": 1, "method": "vaughn.claimTask", "params": {"taskId": "T-001", "agentId": "claude-root"}}
{"jsonrpc": "2.0", "id": 1, "result": {"success": true, "task": {...}}}
```

### 9.3 HTTP Transport (remote)

REST endpoints for Studio desktop and mobile:

```
POST /vaughn/v1/tasks/{taskId}/claim     { "agentId": "..." }
POST /vaughn/v1/tasks/{taskId}/complete  { "agentId": "..." }
GET  /vaughn/v1/workboard                → WorkboardState
GET  /vaughn/v1/agents                   → VaughnAdapterInfo[]
POST /vaughn/v1/config/sync              { "direction": "push" | "pull" }
```

---

## 10. Protocol Interop Matrix

### 10.1 How VAUGHN Relates to A2A and MCP

| Protocol | Concern | VAUGHN's Role |
|---|---|---|
| **MCP** | Tool discovery and invocation | VAUGHN coordinates which agent invokes which MCP tool. The hypervisor handles process management; VAUGHN prevents conflicts (e.g., two agents writing to the same Stripe customer). |
| **A2A** | Agent discovery and task delegation | VAUGHN agents can expose A2A agent cards. The `agentDefinitionToAgentCard()` function in `@revealui/mcp` already does this. VAUGHN adds lifecycle coordination that A2A does not define. |
| **Holster** | Workboard-based task coordination | VAUGHN is the programmatic interface to Holster. Holster defines the workboard format and claiming protocol; VAUGHN provides the adapter layer that lets heterogeneous tools participate. |

### 10.2 What Each Protocol Owns

```
A2A:     "Here are the agents available and what they can do"
MCP:     "Here are the tools available and how to call them"
VAUGHN:  "Here is how agents coordinate to use tools safely together"
Holster: "Here is the shared state where coordination happens"
```

They are complementary:
- A2A handles **discovery** (who exists?)
- MCP handles **invocation** (how do I call this tool?)
- VAUGHN handles **normalization** (how do different agents speak the same language?)
- Holster handles **state** (who is doing what right now?)

---

## 11. Error Model

### 11.1 Error Categories

```typescript
type VaughnErrorCode =
  | 'ADAPTER_UNAVAILABLE'      // Tool not installed or not responding
  | 'CAPABILITY_MISSING'       // Requested operation not supported by adapter
  | 'TASK_ALREADY_CLAIMED'     // Another agent owns this task
  | 'TASK_NOT_FOUND'           // Task ID doesn't exist in workboard
  | 'CONFLICT_DETECTED'        // File reservation overlap
  | 'HOOK_BLOCKED'             // Tool hook denied the operation
  | 'SANDBOX_DENIED'           // OS sandbox blocked the operation
  | 'SESSION_EXPIRED'          // Agent heartbeat timed out
  | 'CONFIG_INVALID'           // Canonical config failed validation
  | 'TOOL_RESERVED'            // MCP tool is currently reserved by another agent
  | 'WORKBOARD_LOCKED'         // Workboard file lock acquisition failed
  | 'IDENTITY_CONFLICT'        // Two agents resolved to the same identity
```

### 11.2 Error Envelope

```typescript
interface VaughnError {
  code: VaughnErrorCode;
  message: string;
  agentId?: string;
  taskId?: string;
  recoverable: boolean;        // Can the caller retry?
  suggestedAction?: string;    // Human-readable recovery hint
}
```

---

## 12. Concurrency and Atomicity

### 12.1 Task Claiming Atomicity

Task claiming MUST be atomic. Implementations:

- **File transport:** `O_EXCL` lock acquisition → read workboard → verify task status is `available` or `partial` → write updated workboard → release lock. If lock acquisition fails after timeout, return `WORKBOARD_LOCKED`.
- **RPC transport:** The coordinator serializes all workboard mutations through a single write lock. Concurrent `claimTask` calls are queued.
- **HTTP transport:** The server holds a per-workboard mutex. Claims are serialized. For cross-machine coordination, use a distributed lock (Redis SETNX or database advisory lock).

### 12.2 Race Condition Handling

| Scenario | Resolution |
|---|---|
| Two agents claim the same task simultaneously | First lock acquisition wins. Second gets `TASK_ALREADY_CLAIMED`. |
| Agent crashes while holding lock | Dead-holder detection via `process.kill(pid, 0)` (file transport) or lock TTL (HTTP transport). Stale locks are broken after 5s. |
| Agent crashes after claim, before work | Coordinator detects stale heartbeat (>4h). Marks task `partial (orphaned)`. |
| Workboard file corrupted mid-write | Atomic writes via tmp-file + rename. Readers see either the old or new state, never partial. |
| Two coordinators on different machines | NOT SUPPORTED in v0.x. Cross-machine coordination requires a centralized state store (Phase 4). The HTTP transport is for remote clients talking to a single coordinator, not for coordinator-to-coordinator sync. |

### 12.3 MCP Tool Reservation Semantics

```typescript
interface ToolReservation {
  agentId: string;
  toolName: string;           // Namespaced: @@mcp_{server}_{tool}
  scope: 'global' | 'tenant'; // Global = no other agent can call. Tenant = no other agent can call for the same tenant.
  ttlMs: number;              // Max reservation duration (default: 30_000)
  acquiredAt: number;         // Date.now()
}
```

- **Default scope:** `tenant` (most MCP tools are tenant-scoped)
- **Crash recovery:** Reservations expire after `ttlMs`. The coordinator's heartbeat check clears expired reservations.
- **Contention:** If a tool is reserved, callers get `TOOL_RESERVED` with `suggestedAction: "retry after {resetMs}ms"`.
- **Read-only tools** (e.g., `list_deployments`) are never reserved. Only write operations participate in reservation.
- Tool reservation is orthogonal to MCP hypervisor tenant isolation. The hypervisor handles process-level isolation; VAUGHN reservation handles coordination-level isolation.

---

## 13. Security Considerations

### 13.1 Trust Boundaries

- **Adapters are trusted but validated.** Adapters run in the coordinator process. On registration, the coordinator runs a capability verification probe: it calls `isAvailable()`, checks the declared version, and optionally runs a capability smoke test (e.g., if `supportsWorktrees: true`, verify `git worktree list` succeeds). Adapters that fail verification are registered with degraded capabilities.
- **Tool output is untrusted.** Adapter implementations MUST sanitize all data parsed from tool CLI output (stdout, stderr, exit codes). Malformed JSON, unexpected exit codes, or injection attempts in tool output MUST NOT propagate as trusted VAUGHN events.
- **Workboard is untrusted.** The workboard file can be edited by any process. The coordinator validates workboard state on read:
  - Rejects rows with missing required fields
  - Rejects timestamps more than 24h in the future
  - Rejects agent IDs that don't match the `<tool>-<role>[-<index>]` or legacy format
  - Preserves unrecognized sections (forward compatibility)

### 13.2 Credential Isolation

- VAUGHN never stores credentials. Tool-specific credentials remain in each tool's native store.
- MCP server credentials are managed by the hypervisor's `MCPCredentialResolver`, not VAUGHN.
- Config sync classifies values as sensitive using:
  1. Key name pattern matching: `*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`, `*_CREDENTIAL`
  2. Value pattern matching: known prefixes (`sk-`, `ghp_`, `npm_`, `xoxb-`)
  3. Explicit `sensitive: true` flag in canonical config
  - Sensitive values are replaced with `<REDACTED:{key_name}>` in sync output
  - The receiving side preserves existing sensitive values if the sync payload contains redacted placeholders

### 13.3 HTTP Transport Security

HTTP endpoints MUST implement:
- **Authentication:** Bearer token (`Authorization: Bearer <token>`). Tokens are generated by the coordinator on startup and stored in a file readable only by the coordinator's user (`0600`).
- **Bind address:** `127.0.0.1` only by default. Remote access requires explicit opt-in via config.
- **Rate limiting:** 100 req/s per client IP.
- **CORS:** Disabled by default. Studio desktop uses same-origin. Mobile app uses the bearer token.
- **TLS:** Required for non-localhost connections. Self-signed cert generated on first run; users can provide their own.

### 13.4 Sandbox Interaction

- When an adapter reports `supportsSandbox: true`, the coordinator respects the tool's sandbox boundaries. It will not dispatch file-write operations to a sandboxed agent unless the target path is within the sandbox's write scope.
- The adapter MUST report the current sandbox mode and writable paths. The coordinator uses this to filter task candidates.
- VAUGHN does not implement sandboxing itself.

---

## 14. Versioning and Negotiation

### 14.1 Version Scheme

Protocol version follows semver: `MAJOR.MINOR.PATCH`
- MAJOR: breaking changes to adapter interface or event envelope
- MINOR: new capabilities, events, or operations (backward compatible)
- PATCH: clarifications, typo fixes

**Pre-1.0 convention:** During `0.x`, MINOR bumps may break. Adapters MUST check the full `MAJOR.MINOR` pair, not just MAJOR.

### 14.2 Negotiation Handshake

On `registerAdapter()`, the coordinator and adapter exchange versions:

```typescript
interface VaughnHandshake {
  coordinatorVersion: string;  // e.g., '0.1.0'
  adapterVersion: string;      // e.g., '0.1.0'
  minimumVersion: string;      // Minimum version the adapter supports
}
```

**Rules:**
1. If `adapterVersion.major !== coordinatorVersion.major` (or `minor` during 0.x): reject with `INCOMPATIBLE_VERSION`.
2. If `adapterVersion.minor < coordinatorVersion.minor`: accept with degraded capabilities. The coordinator disables any capabilities added after the adapter's version.
3. If `adapterVersion.minor > coordinatorVersion.minor`: accept. Unknown capabilities from newer adapters are ignored by the coordinator (additive-only principle).

### 14.3 Capability Discovery vs Declaration

Static capability declarations can lie. The coordinator optionally verifies declared capabilities at registration:

| Capability | Verification Method |
|---|---|
| `headless` | Attempt `execute()` with a no-op prompt; check for response |
| `supportsWorktrees` | Run `git worktree list` and check exit code |
| `supportsMcp` | Check if tool's MCP config path exists |
| `hooks.supported` | Check if tool's hooks config file exists |
| `sandbox.supported` | Check for OS-specific sandbox binary (seatbelt/bubblewrap) |

Failed verifications downgrade the declared capability to `false` and log a warning. The adapter is still registered.

---

## 15. Implementation Roadmap

### Phase 1: Foundation (current)
- [x] Holster workboard protocol (v2)
- [x] Workboard manager (TypeScript)
- [x] File lock implementation
- [x] Session identity detection (6-tier)
- [x] Claude Code adapter (hooks + workboard)
- [x] Content layer (canonical definitions → tool-specific generation)
- [x] RPC server (JSON-RPC over Unix socket)

### Phase 2: VAUGHN Core
- [ ] Define `VaughnAdapter` interface in `@revealui/harnesses`
- [ ] Implement native `VaughnAdapter` (replaces removed vendor adapters)
- [ ] Event normalization layer (tool events → VAUGHN events)
- [ ] Capability-aware task dispatch in coordinator
- [ ] Config normalization (JSON ↔ TOML ↔ Markdown)
- [ ] VAUGHN identity cascade (7-tier, extending Holster's 6-tier)

### Phase 3: Interop
- [ ] MCP tool reservation (prevent concurrent conflicting calls)
- [ ] A2A agent card generation with VAUGHN capabilities
- [ ] HTTP transport for Studio desktop
- [ ] Codex hook normalization (5 events → degraded VAUGHN mapping)
- [ ] Cross-tool config sync (Claude ↔ Codex bidirectional)

### Phase 4: Advanced
- [ ] Session persistence bridge (shared memory across tools)
- [ ] Sandbox policy abstraction
- [ ] Cloud execution bridge (CronCreate ↔ codex cloud exec)
- [ ] Mobile/remote workboard access via HTTP transport
- [ ] Automated capability testing (verify adapter claims)

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **VAUGHN** | Versioned Agent Unification, Governance, Handoff, and Normalization — this protocol |
| **Adapter** | VAUGHN boundary component that translates between a tool's native interface and the VAUGHN protocol |
| **Holster** | RevealUI's workboard-based agent coordination system |
| **RevHolster** | The product/project name for the combined VAUGHN + Holster system |
| **Coordinator** | The runtime that manages adapters, dispatches tasks, and resolves conflicts |
| **Capability** | A declared feature of an adapter (e.g., `headless`, `supportsWorktrees`) |
| **Canonical** | The tool-agnostic form of a rule, config, or event |
| **Degradation** | When a tool lacks a capability, the adapter provides the best available fallback |
| **Heartbeat** | Periodic liveness signal from an agent, inferred from workboard timestamp updates |

## Appendix B: Relation to Existing Code

| VAUGHN Concept | Current Implementation | Package |
|---|---|---|
| VaughnAdapter | `HarnessAdapter` interface | `@revealui/harnesses` |
| VaughnCoordinator | `HarnessCoordinator` class | `@revealui/harnesses` |
| WorkboardManager | `WorkboardManager` class | `@revealui/harnesses` |
| Event normalization | Hook scripts (session-start, pre-tool-use, etc.) | `~/.claude/hooks/` |
| Config generation | `ClaudeCodeGenerator`, content layer | `@revealui/harnesses` |
| MCP integration | `MCPHypervisor`, pipeline, auth | `@revealui/mcp` |
| A2A integration | `agentDefinitionToAgentCard()` | `@revealui/mcp` |
| Identity detection | `session-identity.ts` + `session-start.js` | `@revealui/harnesses` + hooks |
| RPC transport | `rpc-server.ts` | `@revealui/harnesses` |
| File locking | `file-lock.ts` | `@revealui/harnesses` |
