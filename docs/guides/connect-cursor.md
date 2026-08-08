---
title: "Connect Cursor"
description: "Wire Cursor hooks and the governed MCP endpoint so Cursor is a governed and audited user of your RevealUI data."
visibility: public
status: verified
audience: developer
---

# Connect Cursor

Cursor can call your RevealUI instance through the governed Model Context
Protocol (MCP) endpoint, and RevealUI can observe Cursor's agent loop through
command-based hooks. Every MCP tool call runs as a specific authenticated
RevealUI user. Hooks can spool receipts into the audit path when you flush
them. This guide covers a project-level setup from a fresh Cursor install.

## What governance means here

Cursor brings its own models (including Grok when you enable it in Cursor).
RevealUI never hosts a frontier model and never ships a proprietary model
SDK. RevealUI provides the governed data layer: identity, authorization, and
an audit trail for what agents do **through RevealUI**.

- **Authenticated.** MCP requests carry your own device token. There is no
  shared service key on this path.
- **Authorized.** The same role-based and row-level rules that govern a human
  request govern the agent request.
- **Audited.** Tool calls through the governed MCP endpoint write receipts.
  Hook events can spool receipts via `revealui-harnesses hook cursor`.
- **Revocable.** Revoking the device token stops MCP access on the next
  request. The server re-validates the token every time
  (`apps/server/src/middleware/auth.ts:26`), not only when a session starts.

### Honest limits (read before you ship this to customers)

Cursor is a closed-source product with its own cloud surfaces. Grok models
available inside Cursor are Cursor's product, trained in part on Cursor
usage data. RevealUI receipts record what happened on the RevealUI layer
(MCP tools, hooks that flush into your instance). They are **not** a claim
that Cursor itself phones home nothing, and they are not a substitute for
Cursor Team or Enterprise hook policy if you need org-wide enforcement.

User-level hook config is user-removable unless pinned by Cursor Team or
Enterprise policy. Treat local hooks as advisory until your org pins them.

## Prerequisites

- A RevealUI account on the instance you want to connect to.
- Cursor installed (desktop agent with hooks + MCP support).
- `revealui-harnesses` on your `PATH` (from the monorepo or a published
  `@revealui/harnesses` install), so hook commands resolve.
- A device token minted through the studio-auth device flow (same mint as
  OpenCode and other MCP clients).

## 1. Mint a device token

Use the same studio-auth link/verify flow described in
[Connect OpenCode](./connect-opencode.md#1-mint-a-device-token). The token has
the shape `rvui_dev_<64 hex characters>`. Treat it like a password.

## 2. Store the token in the environment

```bash
export REVEALUI_MCP_TOKEN="rvui_dev_your_token_here"
```

Never commit the token. Prefer revvault on operator machines
(`revealui/dev/mcp/cursor-device-token` or the shared
`revealui/dev/mcp/opencode-device-token` path if you reuse one token).

## 3. Wire governed MCP into `.cursor/mcp.json`

Cursor resolves secrets with `${env:NAME}` (not OpenCode's `{env:NAME}`).

```jsonc
// .cursor/mcp.json
{
  "mcpServers": {
    "revealui": {
      "url": "https://<your-host>/api/mcp",
      "headers": {
        "Authorization": "Bearer ${env:REVEALUI_MCP_TOKEN}"
      }
    }
  }
}
```

Replace `<your-host>` with your instance. The file must never contain a
literal token value.

The leak-proof helper that builds this shape is
`protocolConfigToCursorMcpConfig` in `@revealui/harnesses`
(`packages/harnesses/src/protocol/config-normalizer.ts`).

## 4. Install command-based hooks

Generate or hand-write `.cursor/hooks.json` so every documented Cursor hook
event runs the same command:

```jsonc
// .cursor/hooks.json
{
  "version": 1,
  "hooks": {
    "sessionStart": [{ "command": "revealui-harnesses hook cursor", "type": "command" }],
    "sessionEnd": [{ "command": "revealui-harnesses hook cursor", "type": "command" }],
    "preToolUse": [{ "command": "revealui-harnesses hook cursor", "type": "command" }],
    "postToolUse": [{ "command": "revealui-harnesses hook cursor", "type": "command" }],
    "beforeShellExecution": [{ "command": "revealui-harnesses hook cursor", "type": "command" }],
    "afterShellExecution": [{ "command": "revealui-harnesses hook cursor", "type": "command" }],
    "beforeMCPExecution": [{ "command": "revealui-harnesses hook cursor", "type": "command" }],
    "afterMCPExecution": [{ "command": "revealui-harnesses hook cursor", "type": "command" }],
    "beforeReadFile": [{ "command": "revealui-harnesses hook cursor", "type": "command" }],
    "afterFileEdit": [{ "command": "revealui-harnesses hook cursor", "type": "command" }],
    "stop": [{ "command": "revealui-harnesses hook cursor", "type": "command" }]
  }
}
```

From a monorepo checkout you can also generate the hooks file via the
`cursor` content generator (`CursorGenerator` → `.cursor/hooks.json`).

The hook CLI reads JSON on stdin, evaluates local policy, spools a receipt,
and prints the permission decision. Invalid stdin defaults to allow so a
bad payload does not crash Cursor's hook pipeline
(`packages/harnesses/src/cli.ts:506`).

## 5. Confirm MCP

In Cursor, open the MCP panel and confirm the `revealui` server is
connected. List tools and run a low-risk call (for example list sites) that
your account is allowed to execute.

## 6. Confirm hooks

Trigger any tool call and confirm `revealui-harnesses hook cursor` runs
(watch for the process, or inspect the local spool if flush is not yet
configured). Live flush into `POST /api/harness/receipts` uses the same
device-token auth as MCP when you enable it.

## Rotating or revoking the token

Revoke the device token in RevealUI and mint a new one. Update
`REVEALUI_MCP_TOKEN`. Revocation takes effect on the next MCP request.

## Troubleshooting

- **401 on MCP:** missing, expired, or revoked token. Re-export
  `REVEALUI_MCP_TOKEN` and restart Cursor if it cached the env.
- **Hook command not found:** install `@revealui/harnesses` or put
  `revealui-harnesses` on `PATH`.
- **Tool missing from discovery:** MCP only lists tools your account may
  run. That is authorization, not a Cursor bug.
- **Hooks feel optional:** user-level hooks are removable. Use Cursor Team
  or Enterprise policy when you need org-wide enforcement.

## Sources

- Cursor MCP env substitution `${env:NAME}`: Cursor MCP docs (verified in
  `protocolConfigToCursorMcpConfig` comments, 2026-07-17).
- Hook generator: `packages/harnesses/src/content/generators/cursor.ts`
- Hook CLI: `packages/harnesses/src/cli.ts` (`hook cursor`)
- Per-request bearer validation: `apps/server/src/middleware/auth.ts`
- Device mint and revoke: `apps/server/src/routes/studio-auth.ts`
