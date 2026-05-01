# Three AI Agents, One Codebase, No Conflicts

*By Joshua Vaughn  -  RevealUI Studio*

---

I built most of RevealUI with three Claude Code instances running simultaneously.

One in a terminal at the project root, handling builds, deployments, and database migrations. One in the IDE, doing code editing and documentation. One in a second terminal, running the CI gate and catching anything the others missed.

The problem: they kept overwriting each other.

Agent A would be mid-way through refactoring `packages/auth/src/server/oauth.ts`. Agent B, working independently, would open the same file to fix an unrelated import, save its version, and clobber everything A had done. Neither agent knew the other existed. There was no shared state, no communication channel, no way for one to know the other was mid-edit.

The simple fix  -  run one agent at a time  -  eliminates the parallelism that makes the three-agent setup valuable in the first place. If each agent has to wait for the others to finish, you've got sequential work with extra steps.

What I needed was a coordination protocol. Not a distributed lock system. Not an event bus. Something lightweight, file-based, readable by humans and agents alike.

---

## The Workboard

The solution is a markdown file: `.claude/workboard.md`.

```markdown
# RevealUI Workboard
_Last updated: 2026-03-07_

## Active Sessions

| id | env | started | task | files | updated |
|----|-----|---------|------|-------|---------|
| conductor | terminal | 2026-03-07T02:24Z | run pnpm gate | .gitignore, README.md, packages/test/ | 2026-03-07T02:43Z |
| zed-revealui | zed-acp | 2026-03-07T02:24Z | implement Phase 5.5 MCP marketplace | apps/server/src/routes/marketplace.ts, packages/db/src/schema/marketplace.ts | 2026-03-07T02:43Z |

## Recent
- [2026-03-07 02:38] zed-revealui: Phase 5.5 marketplace routes complete
- [2026-03-06 23:00] conductor: Phase 5.4 Forge Docker committed
```

Each agent registers itself when it starts. Each agent claims the files it's working on. Before opening a file to edit, an agent checks whether another session has claimed it.

That's it. No daemon. No network calls. No distributed state. A markdown table.

---

## How Agents Register

The registration happens via a Claude Code hook  -  a shell script that runs on session start:

```javascript
// ~/.claude/hooks/session-start.js
const fs = require('fs')
const path = require('path')
const os = require('os')

const WORKBOARD_PATH = process.env.REVEALUI_WORKBOARD_PATH
const SESSION_ID = process.env.CLAUDE_AGENT_ROLE ?? `session-${process.pid}`

if (!WORKBOARD_PATH) process.exit(0)

// Read current workboard
const content = fs.readFileSync(WORKBOARD_PATH, 'utf8')

// Parse Active Sessions table and add our row
const row = `| ${SESSION_ID} | ${detectEnv()} | ${now()} | starting | | ${now()} |`
const updated = insertRow(content, row)

fs.writeFileSync(WORKBOARD_PATH, updated)
```

The `CLAUDE_AGENT_ROLE` environment variable identifies which agent is which. In `.envrc`:

```bash
export CLAUDE_AGENT_ROLE=zed-revealui
```

In the terminal launch script:

```bash
export CLAUDE_AGENT_ROLE=conductor
```

Every agent gets a stable identity across restarts.

---

## File Ownership

The conflict-prevention mechanism is file claiming. When an agent starts editing a set of files, it stamps its row in the workboard:

```
| zed-revealui | ... | apps/server/src/routes/marketplace.ts, packages/db/src/schema/ | ... |
```

A second agent, before editing `packages/db/src/schema/marketplace.ts`, reads the workboard and sees that `zed-revealui` has claimed that directory. It either waits, picks a different task, or asks the human to resolve the conflict.

The ownership is advisory, not enforced. There's no lock that prevents writes. The protocol relies on agents actually checking before editing  -  which Claude Code does naturally when given the workboard context. If an agent is going to edit a claimed file, it knows to coordinate first.

This is the right level of enforcement. Hard locks create deadlocks. Advisory ownership surfaces conflicts without blocking work.

---

## The PostToolUse Hook

File ownership stamps update automatically via a PostToolUse hook that fires after every file write:

