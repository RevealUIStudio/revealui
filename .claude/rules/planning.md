# Planning Convention

## Per-repo planning

Where a repo still carries a `docs/MASTER_PLAN.md`, it is a **retired pointer
stub**, not a plan (the public-snapshot model was retired 2026-07-16; a
pre-tool-use hook blocks edits to rogue plan copies). Planning is not tracked
in public repos.

Fleet-level cross-cutting plans, lane state, and roadmap tracking live in the
internal coordination hub (the agent dev environment), not in a public repo (see
this repo's `docs/INDEX.md` "Fleet coordination"). Per-endeavor, multi-session
work is tracked as a lane in that hub, not as a loose plan file.

Session plan files in `~/.claude/plans/` are ephemeral scratch — do not treat as
durable, and do not promote them into a repo's `docs/`.
