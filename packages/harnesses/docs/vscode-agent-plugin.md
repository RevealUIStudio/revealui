# VS Code Agent Plugin

Per the multi-editor harness design, `@revealui/harnesses` can generate a VS
Code agent-plugin bundle wiring RevealUI's governed hook receipts and MCP
data plane into VS Code's Copilot agent mode. Facts below verified
2026-07-17 against `code.visualstudio.com` and `docs.github.com`; VS Code
agent plugins are in Preview with a documented high release cadence --
re-verify before relying on this doc.

## What gets generated

- `VSCodeGenerator` (`src/content/generators/vscode.ts`) emits
  `.revealui/vscode-plugin/plugin.json` -- the plugin manifest, carrying only
  the `hooks` contribution (every one of VS Code's eight documented hook
  events runs `revealui-harnesses hook vscode`) and a string reference to
  `.mcp.json` for the MCP contribution.
- `protocolConfigToVSCodeMcpConfig` (`src/protocol/config-normalizer.ts`)
  produces the `.mcp.json` content separately, wiring the governed
  `/api/mcp` endpoint. The device token is never emitted as a literal value
  -- it is referenced via VS Code's `${input:<id>}` substitution syntax, with
  the `inputs[]` entry marked `password: true` so VS Code masks the prompt
  and stores the value itself.

## Installing from a local path

VS Code plugins are not auto-discovered from inside a project the way
Cursor's `.cursor/` or OpenCode's `.opencode/` are. Register the generated
bundle explicitly in VS Code user or workspace settings:

```json
{
  "chat.pluginLocations": {
    "/absolute/path/to/project/.revealui/vscode-plugin": true
  }
}
```

Set the value to `true` to enable the plugin, `false` to keep it registered
but disabled. Marketplace publishing (`chat.plugins.marketplaces`, "Chat:
Install Plugin From Source") is owner-gated and out of scope here -- see the
design doc's D-C decision.

## Org-allowlist governance

VS Code's per-plugin registration above is a developer-machine setting; it
does not control what an ENTERPRISE permits at the MCP-server level.
GitHub Copilot Business/Enterprise organizations govern that separately,
through GitHub's own admin console (not a VS Code setting):

1. An org or enterprise administrator opens **AI controls -> MCP** in the
   GitHub Copilot policies page.
2. They choose one of two access-control modes:
   - **Allow all** -- no restriction; any MCP server a developer configures
     (including RevealUI's `/api/mcp`) can be used.
   - **Registry only** -- only MCP servers listed in the org/enterprise's
     internal MCP registry may run. Under this mode, RevealUI's governed MCP
     endpoint must be added to that internal registry before any developer's
     generated `.mcp.json` entry will actually be usable at runtime, even
     though VS Code will still let a developer configure it locally.
3. Policy resolution is tied to the GitHub Copilot seat assignment; a
   developer holding seats in multiple orgs gets a single resolved policy.

Source: docs.github.com/en/copilot/how-tos/administer-copilot/manage-mcp-usage/configure-mcp-server-access
(verified 2026-07-17). Publishing RevealUI's MCP entry into a customer's
internal registry is a customer-side administrative action; this package
does not automate it.
