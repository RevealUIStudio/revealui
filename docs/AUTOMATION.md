---
visibility: internal
status: verified
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

[Claude Code](https://code.claude.com/docs/en/setup) is Anthropic's agentic CLI. It's the primary AI agent surface for this repo (alongside Zed's ACP integration).

### Install

Anthropic's recommended install is the **native installer**, a self-updating native binary that needs no Node.js. It updates itself in the background.

```bash
# macOS / Linux / WSL
curl -fsSL https://claude.ai/install.sh | bash
```

```powershell
# Windows PowerShell
irm https://claude.ai/install.ps1 | iex
```

Secondary (advanced): the npm package. It requires Node.js 18+ and ships the same native binary through per-platform optional dependencies, so your package manager must be configured to allow optional dependencies.

```bash
npm install -g @anthropic-ai/claude-code
```

### Run from the repo root

```bash
claude
```

Project conventions are loaded from [`CLAUDE.md`](../CLAUDE.md) at the repo root. The agent's allowed permissions are defined in a local `.claude/settings.local.json` (not committed); see Anthropic's [Claude Code settings reference](https://code.claude.com/docs/en/settings) for the format. Per-rule conventions and commands under `.claude/rules/` and `.claude/commands/` may be locally symlinked from `~/revfleet/revcon/profiles/revealui/claude/`, but neither directory is tracked in this repo.

### MCP servers

The repo ships custom MCP servers under `packages/mcp/src/servers/`. External agents (Claude Desktop, Claude Code, Zed) attach them via config. The multi-server process hypervisor remains incubating in source (ADR-007). See [`packages/mcp/README.md`](../packages/mcp/README.md) for the current adapter set, and `apps/admin`'s MCP integration for in-product usage.

The previous `.cursor/mcp-config.json` configuration file is not present in this repo.

## Branch Protection

Branch protection for the RevealUI Studio fleet is declared as code in the private coordination hub. The desired state for each repo lives at `branch-protection/<repo>.json`; a small bash + `jq` + `gh api` script (`scripts/apply-branch-protection.sh`) diffs declarations against live GitHub state and pushes them via `PUT /repos/{owner}/{repo}/branches/{branch}/protection`. The script is idempotent.

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

Repos with CI but no protection currently: `revforge`, `revkit` (private repos require GitHub Pro for branch protection — tracked separately), and `status` (deploy-only check-runs need workflow inspection before declaring).

### Audit access

Declaration files are in a private repo. For audit / SOC 2 / compliance access to the source-of-truth files, contact `founder@revealui.com`. The complete security posture is documented in [`SECURITY.md`](../SECURITY.md).

## Internal automation scripts (not user-facing)

The `scripts/` tree contains internal automation building blocks that are not registered as `pnpm` scripts and are not intended as a public surface:

- `scripts/gates/cohesion/` — pattern-detection + assessment scaffolding. Not invoked by CI; not registered in `package.json`.

## Related documentation

- [`docs/INDEX.md`](./INDEX.md) — master documentation index.
- [`docs/CI_CD_GUIDE.md`](./CI_CD_GUIDE.md) — CI gate phases, status checks, workflow definitions.
- [`docs/guides/deployment.md`](./guides/deployment.md) — deployment targets and environment configuration.
- [`docs/ENVIRONMENT-VARIABLES-GUIDE.md`](./ENVIRONMENT-VARIABLES-GUIDE.md) — environment variable conventions.
- [`docs/ROADMAP.md`](./ROADMAP.md): public roadmap. Active planning lives in the internal coordination hub; [`docs/MASTER_PLAN.md`](./MASTER_PLAN.md) is a retired pointer stub.
- [`SECURITY.md`](../SECURITY.md) — full security posture.
