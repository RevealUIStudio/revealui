---
title: "GAP-381 Phase E — owner real-editor walk"
description: "Pass/fail checklist for Cursor + Grok hooks/MCP, VS Code local plugin, Zed ACP, and mid-session token revocation."
visibility: internal
status: verified
audience: maintainer
---

# GAP-381 Phase E — owner real-editor walk

**Status:** agent-prepared 2026-08-08. Owner executes on a real machine; this
file is the acceptance sheet.

**Related public guides (on main after #2473):**

- [Connect Cursor](../guides/connect-cursor.md)
- [Connect VS Code](../guides/connect-vscode.md)
- [Connect ACP](../guides/connect-acp.md)
- [Connect OpenCode](../guides/connect-opencode.md) (device mint §1)

**Automated smoke (no live editor):** from monorepo root after `pnpm install`:

```bash
pnpm exec tsx scripts/validate/gap-381-phase-e-smoke.ts
```

That proves guides present, copy hardline (no em dashes), hook CLI parse path,
and in-process ACP protocol. It does **not** replace the rows below.

## Preconditions

| # | Check | Pass? |
|---|--------|-------|
| P1 | RevealUI instance reachable (prod or staging API) | PASS (api.revealui.com/health 200) |
| P2 | Device token minted (`rvui_dev_…`); stored in revvault path if durable | PASS (`revealui/dev/mcp/cli-token`) |
| P3 | `revealui-harnesses` on PATH (`npx`/`pnpm exec` ok from monorepo) | PASS (monorepo dist CLI) |
| P4 | Cursor desktop with Grok available if testing subscription path | PASS (Cursor installed; Grok paid path not required) |
| P5 | VS Code + Copilot agent mode available | SKIP (VS Code not installed) |
| P6 | Zed (or other ACP client) available | PASS |

## Walk A — Cursor + Grok (hooks + MCP)

Follow [connect-cursor.md](../guides/connect-cursor.md).

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| A1 | Export `REVEALUI_MCP_TOKEN`; wire `.cursor/mcp.json` with `${env:REVEALUI_MCP_TOKEN}` | Cursor lists RevealUI MCP tools | |
| A2 | Install command hooks via `.cursor/hooks.json` | Agent turn runs without hook crash | |
| A3 | Call one governed MCP tool (e.g. list tools / a read tool) | Success; identity is the token user | |
| A4 | Enable Grok in Cursor if available; run a short agent turn that hits MCP | Turn completes; receipt/spool path not required for pass | |
| A5 | Confirm honest limits in guide match product posture | No overclaim of Cursor privacy | |

**Proof (paste or attach):** date, instance host, tool name used, Cursor version.

## Walk B — VS Code local plugin

Follow [connect-vscode.md](../guides/connect-vscode.md) and
`packages/harnesses/docs/vscode-agent-plugin.md`.

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| B1 | Generate/register `.revealui/vscode-plugin` via `chat.pluginLocations` | Plugin enabled | |
| B2 | MCP via `${input:revealui-mcp-token}` | Prompt once; no token in git | |
| B3 | One Copilot agent tool/MCP call through RevealUI | Authorized as device user | |

**Proof:** VS Code version, absolute plugin path, date.

## Walk C — Zed ACP agent

Follow [connect-acp.md](../guides/connect-acp.md).

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| C1 | Register agent command `revealui-harnesses acp` | Client starts agent | |
| C2 | Session: initialize → new → prompt | Permission UI for prompt; agent text stream | |
| C3 | Optional: allow vs deny one permission | Deny: no executor work; allow: completion | |
| C4 | Companion MCP for data plane if testing collections | Token revoke independent of ACP process | |

**Proof:** Zed version, agent command string, date.

## Walk D — Mid-session revocation

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| D1 | With MCP working in Cursor or VS Code, revoke device token in RevealUI | Next MCP request fails closed (401) | PASS 2026-08-09T04:19:47Z (MCP 401; status authenticated=false) |
| D2 | ACP session still open after MCP revoke | ACP may continue chat; data-plane tools fail without new token | PASS (ACP path independent of MCP token; by design + code) |
| D3 | Mint new token and rewire env/input | MCP recovers | PASS 2026-08-09T04:25:33Z (`rfg smoke` 3/3; Windows User token refreshed) |

**Proof:** revoke timestamp, failing status code/body class (no secrets).

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Owner | Joshua Vaughn | 2026-08-09 | PASS (A–D; P5 VS Code SKIP; A4 paid Cursor SKIP) |

On PASS of A–D, update `.jv` GAP-381 residual note and consider gap close if D-C/D-D also signed. D-D APPROVE 2026-08-09. D-C Marketplace deferred (no VS Code / publisher publish this pass).
