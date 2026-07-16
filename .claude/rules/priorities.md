# Priorities

## Source of Truth

All work must align with the master plan in the internal coordination hub (see the repo's `docs/INDEX.md` "Fleet coordination"); the in-repo `docs/MASTER_PLAN.md` is a retired pointer stub. If a task is not listed in the current phase of the hub plan, do not work on it without explicit user approval.

## Current Phase: Phase 3 — Post-Launch

RevealUI is launched. Work now includes:
1. Security fixes (CodeQL alerts, regex safety, sanitization)
2. Code quality (dead code, useless conditionals, type safety)
3. Documentation (public OSS docs + Pro docs gate)
4. Marketing (landing page polish, launch copy)
5. Pro tier distribution (npm source-available, license flow E2E)
6. Bug fixes and stability improvements
7. Feature work as directed by the user

## Multi-Agent Awareness

- You are one of potentially multiple Claude Code agents working on this repo
- ALL agents share the hub master plan as their single source of truth
- Before making architectural decisions, check the workboard (`.claude/workboard.md`) for other active agents
- If another agent is working on a related area, coordinate via the workboard Context section
- NEVER create plan documents outside of the hub master plan — ephemeral session plans are OK but must not be treated as durable

## When in Doubt

Ask: "Does this help launch RevealUI?" If no, defer it.
