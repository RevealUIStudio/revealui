# @revealui/editors

Editor daemon and adapter integrations for Zed, VS Code, and Neovim. Brings RevealUI AI capabilities directly into your editor workflow.

## Overview

`@revealui/editors` runs a local daemon that connects your editor to the RevealUI agent system:

- **Zed** — ACP (Agent Control Protocol) integration
- **VS Code** — Language server extension
- **Neovim** — Lua plugin via JSON-RPC

## Installation

Requires a RevealUI Pro license.

```bash
pnpm add -g @revealui/editors
```

## Starting the daemon

```bash
revealui-editor-daemon --port 3030
```

Or add to your shell profile for automatic startup:

```bash
# ~/.bashrc or ~/.zshrc
revealui-editor-daemon --port 3030 &
```

## Zed integration

The Zed adapter connects via ACP (Agent Control Protocol).

```json
// ~/.config/zed/settings.json
{
  "assistant": {
    "version": "2",
    "provider": {
      "name": "revealui",
      "endpoint": "http://localhost:3030"
    }
  }
}
```

## VS Code integration

Install the RevealUI extension from the marketplace, or manually:

```bash
code --install-extension revealui.revealui-vscode
```

Configure in VS Code settings:

```json
{
  "revealui.daemon.endpoint": "http://localhost:3030",
  "revealui.agent.model": "groq/llama-3.3-70b-versatile"
}
```

## Neovim integration

```lua
-- init.lua
require('revealui').setup({
  endpoint = 'http://localhost:3030',
  keymaps = {
    chat = '<leader>ai',
    complete = '<C-space>',
  },
})
```

## Daemon configuration

```typescript
// revealui.config.ts
import { defineEditorConfig } from '@revealui/editors'

export default defineEditorConfig({
  daemon: {
    port: 3030,
    logLevel: 'info',
  },
  agent: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    systemPrompt: 'You are a helpful coding assistant working in this codebase.',
  },
  workboard: {
    path: '.claude/workboard.md',
  },
})
```

## Workboard coordination

The editor daemon reads and writes the agent workboard, allowing multiple editor instances to coordinate on shared work. See [coordination rules](/pro) for details.
