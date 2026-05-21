---
title: "Automation Guide"
description: "Branch protection posture, Claude Code agent integration, and pointers to CI/CD + deployment guides."
category: operations
audience: maintainer
---

# Automation Guide

Narrow scope: this doc covers the parts of the RevealUI automation surface that don't have a more authoritative home. The bulk of automation lives in:

- **CI** — [`docs/CI_CD_GUIDE.md`](./CI_CD_GUIDE.md) and the workflow files in `.github/workflows/` (`ci.yml`, `deploy.yml`, `deploy-test.yml`, `release.yml`, `security.yml`, `db-backup.yml`).
- **Deployment** — [`docs/guides/deployment.md`](./guides/deployment.md) (Vercel, Docker Compose, self-hosted Node.js).
- **Branch pipeline + commands** — top-level [`CLAUDE.md`](../CLAUDE.md) (canonical package map, `pnpm gate`, `pnpm dev`, etc.).
- **Skills + commands** — `~/revfleet/revskills/` (fleet-level Claude Code skills). The `pnpm skills` CLI mentioned in older drafts of this file does not exist in this repo.

What's left here, and what this doc covers, is just two things: agent integration (Claude Code CLI) and the branch-protection-as-code posture.

## Claude Code Integration

[Claude Code](https://docs.anthropic.com/claude/docs/claude-code) is Anthropic's agentic CLI. It's the primary AI agent surface for this repo (alongside Zed's ACP integration).

### Install

```bash
pnpm add -g @anthropic-ai/claude-code
# or, if you prefer not to install globally:
pnpm dlx @anthropic-ai/claude-code
```

### Run from the repo root

```bash
claude
```

Project conventions are loaded from [`CLAUDE.md`](../CLAUDE.md) at the repo root. The agent's allowed permissions are defined in a local `.claude/settings.local.json` (not committed); see Anthropic's [Claude Code settings reference](https://docs.anthropic.com/claude/docs/claude-code-settings) for the format. Per-rule conventions and commands under `.claude/rules/` and `.claude/commands/` may be locally symlinked from `~/revfleet/revcon/profiles/revealui/claude/`, but neither directory is tracked in this repo.

### MCP servers

The repo ships custom MCP servers under `packages/mcp/src/servers/`. They're consumed both by the framework's runtime hypervisor and by external agents (Claude Desktop, Claude Code, Zed). See [`packages/mcp/README.md`](../packages/mcp/README.md) for the current adapter set, and `apps/admin`'s MCP integration for in-product usage.

The previous `.cursor/mcp-config.json` configuration file is not present in this repo.

## Branch Protection

Branch protection for the RevealUI Studio fleet is declared as code in the **private** `revealui-jv` coordination repo. The desired state for each repo lives at `branch-protection/<repo>.json`; a small bash + `jq` + `gh api` script (`scripts/apply-branch-protection.sh`) diffs declarations against live GitHub state and pushes them via `PUT /repos/{owner}/{repo}/branches/{branch}/protection`. The script is idempotent.

### Posture

Every protected branch enforces:

- `enforce_admins: true` — repository owners cannot merge red CI.
- `allow_force_pushes: false`, `allow_deletions: false`.
- `required_pull_request_reviews: null` — CI + admin enforcement is the gate. There is no PR-review requirement, by design (solo-founder posture; self-review is theatre).
- `required_status_checks.strict: false` — branches do not need to be up-to-date with base before merging (compatible with merge-train workflows).

Per-repo required-check sets vary and are listed in each `<repo>.json` declaration. As of the latest sweep, protection covers:

- `revealui` (main + test)
- `revvault` (main)
- `revdev` (main + test)
- `revcon` (main)
- `revskills` (main)

Repos with CI but no protection currently: `revforge`, `revkit`, `revealcoin` (private repos require GitHub Pro for branch protection — tracked separately), and `status` (deploy-only check-runs need workflow inspection before declaring).

### Audit access

Declaration files are in a private repo. For audit / SOC 2 / compliance access to the source-of-truth files, contact `founder@revealui.com`. The complete security posture is documented in [`SECURITY.md`](../SECURITY.md).

## Internal automation scripts (not user-facing)

The `scripts/` tree contains internal automation building blocks that are not registered as `pnpm` scripts and are not intended as a public surface:

- `scripts/gates/cohesion/` — pattern-detection + assessment scaffolding. Not invoked by CI; not registered in `package.json`.
- `scripts/workflows/` — iterative-workflow primitives (start/status/continue/cancel) and reusable definition templates under `scripts/workflows/definitions/`. Used internally by other scripts.

These were prototypes from early-2026 design exploration. If you need to invoke them, do so via `tsx scripts/<path>.ts` directly. There is no committed plan to promote them to `pnpm` aliases; treat them as internal until that changes.

## Related documentation

- [`docs/INDEX.md`](./INDEX.md) — master documentation index.
- [`docs/CI_CD_GUIDE.md`](./CI_CD_GUIDE.md) — CI gate phases, status checks, workflow definitions.
- [`docs/guides/deployment.md`](./guides/deployment.md) — deployment targets and environment configuration.
- [`docs/ENVIRONMENT-VARIABLES-GUIDE.md`](./ENVIRONMENT-VARIABLES-GUIDE.md) — environment variable conventions.
- [`docs/MASTER_PLAN.md`](./MASTER_PLAN.md) — single source of truth for active planning.
- [`SECURITY.md`](../SECURITY.md) — full security posture.
