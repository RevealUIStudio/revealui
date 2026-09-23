---
title: "VS Code Marketplace owner publish (GAP-475)"
description: "Owner steps to list the prepared RevealUI VS Code agent plugin. Automation must not create publisher credentials or publish."
visibility: internal
status: verified
audience: maintainer
---

# VS Code Marketplace owner publish (GAP-475)

The package is prepared. Listing it is owner work (GAP-475).

| Artifact | Path |
| --- | --- |
| Plugin directory | `deployment/vscode/plugin/` |
| Catalog (prepared, not discovered) | `deployment/vscode/marketplace.json` |
| Local tarball | `pnpm package:vscode-plugin` writes `deployment/vscode/dist/revealui-vscode-plugin-<version>.tar.gz` |

Version `0.1.0` matches `VSCodeGenerator` in
`packages/harnesses/src/content/generators/vscode.ts`. Bump the generator,
`plugin.json`, and the catalog entry together when the hook contract changes.
This version is independent of the npm version of `@revealui/harnesses`.

Validate the committed package with `pnpm validate:vscode-marketplace`.

## Local VS Code + Copilot smoke

Run this before any listing:

1. Install `@revealui/harnesses` so `revealui-harnesses` is on `PATH`.
2. Point VS Code `chat.pluginLocations` at the absolute path of
   `deployment/vscode/plugin`.
3. Reload VS Code with Copilot agent mode.
4. Complete the prompts for the instance URL and the device token. The
   package stores neither value.
5. Run one permitted MCP tool call and confirm a receipt path.

## Git catalog channel

VS Code and Copilot read `.github/plugin/marketplace.json` when a marketplace
repository is added (`chat.plugins.marketplaces`). This repo's default branch
is `test`, so a file at that path would be installable as soon as it lands.

The prepared catalog is `deployment/vscode/marketplace.json`. Its `source`
is already `./deployment/vscode/plugin` (repository-root relative). After
the smoke above, copy that file to `.github/plugin/marketplace.json` on the
default branch. That copy is the publish step for this channel.

Install id after that copy: `revealui@revealui`.

## Publisher account

If the channel still requires a publisher identity on the Visual Studio
Marketplace, create that publisher on the publisher management page:

https://marketplace.visualstudio.com/manage/publishers/

Automation must not create publisher credentials and must not publish. Keep
personal access tokens out of this repo. Keep publish workflows out of this
repo. `pnpm package:vscode-plugin` builds a tarball and stops there.

## Package contents

- `plugin.json` uses command-based hooks only. Every hook runs
  `revealui-harnesses hook vscode`.
- `.mcp.json` references `${input:revealui-mcp-url}` and
  `${input:revealui-mcp-token}`. The token input is `password: true`.
- The package contains no device token and no live instance URL.

`chat.pluginLocations` remains the supported install path until the listing
exists and the owner has smoked it. `docs/guides/connect-vscode.md` stays on
that local path until then.
