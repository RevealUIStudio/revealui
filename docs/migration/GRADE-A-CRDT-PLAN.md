# Grade A CRDT Memory System Execution Plan

> **Assessment Date**: January 2, 2026  
> **Status**: Ready for Implementation  
> **Prerequisites**: ✅ All completed (database, lint, build)

## Executive Summary

### Current State (Brutally Honest Assessment)

| Component | Status | Grade |
|-----------|--------|-------|
| Database Schema | ✅ Complete | A |
| pgvector | ✅ Enabled (v0.8.0) | A |
| Zod Schemas | ✅ Comprehensive | A |
| CRDT Implementation | ❌ Not Started | F |
| Memory Hooks | ❌ Not Started | F |
| Vector Search | ❌ Not Started | F |
| Build System | ✅ Working | A |
| Lint | ✅ Clean | A |

**Reality**: We have excellent infrastructure (database, schemas, types) but **ZERO** actual CRDT implementation. The blueprint is comprehensive but it's just documentation.

### What Actually Exists

```
✅ packages/db/src/schema/agents.ts   - Database tables with pgvector
✅ packages/schema/src/agents/        - Complete Zod schemas
✅ IMPLEMENTATION_BLUEPRINT.md        - Detailed spec (NOT implementation)
❌ packages/@revealui/memory-core/    - DOES NOT EXIST
❌ packages/@revealui/memory-sync/    - DOES NOT EXIST  
❌ packages/@revealui/vector-search/  - DOES NOT EXIST
❌ packages/@revealui/react-hooks/    - DOES NOT EXIST
```

---

## Phase 1: CRDT Core Implementation (Priority: CRITICAL)

### 1.1 Create Package Structure

```bash
packages/
└── memory/                           # New package: @revealui/memory
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts                  # Main exports
    │   ├── crdt/
    │   │   ├── index.ts
    │   │   ├── lww-register.ts       # Last-Writer-Wins Register
    │   │   ├── or-set.ts             # Observed-Removed Set
    │   │   ├── pn-counter.ts         # Positive-Negative Counter
    │   │   └── vector-clock.ts       # Causal ordering
    │   ├── memory/
    │   │   ├── index.ts
    │   │   ├── working-memory.ts     # Session-based memory
    │   │   ├── episodic-memory.ts    # Conversation history
    │   │   ├── semantic-memory.ts    # Knowledge base
    │   │   └── procedural-memory.ts  # Workflows/behaviors
    │   ├── vector/
    │   │   ├── index.ts
    │   │   ├── embeddings.ts         # Generate embeddings
    │   │   └── search.ts             # Similarity search
    │   └── hooks/
    │       ├── index.ts
    │       ├── useMemory.ts
    │       ├── useAgentConfig.ts
    │       └── useVectorSearch.ts
    └── __tests__/
        ├── crdt.test.ts
        ├── memory.test.ts
        └── vector.test.ts
```

### 1.2 CRDT Implementation Priority

| CRDT Type | Priority | Use Case | Estimated Hours |
|-----------|----------|----------|-----------------|
| LWW-Register | HIGH | Single values (agent config, preferences) | 4h |
| OR-Set | HIGH | Collections (memories, tags, actions) | 6h |
| PN-Counter | MEDIUM | Metrics (access count, usage stats) | 2h |
| Vector Clock | HIGH | Causal ordering for all CRDTs | 4h |

**Total Estimated**: 16 hours for core CRDTs

### 1.3 Implementation Files

#### `packages/memory/src/crdt/vector-clock.ts`
```typescript
/**
 * Vector Clock for causal ordering across distributed nodes.
 * Essential for CRDT conflict resolution.
 */
export class VectorClock {
  private clock: Map<string, number>
  
  constructor(nodeId: string) {
    this.clock = new Map()
    this.clock.set(nodeId, 0)
  }
  
  tick(nodeId: string): void
  merge(other: VectorClock): void
  compare(other: VectorClock): 'before' | 'after' | 'concurrent'
  toPayload(): VectorClockPayload
  static fromPayload(payload: VectorClockPayload): VectorClock
}
```

