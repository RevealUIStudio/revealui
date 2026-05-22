---
title: "RevCon"
description: "Centralized editor configurations and agent-rule sync for RevealUI projects. Symlinks edit propagate instantly without committing downstream."
category: fleet
audience: developer
---

# RevCon

**Centralized editor configurations for RevealUI projects.**

> RevCon is a separate fleet product, not part of the RevealUI monorepo. The repo is at [RevealUIStudio/revcon](https://github.com/RevealUIStudio/revcon) (its package historically shipped under the name `editor-configs`). This page summarises what RevCon is; the canonical product README lives in the RevCon repo.

## What RevCon is

A **non-monorepo, non-published convention bundle** that ships:

- **Editor configs** for Zed, VS Code, and Cursor — symlinked into target projects so edits propagate instantly without commits to the target repo.
- **Profiles** — per-project rule packs (e.g. `revealui` profile applies RevFleet's Claude Code rules + Cursor rules + agent skill files).
- **`link.sh` / `unlink.sh`** — installer + remover. Supports `--target`, `--profile`, `--editor`, and `--dry-run`.

```bash
# Link into a project with the revealui profile
./link.sh --target ~/revfleet/revealui --profile revealui

# Link base configs only (no profile)
./link.sh --target ~/revfleet/revvault

# Link a single editor
./link.sh --target ~/revfleet/revealui --profile revealui --editor zed

# Preview without changes
./link.sh --dry-run --target ~/revfleet/revealui --profile revealui

# Remove symlinks
./unlink.sh --target ~/revfleet/revealui

# List available profiles
./link.sh --list
```

## How it composes with RevealUI

- **New contributor flow**: clone RevealUI, then `pnpm dlx revcon sync` (or run RevCon's `link.sh` against the checkout). They get the team's editing posture, agent rules, and convention files. No drift.
- **Cross-fleet consistency**: the same RevCon profile installs Claude Code rules into RevealUI, RevDev, RevVault, and RevForge. One source of truth for *"how do agents behave in our codebases."*
- **Symlinks, not copies**: edits to RevCon master files propagate to every linked project on filesystem refresh — no per-repo PRs to keep configs in sync.

## Important: not gated by Pro license

There is no `@revealui/editors` package inside the RevealUI monorepo. RevCon is intentionally decoupled from the RevealUI runtime — editor profiles evolve on a different cadence than the core packages and are not gated by the Pro license. Anyone can install RevCon against any project, paid tier or not.

If a doc on this site says *"the `@revealui/editors` package"*, that's stale text — the canonical product is RevCon.

## Status

Active.

## See also

- [RevFleet overview](../REVFLEET) — how RevCon relates to the rest of RevFleet
- [`/pro/editors`](/pro/editors) — Pro-docs page that points back to RevCon
- [RevCon README](https://github.com/RevealUIStudio/revcon/blob/main/README.md) — canonical product docs
