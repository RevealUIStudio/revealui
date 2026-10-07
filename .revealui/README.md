# `.revealui` — project manager (all vendors equal)

This directory is the **RevealUI project manager**. Claude, Codex, Grok, Cursor, OpenCode, VS Code, and the native RevealUI agent all have **the same rank**: they are adapters that **reference** this tree. None of them is a second policy home.

## Quality over speed (standing order)

**Quality is always the primary metric** for code, config, and documentation.
Concurrent sessions, cheaper inference, and faster hardware may arrive later;
rushed dual-home shortcuts and unproven docs do not get a pass. Prefer a smaller
correct slice over a larger weak one. Full bar: content rule \`quality-over-speed\`
(from \`@revealui/harnesses\`).

## Authority

| Layer | Role |
|-------|------|
| `@revealui/harnesses` package definitions | Build-time SSOT for rules/skills/commands/agents |
| **`.revealui/` (this tree)** | On-disk manager for the project |
| `.claude` / `.cursor` / `.opencode` / `~/.grok` | Thin adapter stubs or machine prefs only |

## Layout

```text
.revealui/
  manager.json          # adapters[], contentRoot, tracker path, mcp config path
  content/              # generated rules, commands, agents, skills
  adapters/             # optional vendor notes (e.g. grok.md)
  code-standards.json   # code validator standards
  skills/               # committed skill pack (may merge with content/ over time)
  templates/            # package.json script templates
  vscode-plugin/        # VS Code agent plugin (already under manager)
  README.md             # this file
```

## Commands

```bash
# Write manager.json + generate content/ + equal-rank adapter stubs
pnpm exec revealui-harnesses manager materialize

# Verify manager present
pnpm exec revealui-harnesses manager check