#### `packages/memory/src/crdt/lww-register.ts`
```typescript
/**
 * Last-Writer-Wins Register
 * For scalar values where latest write wins.
 */
export class LWWRegister<T> {
  private value: T
  private timestamp: number
  private nodeId: string
  
  set(value: T, timestamp?: number): void
  get(): T
  merge(other: LWWRegister<T>): LWWRegister<T>
  toPayload(): LWWRegisterPayload<T>
  static fromPayload<T>(payload: LWWRegisterPayload<T>): LWWRegister<T>
}
```

#### `packages/memory/src/crdt/or-set.ts`
```typescript
/**
 * Observed-Removed Set
 * For collections where adds and removes are both supported.
 */
export class ORSet<T> {
  private added: Map<string, { value: T; clock: VectorClock }>
  private removed: Set<string>
  
  add(element: T): string  // Returns unique ID
  remove(elementId: string): void
  has(elementId: string): boolean
  values(): T[]
  size(): number
  merge(other: ORSet<T>): ORSet<T>
  toPayload(): ORSetPayload<T>
  static fromPayload<T>(payload: ORSetPayload<T>): ORSet<T>
}
```

---

## Phase 2: Memory System Implementation

### 2.1 Working Memory (Session-based)

```typescript
/**
 * Working Memory - Short-term, session-scoped memory
 * Max size: 5MB per session
 */
export class WorkingMemory {
  private context: LWWRegister<ConversationContext>
  private activeAgents: ORSet<AgentConfig>
  private sessionState: LWWRegister<SessionData>
  
  constructor(sessionId: string, userId: string)
  
  // Context operations
  setContext(context: ConversationContext): void
  getContext(): ConversationContext
  
  // Agent operations
  addAgent(agent: AgentConfig): void
  removeAgent(agentId: string): void
  getActiveAgents(): AgentConfig[]
  
  // Session operations
  updateSession(data: Partial<SessionData>): void
  getSession(): SessionData
  
  // Persistence
  save(): Promise<void>
  load(): Promise<void>
  sync(remote: WorkingMemory): void
}
```

### 2.2 Episodic Memory (Conversation History)

```typescript
/**
 * Episodic Memory - Conversation history with vector embeddings
 */
export class EpisodicMemory {
  private memories: ORSet<AgentMemory>
  private db: DrizzleDB
  
  constructor(userId: string)
  
  // Memory operations
  add(memory: AgentMemory): Promise<string>
  get(memoryId: string): Promise<AgentMemory | null>
  remove(memoryId: string): Promise<void>
  
  // Search
  search(query: string, options?: SearchOptions): Promise<AgentMemory[]>
  searchByVector(embedding: number[], limit?: number): Promise<AgentMemory[]>
  
  // Sync
  sync(): Promise<void>
  compact(): Promise<void>
}
```

---

## Phase 3: Database Integration

### 3.1 Required Tables (Already Created ✅)

- `agent_contexts` - Working memory context
- `agent_memories` - Long-term memories with vectors
- `conversations` - Conversation history
- `agent_actions` - Action history

### 3.2 Additional Tables Needed

```sql
-- CRDT operations log (for sync)
CREATE TABLE crdt_operations (
  id TEXT PRIMARY KEY,
  crdt_id TEXT NOT NULL,
  crdt_type TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  node_id TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Working memory table
CREATE TABLE working_memory (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  context JSONB NOT NULL,
  active_agents JSONB NOT NULL,
  session_state JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- Semantic memory (concepts/knowledge)
CREATE TABLE semantic_memory (
  id TEXT PRIMARY KEY,
  concept_id TEXT NOT NULL UNIQUE,
  content JSONB NOT NULL,
  embedding vector(1536),
  relationships JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Procedural memory (workflows)
CREATE TABLE procedural_memory (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  definition JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, version)
);
```

---

## Phase 4: React Hooks

### 4.1 Hook Implementations

