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
- **Config Sync**: Portable config backup to external drives (DevPod/LTS)
- **Session Identity**: Detects parent environment (Zed, Cursor, terminal) via process chain

The JSON-RPC coordination runtime (the daemon that serves `session.*`, `mail.*`,
`files.*`, `tasks.*`, `events.*` over `~/.local/share/revealui/harness.sock`)
lives in the RevDev daemon, not in this package — see the daemon-ownership ADR
(2026-07-25). This package is the CLI, the content-definition layer, and the
`./gates` module that a fail-closed merge-authorization dependency in the
private repo consumes.

## Architecture

```
packages/harnesses/src/
├── adapters/       # AI tool adapters (Claude Code, Copilot, OpenCode, Cursor) — incubating
├── config/         # Config path resolution and SSD sync
├── content/        # Canonical rules/commands/agents/skills + generators
├── gates/          # CI guardrails (guardrail-2 verdict parser, doc-currency shared rules)
├── manager/        # .revealui project manager (equal vendor adapters)
├── detection/      # Auto-detect installed/running harnesses — incubating
├── registry/       # Lifecycle management of adapters — incubating
├── server/         # inference-service.ts only (in-process; no HTTP/socket server here)
├── types/          # HarnessAdapter contract, commands, events
├── workboard/      # Multi-agent workboard primitives — incubating
└── cli.ts          # CLI + RPC client (dispatches to the RevDev daemon's socket)
```

## Project manager (`.revealui`)

All vendors (Claude, Grok, Cursor, OpenCode, VS Code, native agent) are **equal
adapters**. Shared policy is not owned by any vendor home.

| Layer | Role |
|-------|------|
| Package definitions (`src/content/definitions`) | Build-time SSOT |
| **`.revealui/`** (`manager.json` + `content/`) | On-disk project manager |
| `.claude` / `.cursor` / `.opencode` / `~/.grok` | Thin stubs or machine prefs only |

```bash
# Write manager.json + equal adapter content (manager tree + Cursor/OpenCode surfaces)
pnpm exec revealui-harnesses manager materialize
# writes: .revealui/manager.json + .revealui/content/* + .cursor/hooks.json
#          + .opencode/{agents,commands}/* + equal adapter stubs

# Verify manager present and valid
pnpm exec revealui-harnesses manager check

# Content only — default generator is the manager tree (not a vendor fork)
pnpm exec revealui-harnesses content sync
# equivalent:
pnpm exec revealui-harnesses content sync --generator claude-code

# Definition ↔ committed generator snapshot (CI lock, GAP-406)
pnpm --filter @revealui/harnesses content:snapshot:check
# After editing content/definitions/**, refresh hashes:
pnpm --filter @revealui/harnesses content:snapshot:write
# Local disk vs definitions (when .revealui/content exists):
pnpm exec revealui-harnesses content diff --check
```

`content sync` without `--generator` uses `DEFAULT_CONTENT_GENERATOR_ID`
(`claude-code`). That generator emits into **`.revealui/content/`** (the manager
tree). Vendor trees stay adapters; do not full-copy hardlines into `~/.claude`
or `~/.grok`.

Committed SHA-256 locks live in `content-snapshots/<generatorId>.json`. Unit
tests and the local CI gate fail when definitions change without refreshing
those files in the same PR.

## CLI

```bash
# List available harnesses (dispatches to the RevDev daemon's socket)
revealui-harnesses status

# Sync harness config to/from SSD
revealui-harnesses sync claude-code push

# Print workboard state
revealui-harnesses coordinate

# Project manager (equal vendors)
revealui-harnesses manager materialize
revealui-harnesses manager check
revealui-harnesses content sync
```

## Usage

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

Remote HTTP access lives in **`@revdev/daemon`**, not this package.

- Implementation: `revdev/packages/daemon/src/http-gateway.ts` (revdev#328)
- SSE ownership tickets: revdev#329
- Opt-in: set daemon `httpPort` (default `0` = off)
- Studio pairing: Settings → connection tab (`pairWithDaemon`)

The harnesses-side gateway twin and PGlite `DaemonStore` were deleted after the
port landed (GAP-421 residual, 2026-07-29). Do not re-introduce a second HTTP
server in this package.

## Exports

| Subpath | Contents |
|---------|----------|
| `@revealui/harnesses` | Full API: adapters, registry, detection, config, protocol, inference service |
| `@revealui/harnesses/types` | Type definitions: HarnessAdapter, commands, events, capabilities |
| `@revealui/harnesses/workboard` | WorkboardManager, deriveSessionId, detectSessionType, file-locking |
| `@revealui/harnesses/content` | Content definitions, manifest builders, generators (`DEFAULT_CONTENT_GENERATOR_ID` → manager tree) |
| `@revealui/harnesses/manager` | Project manager schema, materialize, check (`.revealui`) |

Protocol adapter types, config generators, and the event normalizer are re-exported from the root `@revealui/harnesses` entry only (`packages/harnesses/src/index.ts:1`). The dedicated `@revealui/harnesses/protocol` and `@revealui/harnesses/storage` subpaths were removed (GAP-421; `packages/harnesses/package.json` exports map).

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
