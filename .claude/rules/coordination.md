# Multi-Instance Coordination

Multiple Claude Code instances may work on this repo simultaneously (e.g. terminal + Zed editor). A shared workboard at `.claude/workboard.md` tracks sessions, tasks, and file reservations.

## Identity

Detect your environment on session start:
- **Zed editor** (ACP integration): identify as `zed-N`
- **Terminal** (PowerShell, bash, or any CLI): identify as `terminal-N`

Use the next available number if your label is already taken in the Sessions table.

## Protocol

1. **Session start**: Read `.claude/workboard.md`. Register yourself in the Sessions table with `task=(starting)`. Review other sessions for conflicts.
2. **Before each task**: Re-read the workboard. Check if another instance lists files you need. If there is overlap, pick different files or note the overlap in Context.
3. **During work**: Update your `task`, `files`, and `updated` columns when they change significantly. Add entries to Context for discoveries that affect the other instance.
4. **After completing work**: Add a timestamped entry to Recent. Update your session row.
5. **Session end**: Remove your session row. Add a final Recent entry summarizing what you accomplished.

## Stale Sessions

If a session row has an `updated` timestamp older than 4 hours, treat it as stale (the instance likely crashed or the user closed it). You may remove the row and disregard its file reservations.

## Conflict Resolution

- File reservations are **advisory**, not locks. If you must edit a reserved file, note it in Context so the other instance sees it on next read.
- For **architectural decisions** (new packages, schema changes, API contracts), add them to Plans and wait for the other instance to acknowledge before proceeding — but only if that instance is actively working in the affected area.
- **Git conflicts** are resolved by whichever instance commits second. That instance must pull and rebase or merge before pushing.

## Master Plan Protocol

1. **On session start**: Read `docs/MASTER_PLAN.md` in full. Your work must align with the current phase.
2. **Before starting any task**: Verify the task is listed in MASTER_PLAN.md's current phase. If not listed, ask the user before proceeding.
3. **After completing any task**: Update MASTER_PLAN.md checkboxes and add a session entry to Completed Work.
4. **When discovering new work**: Add it to the appropriate phase in MASTER_PLAN.md, do not create separate plan files.
5. **When multiple agents are active**: Each agent must re-read MASTER_PLAN.md before starting new work to see if another agent has updated it.
6. **Plan reference in workboard**: When you update MASTER_PLAN.md, also update the Plan Reference section in `.claude/workboard.md` with the current timestamp and your agent ID. This signals other agents to re-read the plan.

## Workboard Format

Keep the workboard compact. The Sessions table uses these columns:
- `id`: your instance label (e.g. `terminal-1`)
- `env`: environment description (e.g. `PowerShell`, `Zed/WSL`)
- `started`: ISO timestamp of session start
- `task`: short description of current work
- `files`: glob or list of files you are actively modifying
- `updated`: ISO timestamp of last workboard update

Recent entries use the format: `- [YYYY-MM-DD HH:MM] id: description`

Plans are freeform markdown subsections with the instance id in the heading.
