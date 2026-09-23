---
title: "GAP-164 MCP_API_KEY reference inventory"
description: "Inventory of MCP_API_KEY references in this repo and which process loads the variable. Source system is owner TBD."
visibility: internal
status: verified
audience: maintainer
last-updated: 2026-09-23
---

# GAP-164: MCP_API_KEY reference inventory

Inventory of every `MCP_API_KEY` reference in this repository, and which app or process loads it. Loader column is from code evidence only.

Searched 2026-09-23 on `test` (`f2658af69`) with a tree-wide scan for `MCP_API_KEY` (any case), `mcpApiKey`, `mcp-api-key`, and the comment phrase `MCP API key`. Skipped `.git`, `node_modules`, `dist`, and `.turbo`. Also checked `.github` workflows, `scripts/`, `packages/mcp/.env.example`, and `docs/`.

Alignment notes:

- No `GAP-164.yml` and no other GAP-164 note in the tree.
- No `leftover/` directory.
- `.revealui/manager.json` names `docs/TRACKER.md`. That file is not present.

## MCP_API_KEY references

| Path | How referenced | Which process/app loads it | Notes |
|------|----------------|----------------------------|-------|
| `.env.template` lines 368-371 | Commented heading `MCP API key (for MCP server)` and commented assignment `# MCP_API_KEY=your-mcp-api-key-here` | None. No app reads `.env.template` as a runtime env source, and no code reads `process.env.MCP_API_KEY`. | Placeholder text only. The value in the template is the literal `your-mcp-api-key-here`. |
| `docs/ENVIRONMENT-VARIABLES-GUIDE.md` line 365 | Row in the "MCP Servers" table. Optional, no default. Description: "Authentication key for MCP server integrations." Security column: `HIGH (server-only)`. Used By column: `mcp`. | None. `getMcpConfig()` in `packages/config/src/mcp.ts` (lines 16-28) reads `MCP_PERSISTENCE_DRIVER`, `MCP_METRICS_MODE`, `ELECTRIC_DATABASE_URL`, `ELECTRIC_API_KEY`, and `PGVECTOR_ENABLED`. It does not read `MCP_API_KEY`. A repo search found no `process.env.MCP_API_KEY`. | The guide's Used By cell is a documentation label. It is not evidence that a process loads the variable. |
| `docs/CREDENTIAL-ROTATION-RUNBOOK.md` line 20 | Name listed in the **90 days** rotation cadence cell, next to other credential names. | None. The runbook does not load env vars. The name does not appear again in that file, including the procedures section. | Schedule mention only. No rotation procedure for this name is written in the runbook. |

## Close-name hits that are not the key

| Path | How referenced | Which process/app loads it | Notes |
|------|----------------|----------------------------|-------|
| `scripts/validate/__tests__/mcp-admin-nodejs-runtime.test.ts` lines 13 and 71 | Local constant `MCP_API_ROOT` set to `apps/admin/src/app/api/mcp`, then passed to `listRouteFiles`. | The validate test process, as a directory path. | Shares the `MCP_API` prefix. It is not `MCP_API_KEY` and does not load a key. |

**Source system: OWNER TBD — do not guess.**
