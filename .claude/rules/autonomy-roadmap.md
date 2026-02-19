# Multi-Instance Coordination

## Current Capability: Workboard-Based Coordination

Two Claude Code instances can share a workboard (`.claude/workboard.md`) to coordinate tasks, file reservations, and context. A human is always at the keyboard approving actions.

See `coordination.md` for the full protocol (identity detection, session lifecycle, conflict resolution).
See `distribution.md` for how the repo is distributed across locations.

## Plan Consolidation

**Single source of truth:** `docs/MASTER_PLAN.md`

All agents in all environments (laptop WSL, DevBox, LTS, remote) work from this one master plan. It is committed to git and syncs to all clones.

Rules:
- Primary repo: `~/projects/RevealUI` (WSL) → GitHub → all clones
- Plans are committed to git, not gitignored
- Auto-generated Claude Code session plans (`~/.claude/plans/`) are ephemeral session context, not authoritative
- Stale local plans on LTS or DevBox are superseded by the git version
- The workboard (`.claude/workboard.md`) is the only ephemeral coordination file

## Future Stages (deferred)

The following capabilities are planned but not prioritized until RevealUI reaches Phase 2+ of the master plan:

- Agent communication protocol (direct message passing between instances)
- Mobile approval push notifications
- Remote execution on cloud VMs
- Spec-driven autonomous development

These are documented here for reference but are NOT active work items. See `docs/MASTER_PLAN.md` for what IS active.
