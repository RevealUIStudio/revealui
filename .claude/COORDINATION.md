# Agent Coordination

## 3-Agent Topology

| Agent | CWD | Role | Workboard ID |
|-------|-----|------|--------------|
| wsl-root | ~/projects/ | Repo ops, DevBox, bootstrapping | wsl-root |
| revealui-terminal | ~/projects/RevealUI/ | Builds, deploys, DB, publish | revealui-terminal |
| zed-revealui | RevealUI (Zed) | Code editing, documentation | zed-1 |

## Protocol

- **One agent commits at a time.** Finish a logical unit, commit, then hand off.
- **Declare active files here** before editing. Remove when done.
- **Conflict resolution**: last commit wins for non-overlapping files; coordinate for shared files.
- See `.claude/rules/coordination.md` for full protocol.

## Current File Reservations

_(empty — add your active files here while working)_

## Repo Layout (Post-Split)

| Repo | Visibility | Contains |
|------|-----------|---------|
| `RevealUIStudio/revealui` | Public (after owner flip) | All packages, all apps, public docs |
| `RevealUIStudio/revealui-jv` | Private | Full pre-cleanup history, business/, internal docs |

## Naming Convention
Internal/private versions use `{project}-{initials}` suffix (e.g., `revealui-jv` for Joshua Vaughn).
