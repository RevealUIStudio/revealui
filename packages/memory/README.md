# @revealui/memory

CRDT-based persistent memory system for RevealUI.

## Features

- **CRDT-based**: Conflict-free replicated data types for distributed systems
- **Persistent**: Database-backed storage with Neon Postgres
- **Type-safe**: Full TypeScript support
- **Performant**: Optimized for low-latency operations

## Installation

```bash
pnpm add @revealui/memory
```

## Quick Start

```typescript
import { EpisodicMemory } from '@revealui/memory/core/memory'
import { NodeIdService } from '@revealui/memory/core/services'
import { createClient } from '@revealui/db/client'

const db = createClient({ connectionString: process.env.POSTGRES_URL! })
const nodeIdService = new NodeIdService(db)
const nodeId = await nodeIdService.getNodeId('user', 'user-123')
const memory = new EpisodicMemory('user-123', nodeId, db)
```

## Testing

⚠️ **Important**: This package has known testing limitations. See [TESTING.md](./TESTING.md) for details.

### Quick Commands

```bash
# Unit tests (always work)
pnpm --filter @revealui/memory test

# Integration tests (require Neon instance)
POSTGRES_URL="postgresql://..." pnpm --filter @revealui/memory test __tests__/integration

# Production validation
POSTGRES_URL="postgresql://..." ./scripts/validate-production.sh
```

### Testing Limitations

- ❌ Local PostgreSQL testing not possible (Neon HTTP driver limitation)
- ⚠️ Mock database tests may fail (known limitation, not a bug)

**Full documentation**: See [TESTING.md](./TESTING.md)

## Documentation

- **[TESTING.md](./TESTING.md)**: Complete testing guide, limitations, and validation plan
- **Source Code**: `packages/memory/src/core/`
- **Helper Functions**: `packages/memory/src/core/utils/sql-helpers.ts`

## API Reference

### EpisodicMemory

Long-term memory for conversation history and agent memories.

```typescript
const memory = new EpisodicMemory(userId, nodeId, db)
await memory.add(agentMemory)
await memory.save()
const memories = await memory.getAll()
```

### NodeIdService

Deterministic node IDs for CRDT operations.

```typescript
const nodeIdService = new NodeIdService(db)
const nodeId = await nodeIdService.getNodeId('user', 'user-123')
```

### CRDTPersistence

Generic adapter for saving/loading CRDT state.

```typescript
const persistence = new CRDTPersistence(db)
await persistence.saveCRDTState(crdtId, 'lww_register', data)
const state = await persistence.loadCRDTState(crdtId, 'lww_register')
```

## Requirements

- Node.js 18+
- PostgreSQL with pgvector extension
- Neon Postgres (for production) or compatible database

## License

MIT

---

**Last Updated**: 2025-01-27
