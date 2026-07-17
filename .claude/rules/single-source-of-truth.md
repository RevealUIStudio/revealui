# Single Source of Truth — Agent Coordination Hub

## The Hub

All agent coordination, planning, and status tracking flows through ONE location per repo:

```
.claude/workboard.md          — agent coordination
internal coordination hub     — planning & task tracking (master plan)
```

The in-repo `docs/MASTER_PLAN.md` is a retired pointer stub (see the repo's `docs/INDEX.md` "Fleet coordination" for the hub reference).

**There are no exceptions.** Every agent, subagent, worktree agent, and background task
reads from and writes to this hub — regardless of which working tree they were launched from.

## What Lives Where

| Artifact | Canonical Location | Notes |
|----------|-------------------|-------|
| Workboard (agent sessions, tasks, files) | `.claude/workboard.md` | Ephemeral coordination only |
| Master Plan (phases, tasks, status) | Internal coordination hub | Durable planning & task tracking; in-repo `docs/MASTER_PLAN.md` is a retired stub |
| Memory (persistent cross-session) | Project memory directory | Project-scoped, do not duplicate |
| Plans (ephemeral session) | In-conversation only (EnterPlanMode) | NEVER write to a stray `plans/` directory — they rot |

## Prohibited Actions

1. **Do NOT scatter agent sessions or tasks across multiple workboards** — there is one workboard per repo
2. **Do NOT keep parallel copies of the master plan** — the hub master plan is the one planning document; update it in place
3. **Do NOT create files in a stray `plans/` directory** — use in-conversation plans or the hub master plan
4. **Do NOT create planning/status files** (ACTION_PLAN.md, STATUS.md, TODO.md) anywhere — the hub master plan is the only planning document
5. **Do NOT write memory to the wrong project context** — use the correct project memory directory

## On Session Start

1. Read `.claude/workboard.md` — check other agents' activity
2. Read `docs/MASTER_PLAN.md` — verify task alignment
3. Update your workboard row with current task

## On Session End

1. Update workboard with completed work
2. Update MASTER_PLAN checkboxes if any phase items were completed
3. Do NOT leave orphaned plan files, status docs, or coordination artifacts

## Worktree Agents

Worktree agents (spawned via `isolation: "worktree"`) operate on isolated copies.
They MUST still read the hub workboard before starting and report results back.
Worktrees are automatically cleaned up if no changes are made.
If a worktree has uncommitted work when the agent crashes, the parent agent must
check for orphaned worktrees and recover or discard.

## Memory Architecture

- Project memory is shared across a project's agents; do not cross-pollinate between projects
- Each project has its own memory directory; do not duplicate entries across contexts
