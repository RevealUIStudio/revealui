# @revealui/editors

Editor integration system for RevealUI - adapters, daemon, and JSON-RPC server for managing external text editors.

## Overview

This package provides a unified system for integrating external text editors (VS Code, Neovim, Zed) with RevealUI. It includes:

- **Pure type definitions** - TypeScript interfaces and contracts
- **Editor adapters** - Implementations for specific editors
- **JSON-RPC server** - Communication protocol for editor control
- **Process management** - Auto-detection and lifecycle management
- **Config sync** - Bidirectional configuration synchronization

## Architecture

Editors are treated as **external executables**, never as linked libraries. Communication is data-only (commands in, results out). If an editor is uninstalled, RevealUI continues to function.

### Key Components

- **EditorAdapter** - Interface that all editor integrations must implement
- **EditorRegistry** - Manages multiple editor adapters
- **RpcServer** - JSON-RPC 2.0 server over Unix sockets
- **Auto-detection** - Discovers installed editors automatically
- **Config sync** - Push/pull configuration between local and SSD paths

## Installation

```bash
pnpm add @revealui/editors
```

## Usage

### Basic Usage

```typescript
import { EditorRegistry, ZedAdapter, VscodeAdapter, NeovimAdapter } from '@revealui/editors'

// Create registry and register adapters
const registry = new EditorRegistry()
registry.register(new ZedAdapter())
registry.register(new VscodeAdapter())
registry.register(new NeovimAdapter())

// List available editors
const editors = await registry.listAvailable()
console.log('Available editors:', editors)

// Execute command
const adapter = registry.get('vscode')
if (adapter) {
  await adapter.execute({
    type: 'open-file',
    path: '/path/to/file.ts',
    line: 42
  })
}
```

### Type-Only Imports

```typescript
import type {
  EditorAdapter,
  EditorCapabilities,
  EditorCommand,
  EditorInfo
} from '@revealui/editors/types'
```

### JSON-RPC Server

```typescript
import { RpcServer } from '@revealui/editors'

const server = new RpcServer(registry)
await server.start('~/.local/share/revealui/editor.sock')

// Server exposes these RPC methods:
// - editor.list
// - editor.info
// - editor.execute
// - editor.listRunning
// - editor.openFile
// - editor.syncConfig
// - editor.diffConfig
// - editor.installExtension
```

### CLI Usage

```bash
# Start daemon
revealui-editors start

# List available editors
revealui-editors list

# Open file in editor
revealui-editors open /path/to/file.ts --editor vscode

# Sync configuration
revealui-editors sync vscode push
revealui-editors sync vscode pull
```

## Supported Editors

- **VS Code** (`vscode`) - Microsoft Visual Studio Code
- **Neovim** (`neovim`) - Neovim text editor
- **Zed** (`zed`) - Zed code editor

## Editor Commands

```typescript
type EditorCommand =
  | { type: 'open-project'; path: string }
  | { type: 'open-file'; path: string; line?: number; column?: number }
  | { type: 'apply-config'; config: Record<string, unknown> }
  | { type: 'install-extension'; extensionId: string }
  | { type: 'get-status' }
  | { type: 'get-running-instances' }
  | { type: 'sync-config'; direction: 'push' | 'pull' }
  | { type: 'diff-config' }
```

## Editor Events

```typescript
type EditorEvent =
  | { type: 'editor-opened'; editorId: string; pid?: number }
  | { type: 'editor-closed'; editorId: string }
  | { type: 'file-opened'; editorId: string; path: string }
  | { type: 'config-applied'; editorId: string }
  | { type: 'error'; editorId: string; error: string }
```

## Configuration Management

The package supports syncing editor configurations between:
- **Local**: `~/.config/<editor>/`
- **SSD**: `/mnt/e/.revealui/<editor>/`

Supported editor configs:
- Zed: `~/.config/zed/settings.json`
- VS Code: `~/.config/Code/User/settings.json`
- Neovim: `~/.config/nvim/init.lua`

## Development

```bash
# Build package
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type check
pnpm typecheck

# Watch mode
pnpm dev
```

## API Reference

### EditorAdapter Interface

```typescript
interface EditorAdapter {
  readonly id: string
  readonly name: string
  getCapabilities(): EditorCapabilities
  getInfo(): Promise<EditorInfo>
  isAvailable(): Promise<boolean>
  execute(command: EditorCommand): Promise<EditorCommandResult>
  onEvent(handler: (event: EditorEvent) => void): () => void
  dispose(): Promise<void>
}
```

### EditorRegistry

```typescript
class EditorRegistry {
  register(adapter: EditorAdapter): void
  unregister(editorId: string): void
  get(editorId: string): EditorAdapter | undefined
  listAll(): EditorAdapter[]
  listAvailable(): Promise<EditorAdapter[]>
  dispose(): Promise<void>
}
```

## Migration from Previous Packages

This package consolidates the previous `@revealui/editor-sdk` and `@revealui/editor-daemon` packages:

```typescript
// Before (editor-sdk)
import type { EditorAdapter } from '@revealui/editor-sdk'

// After (editors)
import type { EditorAdapter } from '@revealui/editors/types'
// or
import type { EditorAdapter } from '@revealui/editors'

// Before (editor-daemon)
import { ZedAdapter, EditorRegistry } from '@revealui/editor-daemon'

// After (editors)
import { ZedAdapter, EditorRegistry } from '@revealui/editors'
```

## License

MIT
