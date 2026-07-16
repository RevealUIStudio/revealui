# Multi-Instance Coordination

Multiple Claude Code instances may work on this repo simultaneously (e.g. terminal + Zed editor). A shared workboard at `.claude/workboard.md` tracks sessions, tasks, and file reservations.

## Identity

Agent identity is resolved automatically by `session-start.js` using a 3-tier detection cascade. The result is cached for the session in `/tmp/revealui-session-<ppid>.id`.

### Identity Taxonomy

| Identity | Detection Signal | Context |
|----------|-----------------|---------|
| `conductor` | `CLAUDE_AGENT_ROLE=conductor` | Primary orchestration agent |
| `agent-extension` | `/proc` walk finds `zed` + no `CLAUDE_TERMINAL_CONTEXT` | Zed ACP inline (editor extension) |
| `agent-extension-2`, `-3`... | same, second+ Zed window | Multiple editor extension instances |
| `agent-edit` | `/proc` walk finds `zed` + `CLAUDE_TERMINAL_CONTEXT=zed-terminal` | Zed integrated terminal |
| `agent-edit-2`, `-3`... | same, second+ instance | Multiple editor terminals |
| `agent-system` | `WT_SESSION` present (any WT profile) | Any Windows Terminal / plain WSL terminal |
| `agent-system-2`, `-3`... | same, second+ instance | Multiple system terminals |
| (daemon-assigned) | `CLAUDE_AGENT_ROLE` set by SpawnerService | Native terminal PTY sessions |

### Detection Cascade (3 tiers)

1. **Explicit env var** — `CLAUDE_AGENT_ROLE` set (daemon SpawnerService, shell export). Highest priority. Legacy values (`zed-extension`, `wsl`, `forge`, etc.) are aliased to canonical names. Daemon-spawned agents get identity assigned at spawn time.
2. **Session cache** — `/tmp/revealui-session-<ppid>.id` with timestamp. Reuses previous detection within 8h.
3. **Auto-detect** — Zed (proc walk), Windows Terminal (`WT_SESSION`), or generic `agent-system-N`. Indexed via `nextIndexedId` against workboard active rows.

### Configuration

Profile mappings are in `~/.claude/agent-profiles.json`:
- `wt_profiles`: maps Windows Terminal profile GUID → identity
- `default_zed_extension_name` / `default_zed_terminal_name`: override Zed auto-detection names

On session start, the detected identity is logged. You can check it in the workboard Sessions table.

## Automated Lifecycle (hooks handle this)

The following happen **automatically** — do not do them manually:

- **Session start**: `session-start.js` registers your row with `(starting)` and prunes rows older than 4 hours.
- **File tracking**: `workboard-update.js` updates your `files` and `updated` columns on every Edit/Write.
- **Session end**: `stop.js` removes your row and prepends a Recent entry from your `task` description. If your `files` column is non-empty, it prints a handoff warning.

## Agent Responsibilities

1. **On first real task**: Update your `task` column — change it from `(starting)` to a short description of what you're doing. This is the description that gets written to Recent on exit.
2. **Before each task**: Re-read the workboard. Check `files` of other sessions for conflicts.
3. **During work**: Update `task` as your work evolves. The hooks keep `files` and `updated` current.
4. **After completing work**: Add a timestamped Recent entry with results. Leave `task` updated so the stop hook records it accurately.

## Stale Sessions

Rows older than 4 hours are pruned automatically by `session-start.js` on any agent's next session start. You do not need to clean up manually.

## Handoff Protocol

When you stop with incomplete work that another agent must continue:

1. **Update your `task` column** before stopping: `HANDOFF-><role>: <what's left>` (e.g. `HANDOFF->revealui-terminal: run pnpm gate after schema change`)
2. **Tag the next agent in Plans**: add `<- HANDOFF from <your-id>` next to the relevant task
3. The stop hook will print a warning and write your task description (including the `HANDOFF->` prefix) to Recent — the next agent will see it immediately on workboard read

The receiving agent should:
1. Remove the `HANDOFF->` prefix from the Plans task once picked up
2. Update their own `task` column to reflect they've taken it over

