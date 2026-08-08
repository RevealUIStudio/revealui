---
title: "Connect ACP (Zed and JetBrains)"
description: "Run RevealUI as an Agent Client Protocol agent over stdio for Zed, JetBrains, and other ACP clients."
visibility: public
status: verified
audience: developer
---

# Connect ACP (Zed and JetBrains)

RevealUI can act as an **ACP agent** (Agent Client Protocol v1) over stdio.
Editors such as Zed and JetBrains connect as the ACP client. The agent
process is `revealui-harnesses acp`. Protocol work uses the official
`@agentclientprotocol/sdk` (ADR `2026-08-08-gap-381-acp-sdk-posture`).

## What governance means here

ACP is the **editor control plane** for prompts and permissions. The
**RevealUI data plane** for customer data remains the governed MCP endpoint
and REST surfaces. Do not treat ACP wire identity as a substitute for a
RevealUI device token on data-plane calls.

- **I-1 (identity).** Client metadata from `initialize` is display-only. It
  is not used for authorization.
- **I-6 (no collection bypass).** Prompt execution goes through an executor
  adapter, not a direct database path. Data access that needs your
  collections should still go through governed MCP or REST as a normal user.
- **Permissions.** By default each prompt turn asks the client for
  permission before the executor runs (`session/request_permission`).

## Prerequisites

- An ACP client (Zed with ACP agents, JetBrains ACP support, or another
  ACP-compatible host).
- `@revealui/harnesses` installed so `revealui-harnesses` is on `PATH`.
- Optional but recommended: a RevealUI device token and MCP config in the
  client for data-plane tools (same mint as [Connect OpenCode](./connect-opencode.md)).

## 1. Run the agent on stdio

```bash
revealui-harnesses acp
```

The process speaks ACP v1 as ndjson on stdin/stdout until the client
disconnects. Do not write human logs to stdout; they corrupt the protocol
stream. Diagnostics go to stderr.

## 2. Register the agent in the client

Exact UI differs by editor. The common shape is:

1. Open the editor's ACP / external agents settings.
2. Add an agent whose command is `revealui-harnesses` with argument `acp`
   (or the absolute path to the binary).
3. Start a session from the agent panel.

Zed documents ACP agent registration in its ACP registry docs
(https://zed.dev/acp). Re-verify the click-path against your Zed version
before writing customer runbooks.

## 3. Expected session shape

A healthy session follows:

1. `initialize` (protocol version + agent info)
2. `session/new`
3. `session/prompt` (client may see a permission request first)
4. `session/update` streaming from the agent while work runs
5. Completion or cancel

Scripted coverage of this path lives in
`packages/harnesses/src/acp/__tests__/acp-agent.test.ts` (Phase D acceptance).

## 4. Wire data-plane MCP when you need collections

ACP does not replace MCP for collection tools. Configure the editor's MCP
client (or a companion process) with the governed endpoint and
`REVEALUI_MCP_TOKEN`, the same way as Cursor or OpenCode. Revoking that
token stops data-plane access on the next MCP request even if the ACP
session stays open.

## Rotating or revoking access

- **Device token:** revoke in RevealUI; update env or client secrets.
- **Agent process:** stop the ACP session in the editor; the stdio process
  exits when the client disconnects.

## Troubleshooting

- **Protocol parse errors:** something wrote non-JSON to stdout. Keep only
  `revealui-harnesses acp` on that stream.
- **Unknown session errors:** the client reused a session id after process
  restart. Start `session/new` again.
- **Permission prompts every turn:** default Phase D posture. Disable only
  if you intentionally change agent options in code; customer builds should
  keep human approval for consequential prompts.

## Sources

- CLI entry: `packages/harnesses/src/cli.ts` (`acp` command)
- Agent app: `packages/harnesses/src/acp/agent.ts`
- Stdio transport: `packages/harnesses/src/acp/stdio.ts`
- Acceptance tests: `packages/harnesses/src/acp/__tests__/acp-agent.test.ts`
- Dependency posture: official `@agentclientprotocol/sdk` (GAP-381 D-B),
  pinned in `@revealui/harnesses` package.json
