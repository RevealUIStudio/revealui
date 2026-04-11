# @revealui/harnesses

> **Commercial package**  -  requires a [RevealUI Pro license](https://revealui.com/pro). Free to install and evaluate; a license key is required for production use.


AI harness coordination for RevealUI  -  enables multiple AI coding tools to work on the same codebase safely and in parallel.

## Features

- **Multi-Harness Coordination**: Claude Code, Cursor, Copilot adapters with conflict detection
- **Workboard Protocol**: Shared `.claude/workboard.md` for session tracking and file reservations
- **Auto-Detection**: Discovers installed harnesses via PATH and running processes
- **JSON-RPC 2.0 Server**: Unix domain socket IPC for harness-to-harness communication
- **Config Sync**: Portable config backup to external drives (DevPod/LTS)
- **Session Identity**: Detects parent environment (Zed, Cursor, terminal) via process chain

## Architecture

```
packages/harnesses/src/
├── adapters/       # AI tool adapters (Claude Code, Copilot)
├── config/         # Config path resolution and SSD sync
├── detection/      # Auto-detect installed/running harnesses
├── registry/       # Lifecycle management of adapters
├── server/         # JSON-RPC 2.0 over Unix socket
├── types/          # HarnessAdapter contract, commands, events
├── workboard/      # Multi-agent workboard coordination
├── coordinator.ts  # Main orchestrator (start/stop lifecycle)
└── cli.ts          # CLI daemon and RPC client
```

## CLI

```bash
# Start daemon (detect harnesses, register session, start RPC server)
revealui-harnesses start --project /path/to/repo

# List available harnesses
revealui-harnesses status

# Sync harness config to/from SSD
revealui-harnesses sync claude-code push

# Print workboard state
revealui-harnesses coordinate --print
```

## Usage

```typescript
import { HarnessCoordinator } from '@revealui/harnesses'

const coordinator = new HarnessCoordinator({ projectRoot: '/path/to/repo' })
await coordinator.start()

// Coordinator auto-detects harnesses, registers in workboard, starts RPC server
// On shutdown:
await coordinator.stop()
```

### Workboard Coordination

```typescript
import { WorkboardManager, deriveSessionId } from '@revealui/harnesses/workboard'

const manager = new WorkboardManager('/path/to/repo/.claude/workboard.md')
const state = await manager.read()

// Register session
const sessionId = await deriveSessionId()
await manager.registerSession({
  id: sessionId,
  env: 'Zed/WSL',
  task: 'implementing feature X',
  files: ['src/feature.ts'],
})
```

## Exports

| Subpath | Contents |
|---------|----------|
| `@revealui/harnesses` | Full API: adapters, registry, coordinator, detection, config |
| `@revealui/harnesses/types` | Type definitions: HarnessAdapter, commands, events, capabilities |
| `@revealui/harnesses/workboard` | WorkboardManager, deriveSessionId, detectSessionType |

## Development

```bash
# Run tests
pnpm --filter @revealui/harnesses test

# Type check
pnpm --filter @revealui/harnesses typecheck

# Build
pnpm --filter @revealui/harnesses build
```

## Related Documentation

- [Coordination Rules](../../.claude/rules/coordination.md)  -  Multi-instance protocol
- [Architecture Guide](../../docs/ARCHITECTURE.md)  -  System architecture
- [Editors Package](../editors/README.md)  -  Editor daemon (parallel architecture)

## License

Commercial  -  see [LICENSE.commercial](../../LICENSE.commercial)