## Archive-Readiness Convention

When preparing a session for archive (full handoff to a new session, not just a sub-agent handoff within the same session), the **final output to the owner** must be a copy-pasteable "next-agent prompt" they can drop straight into a new Claude Code session — no synthesis required, no jumping between docs to assemble context.

The prompt is non-negotiable. Without it, the owner has to do friction work (read handoff doc + workboard + memories + figure out the first action) every time a session hands off. That friction adds up across the fleet.

### What the prompt must include

1. **Session id + handoff-doc path** as the first line. The next agent must read the handoff before doing anything else.
2. **TL;DR**: 1–2 sentences capturing the lane's state and the single most important next action.
3. **Ordered next-actions with exact commands / values / file paths**. No "investigate X" or "decide Y" — those belong in the handoff doc body. Prompt commands are mechanical and ready-to-run.
4. **Locked-posture reminder** (one line): `core.fileMode=false`, explicit pathspec on shared checkouts, `-F /tmp/cmsg-*.txt`, `--body-file`, no `--auto`, no `--no-verify`, audit-first SDLC, branch from `origin/test`, etc.
5. **Owner-gated deferrals** (one short list): any item the next agent should NOT auto-pick up without owner sign-off.

### What the prompt must NOT include

- Open-ended questions ("what do you think we should do about X?") — those belong in the handoff doc §"Open Questions" with read-before-acting framing.
- Implementation details that change frequently — link to the handoff doc instead so a single source of truth wins.
- Anything the owner has to fill in (paths, hashes, secrets to fetch) — pre-resolve at archive time. If the prompt needs `<paste prod URL here>`, you've failed.

### Format

Wrap the prompt in a single fenced code block (` ``` `) the owner can triple-click to select. End the archive turn with this block; nothing after it.

### Convention added

2026-05-11 by session 6176c881. Rationale: friction-elimination on session boundaries. Codified after the 2026-05-11 prod-deploy-gate-recovery session demonstrated that even with a thorough handoff doc + workboard Log entry + session beacon, the owner still had to construct the next-agent prompt by hand — pure overhead the convention now eliminates.

## Conflict Resolution

- File reservations are **advisory**, not locks. If you must edit a reserved file, note it in Context so the other instance sees it on next read.
- For **architectural decisions** (new packages, schema changes, API contracts), add them to Plans and wait for the other instance to acknowledge before proceeding — but only if that instance is actively working in the affected area.
- **Git conflicts** are resolved by whichever instance commits second. That instance must pull and rebase or merge before pushing.

## Master Plan Protocol

The master plan lives in the internal coordination hub, per ADR-005 (see the repo's `docs/INDEX.md` "Fleet coordination"). The in-repo `docs/MASTER_PLAN.md` is a retired pointer stub, not a plan; a pre-tool-use hook blocks edits to it.

1. **On session start**: Read the hub master plan in full. Your work must align with the current phase.
2. **Before starting any task**: Verify the task is listed in the hub plan's current phase. If not listed, ask the user before proceeding.
3. **After completing any task**: Update the hub plan's checkboxes and add a session entry to Completed Work (a separate commit to the private repo, per ADR-005).
4. **When discovering new work**: Add it to the appropriate phase in the hub plan, do not create separate plan files.
5. **When multiple agents are active**: Each agent must re-read the hub plan before starting new work to see if another agent has updated it.
6. **When updating the hub plan**: Also update the Plan Reference section in `.claude/workboard.md` with the current timestamp and your agent ID.

## Workboard Format

Keep the workboard compact. The Sessions table uses these columns:
- `id`: your detected identity (e.g. `conductor`, `revealui-terminal`, `agent-extension`, `agent-edit`, `agent-system`)
- `env`: environment description (e.g. `PowerShell`, `Zed/WSL`)
- `started`: ISO timestamp of session start
- `task`: short description of current work
- `files`: glob or list of files you are actively modifying
- `updated`: ISO timestamp of last workboard update

Recent entries use the format: `- [YYYY-MM-DD HH:MM] id: description`

Plans are freeform markdown subsections with the instance id in the heading.
