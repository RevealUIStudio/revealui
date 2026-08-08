---
title: "Connect VS Code"
description: "Install the RevealUI VS Code agent-plugin bundle so Copilot agent mode uses governed MCP and command-based hooks."
visibility: public
status: verified
audience: developer
---

# Connect VS Code

VS Code Copilot agent mode can reach a RevealUI instance through the
governed MCP endpoint, with hook receipts running as command-based plugin
hooks. This guide uses the project-local plugin bundle that
`@revealui/harnesses` generates under `.revealui/vscode-plugin/`.

For install and org-policy notes that are not repeated here, see the package
doc path `packages/harnesses/docs/vscode-agent-plugin.md` in the monorepo
checkout (not a served docs.revealui.com page).

## What governance means here

VS Code and GitHub Copilot bring their own models. RevealUI provides the
governed data layer: identity, authorization, and audit receipts for agent
actions that go through RevealUI.

- **Authenticated.** MCP requests use a device token you supply once via a
  password-masked VS Code input (not a committed secret).
- **Authorized.** Collection and tool access use the same rules as a human
  session for that user.
- **Audited.** Governed MCP tool calls leave receipts. Hooks run
  `revealui-harnesses hook vscode` and can spool events for flush into
  `POST /api/harness/receipts`.
- **Revocable.** Revoking the device token stops the next MCP request.

### Honest limits

VS Code agent plugins are in Preview with a high release cadence. Re-verify
against current Microsoft docs before a customer rollout. Marketplace
publishing is an owner operation (design decision D-C) and is not required
for local install. Enterprise MCP access is also governed by GitHub Copilot
org policy; a local `.mcp.json` does not bypass an org registry-only mode.

## Prerequisites

- VS Code with Copilot agent mode available on your account.
- `revealui-harnesses` on your `PATH`.
- A RevealUI device token (same mint as [Connect OpenCode](./connect-opencode.md)).

## 1. Mint a device token

Follow [Connect OpenCode §1](./connect-opencode.md#1-mint-a-device-token). Store
the value in revvault if you want a durable path
(`revealui/dev/mcp/vscode-device-token` or the shared
`revealui/dev/mcp/opencode-device-token`).

## 2. Generate the plugin bundle

From a RevealUI monorepo or a project that already materializes harness
content, generate the VS Code plugin so you get:

- `.revealui/vscode-plugin/plugin.json` (hooks + path reference to MCP config)
- A separate `.mcp.json` (or the path your generator expects) produced via
  `protocolConfigToVSCodeMcpConfig` with your MCP URL

Hand-written equivalent for `.mcp.json` (never put a literal token in the
file):

```jsonc
{
  "inputs": [
    {
      "type": "promptString",
      "id": "revealui-mcp-token",
      "description": "RevealUI governed MCP device token",
      "password": true
    }
  ],
  "servers": {
    "revealui": {
      "type": "http",
      "url": "https://<your-host>/api/mcp",
      "headers": {
        "Authorization": "Bearer ${input:revealui-mcp-token}"
      }
    }
  }
}
```

VS Code prompts for the token on first use and stores it. Substitution uses
`${input:id}`, not an environment variable.

## 3. Register the local plugin

VS Code does not auto-discover project plugins. Add the absolute path of the
generated bundle:

```jsonc
// settings.json (user or workspace)
{
  "chat.pluginLocations": {
    "/absolute/path/to/project/.revealui/vscode-plugin": true
  }
}
```

## 4. Confirm

1. Reload VS Code.
2. Open agent chat and confirm the RevealUI MCP tools are available after
   you complete the token prompt.
3. Run a permitted tool call and confirm a receipt path (MCP audit and/or
   hook spool).

## Rotating or revoking the token

Revoke the device token in RevealUI. Clear or update the stored VS Code
input and mint a new token. The next MCP request will re-validate.

## Troubleshooting

- **Token prompt never appears:** check that `.mcp.json` is the path
  `plugin.json` references and that `inputs[].id` matches `${input:…}`.
- **Tools missing under Registry only org policy:** an admin must list
  RevealUI's MCP endpoint in the org internal MCP registry (see the
  package doc). Local config alone is not enough.
- **Hook command not found:** put `revealui-harnesses` on `PATH`.

## Sources

- Generator: `packages/harnesses/src/content/generators/vscode.ts`
- MCP fragment: `protocolConfigToVSCodeMcpConfig` in
  `packages/harnesses/src/protocol/config-normalizer.ts`
- Install and org allowlist notes:
  `packages/harnesses/docs/vscode-agent-plugin.md`
- Per-request bearer validation: `apps/server/src/middleware/auth.ts`
