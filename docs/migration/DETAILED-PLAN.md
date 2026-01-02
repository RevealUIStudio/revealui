# RevealUI Development Plan

**Date**: January 2, 2026  
**Status**: Core Infrastructure Complete  
**Current Phase**: CRDT Memory System Implementation

---

## Completed Work

### Database Infrastructure ✅
- Drizzle ORM integrated with NeonDB Postgres
- 20 database tables created and pushed
- pgvector extension enabled for AI features

### CRDT Core ✅
- VectorClock implementation (causal ordering)
- LWW-Register (last-writer-wins)
- OR-Set (observed-remove set)  
- PN-Counter (positive-negative counter)
- 23 tests passing

### Build System ✅
- CMS compiles successfully
- All packages lint clean
- Type checking passes

---

## Current Work: Memory System

### Phase 1: Memory Classes
```typescript
// Working Memory - Fast CRDT-backed store
class WorkingMemory<T> {
  async get(key: string): Promise<T | undefined>
  async set(key: string, value: T): Promise<void>
  async delete(key: string): Promise<void>
  async merge(other: WorkingMemory<T>): Promise<void>
}

// Episodic Memory - Event stream with retention
class EpisodicMemory<T> {
  async append(event: T): Promise<void>
  async query(filter: Filter): Promise<T[]>
  async prune(olderThan: Date): Promise<number>
}
```

### Phase 2: Vector Search
- Embed memories using OpenAI embeddings
- Store vectors in pgvector columns
- Semantic similarity queries

### Phase 3: React Hooks
```typescript
function useMemory<T>(key: string): [T | undefined, (val: T) => void]
function useCRDT<T>(initialValue: T): CRDTHook<T>
function useSync(config: SyncConfig): SyncStatus
```

### Phase 4: ElectricSQL Integration (Blueprint)
- Real-time sync between clients
- Offline-first operation
- Automatic conflict resolution

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     RevealUI Framework                          │
├─────────────────────────────────────────────────────────────────┤
│  apps/cms          │  apps/web                                  │
│  (Next.js 16)      │  (Vite + Hono SSR)                        │
├─────────────────────────────────────────────────────────────────┤
│  @revealui/cms     │  @revealui/db      │  @revealui/memory    │
│  (CMS Framework)   │  (Drizzle ORM)     │  (CRDT Memory)       │
├─────────────────────────────────────────────────────────────────┤
│  @revealui/schema  │  packages/services                        │
│  (Zod Contracts)   │  (Stripe/Supabase)                        │
├─────────────────────────────────────────────────────────────────┤
│  NeonDB Postgres + pgvector                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Commands

```bash
# Build all
pnpm build

# Run tests
pnpm test

# Push database schema
cd packages/db && pnpm db:push

# Open Drizzle Studio
cd packages/db && pnpm db:studio

# Lint
pnpm lint
```

---

## Success Metrics

| Task | Status |
|------|--------|
| Database schema | ✅ Complete |
| Tables in NeonDB | ✅ 20 tables |
| pgvector enabled | ✅ Complete |
| CRDT primitives | ✅ Complete |
| CMS build | ✅ Passes |
| Lint | ✅ Clean |
| Memory classes | ⏳ In progress |
| Vector search | ⏳ Pending |
| React hooks | ⏳ Pending |

---

**Last Updated**: January 2, 2026