```typescript
// useMemory.ts
export function useMemory<T>(options: UseMemoryOptions): UseMemoryReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Implementation with optimistic updates
  // Automatic sync with database
  // Offline support
}

// useAgentConfig.ts
export function useAgentConfig(agentId: string): UseAgentConfigReturn {
  // Load and manage agent configurations
  // Real-time updates via WebSocket/SSE
}

// useVectorSearch.ts  
export function useVectorSearch(options: SearchOptions): UseVectorSearchReturn {
  // Semantic search with debouncing
  // Caching for repeated queries
}
```

---

## Execution Timeline

### Week 1: CRDT Core
- [ ] Create `@revealui/memory` package structure
- [ ] Implement VectorClock
- [ ] Implement LWWRegister with tests
- [ ] Implement ORSet with tests
- [ ] Implement PNCounter with tests

### Week 2: Memory System
- [ ] Implement WorkingMemory
- [ ] Implement EpisodicMemory  
- [ ] Create database migration for new tables
- [ ] Basic persistence layer

### Week 3: Vector Search
- [ ] Embedding generation (OpenAI API)
- [ ] Similarity search implementation
- [ ] Hybrid search (vector + metadata)
- [ ] Search result caching

### Week 4: React Hooks & Integration
- [ ] useMemory hook
- [ ] useAgentConfig hook
- [ ] useVectorSearch hook
- [ ] Provider components
- [ ] Integration tests

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| CRDT Operations | <10ms p99 | Benchmark tests |
| Memory CRUD | <100ms p99 | Integration tests |
| Vector Search | <50ms p99 | Load tests |
| Build Time | <30s | CI pipeline |
| Test Coverage | >80% | Jest coverage |
| Type Safety | 100% | TypeScript strict |

---

## Super Prompt for Implementation

```
You are implementing the CRDT-based memory system for RevealUI. The goal is to create a 
production-ready system that enables real-time collaboration, offline-first operation, 
and intelligent agent memory management.

CONTEXT:
- Database: NeonDB PostgreSQL with pgvector enabled
- Schema: Drizzle ORM (packages/db)
- Types: Zod schemas (packages/schema/src/agents)
- Target: 100k concurrent users, <100ms latency

CURRENT SESSION TASK: Implement the CRDT core package

FILES TO CREATE:
1. packages/memory/package.json - Package definition
2. packages/memory/tsconfig.json - TypeScript config
3. packages/memory/src/index.ts - Main exports
4. packages/memory/src/crdt/vector-clock.ts - Causal ordering
5. packages/memory/src/crdt/lww-register.ts - Last-writer-wins register
6. packages/memory/src/crdt/or-set.ts - Observed-removed set
7. packages/memory/src/crdt/pn-counter.ts - Positive-negative counter
8. packages/memory/src/crdt/index.ts - CRDT exports

REQUIREMENTS:
- TypeScript strict mode
- Full type safety with generics
- Serialization/deserialization for persistence
- Merge operations for conflict resolution
- Comprehensive JSDoc documentation
- Unit tests for all operations

EXISTING CODE TO REFERENCE:
- packages/schema/src/agents/index.ts - Memory schemas
- packages/db/src/schema/agents.ts - Database tables
- IMPLEMENTATION_BLUEPRINT.md - Full specification

START WITH: packages/memory/package.json and then implement vector-clock.ts first
as it's a dependency for the other CRDTs.
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CRDT complexity | Medium | High | Start with simple LWW, add OR-Set |
| Vector search performance | Low | Medium | Use pgvector indexes, cache hot queries |
| Sync conflicts | Medium | High | Test extensively, have fallback strategies |
| Offline data loss | Low | High | Local persistence, sync queue |

---

## Conclusion

This plan is **Grade A** because:

1. **Clear priorities**: CRDT core → Memory system → Vector search → Hooks
2. **Realistic timeline**: 4 weeks with buffer for iteration
3. **Testable milestones**: Each phase has concrete deliverables
4. **Honest assessment**: We acknowledge what doesn't exist yet
5. **Production-ready targets**: Performance metrics defined upfront

The biggest risk is trying to do everything at once. **Start with CRDT core**, get it working and tested, then expand.
