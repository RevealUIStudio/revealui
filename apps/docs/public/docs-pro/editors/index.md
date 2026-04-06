# @revealui/editors

Editor configuration generators for VS Code, Zed, and Antigravity. Keeps your editor setup consistent across the team and aligned with RevealUI project conventions.

## Overview

`@revealui/editors` generates and syncs editor configuration files:

- **VS Code** — `.vscode/settings.json` + `.vscode/extensions.json` (recommended extensions)
- **Zed** — `.zed/settings.json` (theme, keybindings, extensions)
- **Antigravity** — `.agents/rules/revealui.md` (agent rules)

## Installation

Requires a RevealUI Pro license.

```bash
pnpm add @revealui/editors
```

## Usage

### Sync all editor configs

```typescript
import { syncEditorConfigs } from '@revealui/editors'

const result = await syncEditorConfigs({
  rootDir: process.cwd(),
  // Optional: only sync specific editors (default: all)
  editors: ['vscode', 'zed', 'antigravity'],
})

console.log('Written:', result.written)
console.log('Skipped (unchanged):', result.skipped)
console.log('Errors:', result.errors)
```

### Generate individual configs

```typescript
import {
  generateVSCodeSettings,
  generateVSCodeExtensions,
  generateZedSettings,
  generateAntigravityRules,
} from '@revealui/editors'

// Each returns a JSON-serializable object or string
const vscodeSettings = generateVSCodeSettings()
const vscodeExtensions = generateVSCodeExtensions()
const zedSettings = generateZedSettings()
const antigravityRules = generateAntigravityRules()
```

## What it does

- Writes config files only when content has changed (skip-if-identical)
- Creates directories as needed
- Returns a `SyncResult` with `written`, `skipped`, and `errors` arrays
- VS Code configs are shared across VS Code, Cursor, and Antigravity (written once)

## Roadmap

Editor daemon integration (real-time sync, agent coordination from within your editor) is planned for a future release. See the [harnesses package](/pro/harnesses) for current multi-agent coordination capabilities.