```javascript
// ~/.claude/hooks/post-tool-use.js
// Fires after Write/Edit tool calls — stamps the workboard with edited files

const TOOL_EVENTS_THAT_WRITE = new Set(['Write', 'Edit', 'NotebookEdit'])

const toolName = process.env.CLAUDE_TOOL_NAME
const filePath = process.env.CLAUDE_TOOL_INPUT_file_path

if (!TOOL_EVENTS_THAT_WRITE.has(toolName) || !filePath) process.exit(0)

const sessionId = process.env.CLAUDE_AGENT_ROLE
const workboard = process.env.REVEALUI_WORKBOARD_PATH

// Update the files column in our workboard row
updateFilesColumn(workboard, sessionId, filePath)
```

No manual tracking. The agent edits a file, the hook updates the workboard. Other agents see the claim on their next workboard read.

---

## Stale Session Pruning

Agents crash. Sessions time out. The workboard accumulates ghost entries.

The session-start hook prunes stale rows before registering the new session:

```typescript
function detectStale(sessions: Session[]): Session[] {
  const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000
  return sessions.filter(s => {
    const updatedAt = new Date(s.updated).getTime()
    return updatedAt < fourHoursAgo
  })
}
```

Sessions that haven't written to the workboard in four hours are considered dead and pruned. Their file claims are released.

---

## What This Solves (and Doesn't)

This protocol solves the most common multi-agent problem: two agents editing the same file concurrently without knowing it. It catches this early  -  before the edit happens  -  by surfacing the claim in the workboard context.

It doesn't solve everything:

**Race conditions at the second level**  -  two agents both reading a file, deciding no one else owns it, and both claiming it simultaneously. This is possible but rare in practice. The workboard read-claim-write cycle is fast, and human developers tend to assign tasks to agents sequentially ("now you do X, now you do Y") rather than launching them simultaneously on the same files.

**Semantic conflicts**  -  two agents editing different files that depend on each other. Agent A changes a function signature; Agent B calls that function in another file. No file-level conflict, but a broken build. The CI gate catches this, which is why the gate runs continuously in the third terminal.

**Correctness of claims**  -  an agent might claim files it ends up not editing, blocking other agents unnecessarily. In practice this is fine: claims are scoped to the current task, and task scope is usually clear.

---

## The `@revealui/harnesses` Package

We extracted the workboard protocol into a proper package: [`@revealui/harnesses`](https://github.com/RevealUIStudio/revealui/tree/main/packages/harnesses).

```typescript
import { WorkboardManager, HarnessCoordinator } from '@revealui/harnesses'

const coordinator = new HarnessCoordinator({
  projectRoot: '/path/to/your/project',
  socketPath: '/tmp/revealui-harness.sock',
  task: 'Implement auth middleware',
})

await coordinator.start()
// Registers in workboard, starts RPC server, auto-detects harnesses
```

`WorkboardManager` handles the low-level parsing:

```typescript
const wb = new WorkboardManager('/path/to/.claude/workboard.md')

// Register this session
wb.registerSession({
  id: 'my-agent',
  env: 'terminal',
  started: new Date().toISOString(),
  task: 'Add rate limiting',
  files: '',
  updated: new Date().toISOString(),
})

// Claim files before editing
wb.claimFiles('my-agent', ['src/middleware/rate-limit.ts'])

// Check for conflicts before editing
const { clean, conflicts } = wb.checkConflicts('my-agent', ['src/middleware/rate-limit.ts'])
if (!clean) {
  console.warn('Claimed by:', conflicts)
}

// Release when done
wb.releaseFiles('my-agent')
```

The package also includes adapters for Claude Code, Cursor, and Aider  -  so you can coordinate across different AI tools on the same codebase.

---

## Try It

The hooks live in `~/.claude/hooks/` and are wired in `~/.claude/settings.json`. The workboard itself is just a markdown file you check into your repo at `.claude/workboard.md`.

If you're running multiple AI coding agents on the same codebase, the workboard protocol is the lowest-overhead coordination mechanism I've found. It's readable by humans, greppable, diffable, and doesn't require any infrastructure beyond a shared filesystem.

The `@revealui/harnesses` package is part of RevealUI Pro. The protocol itself  -  the markdown format, the hook scripts, the coordination rules  -  is documented in full in the [RevealUI repo](https://github.com/RevealUIStudio/revealui/blob/main/docs/PRO.md) and free to implement yourself.

---

*RevealUI is an open-source business runtime for software companies. [revealui.com](https://revealui.com)*