# Generate content only (into .revealui/content)
pnpm exec revealui-harnesses content sync --generator claude-code
```

## What adapters must do

1. Open **`manager.json`** when entering the project.
2. Treat **`content/`** as the generated, committed shared-policy tree (from `@revealui/harnesses`). Claude Code loads definition bodies from `.claude/rules/` (GAP-421 mirrors). Grok loads preamble tier 1 from `.grok/rules/` (Grok generator); remaining definition rules are on-demand skills under `.grok/skills/rule-*/`. Do not turn `[compat.claude] rules` on to ingest the Claude dump.
3. Use **tracker.path** for day-to-day free surfaces (fleet: `docs/TRACKER.md`).
4. Product I/O via **RevealUI MCP** (token from revvault / `rfg`) — not vendor side channels.
5. **Do not** full-copy hardlines into `~/.claude` or `~/.grok`.

## Portable Codex delivery

`manager.contentRoot` is a portable relative path under `.revealui/` (default:
`content`). Generation, adapter instructions, content diff, and the skill catalog
resolve this setting through the manager. Absolute paths and traversal are rejected.
Vendor discovery paths remain fixed by each host; changing `contentRoot` does not
change Codex's native `.agents/skills/` discovery path.

`manager materialize` writes regular Codex skill files and their supporting
resources from canonical package definitions. `.revealui/adapters/codex-files.json`
records their ownership hashes. It replaces recognized legacy profile links,
preserves unrelated skills, and rejects unowned files, modified delivery files,
foreign symlinks, and linked destination directories. Retired owned resources
are removed only while their bytes still match the ownership record.

RevCon owns additional profile skills through `.agents/.revcon-manifest.json`.
Its maintained distributor defaults to copy delivery and excludes harness-owned
files after verifying their hashes. Each artifact has exactly one owner.
Edit the owning definitions or profile, then use its maintained materializer.
Do not hand-edit generated copies.

`manager check` blocks missing or stale canonical content and Codex delivery,
including supporting resources. CI runs the same check for `.agents/`, project
instruction files, manager files, and harness changes. Instruction delivery does
not establish runtime dispatch or blocking lifecycle enforcement.

## Local Codex runtime

`CodexAdapter` is exported by `@revealui/harnesses` and registered by the existing
harness auto-detector when `codex app-server` is available. It uses the user's
normal Codex login and configuration; RevealUI does not copy credentials.

The transport is app-server v2 over stdio, verified against Codex CLI 0.160.0.
Each dispatch initializes a child, starts or resumes a thread and one turn, and
returns the authoritative final assistant message only after a completed turn.
An active turn emits `generation-ready` with its task, thread, and turn IDs.
Callers can cancel from that event without polling. Streaming text uses
`generation-progress`; failed and cancelled runs have
separate terminal events and never emit `generation-completed`.

Supported commands are `headless-prompt`, `generate-code`, `analyze-code`,
`get-status`, `get-running-instances`, and `cancel-generation`. Cancellation
accepts an optional `taskId` to prevent cancelling another caller's task. One
adapter instance runs one generation at a time; another dispatch is rejected
until cleanup finishes. `dispose()` cancels active work and releases the child.

Constructor options include `projectRoot`, `model`, `reasoningEffort`,
`timeoutMs`, `binaryPath`, and `sandbox`. The default sandbox is `read-only`;
`workspace-write` requires explicit configuration. Model selection inherits
Codex configuration when omitted. There is a 120-second default timeout and
10 MiB aggregate transport output limit. `maxTurns` is rejected because this
transport slice cannot enforce it. Registered Codex projects must pass native
delivery checks before dispatch; maintained materialization repairs delivery.

Pass a previous result's `threadId` on `headless-prompt` to resume. The adapter
reads stored metadata and rejects threads outside `projectRoot`; it reapplies
the configured sandbox, approval policy, model, instructions, and MCP entries.
A missing or rejected thread fails rather than starting a replacement.

`onApproval(request, signal)` connects a host's review UI. The request includes
native command/file details and task/request IDs. Return `accept`, `decline`,
or `cancel` for that request; cancellation also interrupts generation.
Missing, failed, expired, or invalid review declines;
`approvalTimeoutMs` defaults to 30 seconds. Cancellation and server resolution
abort pending review and discard late answers. Session-wide decisions, policy
amendments, and `grantRoot` requests are not accepted. Other unsupported server
requests receive a protocol error. On Unix, cleanup terminates the process group
and escalates to SIGKILL after 500 ms.

`mcpServers` accepts canonical stdio MCP entries. Supplied servers are required:
startup failure prevents dispatch. For authenticated shared memory, configure
`studioLocalMemory` on the adapter instead of manually supplying the
`knowledge-graph` entry:

```ts
const adapter = new CodexAdapter({
  projectRoot,
  studioLocalMemory: {},
});
try {
  await adapter.execute({
    type: 'publish-memory',
    input: {
      scope: { tenantId: 'studio-local', classification: 'workspace' },
      summary: 'A verified finding',
      siteId: 'revealui',
      subjects: [{ kind: 'concept', name: 'Finding', naturalKey: 'concept:finding' }],
    },
  });
  await adapter.execute({ type: 'query-memory', input: { query: 'Finding' } });
} finally {
  await adapter.dispose();
}
```

The existing RevDev daemon issues the identity. The maintained installed MCP
package supplies its launcher; a global executable on PATH is unnecessary.
Only the public agent ID, harness, and identity-directory path enter the native
MCP configuration. Private signing material stays in the existing identity
cache. `studioLocalMemory` accepts the maintained session boundary's
`socketPath`, `identityDir`, `sessionDir`, `archiveDir`, and `timeoutMs` parameters;
omitting them uses the existing defaults. Explicit relative paths resolve against
the project root, and the nested MCP process receives the resolved identity path.
The existing database configuration
must be available. No home Codex configuration is written.

Memory commands use native `mcpServer/tool/call`, with no model turn or automatic
publication. Missing identity/storage returns unavailable, and unauthorized
scope returns denied. The adapter holds one identity until disposal, which
signs session shutdown and clears local identity/session caches. Cleanup still
clears those caches if the daemon disappears.

Configured adapters advertise the `knowledge-graph` memory backend; the default
profile keeps memory disabled. Tenant, private, and workspace scope applies to
local and hosted reads. Private/workspace-specific graph keys isolate mutable
node metadata; use canonical keys returned by search for node/context lookups.
Repository filtering is not part of the Codex memory command contract.

Historical memory without `keyScopeVersion: 1`, and nodes connected to it, is
hidden from authenticated reads. Reconstructing those records safely is tracked
as `KG-LEGACY-MEMORY-SCOPE-MIGRATION` in the migration audit. Do not stamp the
marker onto old rows: it asserts scoped keys and trustworthy metadata provenance.
Unattributed legacy nodes also remain hidden. Graph scans with valid provenance
remain visible to authorized fleet operators.

Resume, MCP attachment, and configured authenticated memory are supported. Fork,
background execution, coordination, lifecycle hooks, and a packaged review UI
remain follow-up work.

## Machine vs project

| Root | Role |
|------|------|
| `./.revealui` | **This** manager (project) |
| `~/.revealui` | Operator secrets (revvault) + harness config backup — not product policy |

## Related

- GAP-406 (adapter-only + manager)  
- ADR `2026-07-21-harness-policy-runtime-launch-planes`  
- ADR `2026-07-22-single-fleet-tracker`

## Portable adapter delivery

Manager pointers, Cursor hooks, OpenCode agents and commands, and the credential-free
Claude knowledge-graph declaration are committed generated consumers. Local vendor
settings remain ignored. A fresh checkout must pass the same structure and manager
checks as a populated workspace. Regenerate through `manager materialize`; validation
does not regenerate files or hide drift. The Claude pointer is owned by the existing
ownership ledger and must match `.revealui/adapters/claude-code.md`, generated from
the maintained manager template. RevCon preserves this package-owned pointer.
