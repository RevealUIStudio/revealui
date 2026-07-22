---
title: "@revealui/harnesses"
description: "AI harness coordination for RevealUI - enables multiple AI coding tools to work on the same codebase safely and in parallel."
visibility: public
status: verified
audience: user
---

# @revealui/harnesses

> **Commercial package**  -  requires a [RevealUI Pro license](https://revealui.com/pro). Free to install and evaluate; a license key is required for production use.


AI harness coordination for RevealUI  -  enables multiple AI coding tools to work on the same codebase safely and in parallel.

## Features

- **Multi-Harness Coordination**: Cursor, OpenCode, and RevealUI agent adapters with conflict detection; Claude Code / VS Code via hooks and content generators
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
const sessionId = deriveSessionId('zed', state.agents.map((a) => a.id))
await manager.registerSession({
  id: sessionId,
  env: 'Zed/WSL',
  task: 'implementing feature X',
  files: ['src/feature.ts'],
})
```

### Remote Gateway (HTTP)

The daemon can optionally expose the same JSON-RPC surface as the Unix socket over HTTP, for remote access (for example the Studio app connecting from another machine on the network):

```bash
revealui-harnesses start --http-port 7890
```

The gateway is fail-closed. Every `/rpc` and `/api/*` call, including `agent.spawn` and `agent.stop`, is refused with `401` until it carries a valid bearer token. There is no pre-pairing bypass, on a fresh daemon or after a restart.

**Pairing (challenge-response  -  the secret never crosses the wire):**

1. On first start, the daemon generates a 32-byte secret at a `0600` file in its data dir and prints the path:
   ```
   ✓ Bootstrap pairing secret: ~/.local/share/revealui/pairing-secret
   ```
   Only someone who can read that file (the machine owner) can pair.
2. The client requests a single-use, short-lived nonce: `GET /api/pair` → `{ nonce, expiresIn }` (expires in 2 minutes by default).
3. The client reads the secret file and computes `HMAC-SHA256(secret, nonce)`, then posts it back: `POST /api/pair` with `{ nonce, hmac, label? }`.
4. On a valid response the gateway mints a bearer token (`{ token, expiresAt }`) and stores only its SHA-256 hash. Send the token as `Authorization: Bearer <token>` on every subsequent call.

Tokens are durable (default 90-day TTL) and persisted as hashes, so a daemon restart with a previously-issued token stays authenticated  -  it never reopens the pre-pairing window. Repeated failed pairing attempts trigger a per-source exponential-backoff lockout plus a global cooldown.

## Exports

| Subpath | Contents |
|---------|----------|
| `@revealui/harnesses` | Full API: adapters, registry, coordinator, detection, config, protocol |
| `@revealui/harnesses/types` | Type definitions: HarnessAdapter, commands, events, capabilities |
| `@revealui/harnesses/workboard` | WorkboardManager, deriveSessionId, detectSessionType, file-locking |
| `@revealui/harnesses/content` | Content definitions, manifest builders, generators |
| `@revealui/harnesses/storage` | DaemonStore (PGlite-backed daemon state), schema |
| `@revealui/harnesses/protocol` | Protocol adapter types, config generators, event normalizer |

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
- [RevCon](https://github.com/RevealUIStudio/revcon)  -  Editor config sync across agents (separate fleet repo)

## License

FSL-1.1-MIT (Fair Source — converts to MIT after 2 years). See [LICENSE](../../LICENSE).
