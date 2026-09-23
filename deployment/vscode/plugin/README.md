# RevealUI for VS Code

Governed hooks and MCP access for VS Code Copilot agent mode.

This directory is the marketplace package (GAP-475). It is prepared in the
RevealUI monorepo. It is not a live Visual Studio Marketplace listing.
Publisher credentials stay with the owner.

## What is in the package

- `plugin.json` registers command-based hooks. Every hook runs
  `revealui-harnesses hook vscode`.
- `.mcp.json` asks VS Code for your instance URL and your device token.
  The token prompt is masked. This package does not contain a device token
  or a live instance URL.

Install `@revealui/harnesses` and put `revealui-harnesses` on `PATH` before
enabling the plugin.

## Local install

VS Code does not auto-discover this folder. Register the absolute path:

```json
{
  "chat.pluginLocations": {
    "/absolute/path/to/deployment/vscode/plugin": true
  }
}
```

Reload VS Code, complete the two prompts, and confirm Copilot can call a
permitted RevealUI tool.

The public connect guide stays on this local path until the owner finishes
a listing: `docs/guides/connect-vscode.md`.

## Catalog

`deployment/vscode/marketplace.json` lists this directory. It is not on the
VS Code discovery path. The owner copies it to
`.github/plugin/marketplace.json` when listing. See
`docs/distribution/VSCODE-MARKETPLACE-OWNER-PUBLISH.md`.
