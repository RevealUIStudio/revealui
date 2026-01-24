# TanStack DB + Electric Benefits for RevealUI

**Date**: January 2025  
**Status**: Analysis & Recommendations  
**Related**: [TanStack DB + Electric Research](./TANSTACK_DB_ELECTRIC_RESEARCH.md)

## Executive Summary

RevealUI currently uses ElectricSQL directly via `@revealui/sync` with a hybrid approach (ElectricSQL for reads, RevealUI API for mutations). Adding **TanStack DB** on top of ElectricSQL could provide significant benefits:

- ✅ **Optimistic mutations** - Instant UI updates (currently writes wait for API response)
- ✅ **Better query performance** - Sub-millisecond queries with differential dataflow
- ✅ **Cross-collection queries** - Easier to query across agent contexts, memories, and conversations
- ✅ **Improved reactivity** - Fine-grained reactivity minimizes re-renders
- ✅ **Better developer experience** - Collections and live queries are more ergonomic
- ✅ **Incremental adoption** - Can migrate one collection at a time

However, there are trade-offs:
- ⚠️ **Additional layer** - Adds complexity to the stack
- ⚠️ **Migration effort** - Would need to refactor existing hooks
- ⚠️ **Current approach works** - The hybrid approach is already working well

## Current Architecture

RevealUI's current sync architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
│                                                              │
│  ┌──────────────┐              ┌──────────────┐            │
│  │ ElectricSQL  │              │ RevealUI API │            │
│  │ useShape     │──────────────▶│  REST Client │            │
│  │ (Reads)      │              │  (Writes)    │            │
│  └──────────────┘              └──────────────┘            │
│         │                              │                    │
└─────────│──────────────────────────────│────────────────────┘
          │                              │
          │    Session Cookie            │
          │                              │
┌─────────│──────────────────────────────│────────────────────┐
│         │        Server                │                    │
│         │                              │                    │
│         │    ┌────────────────────────────────────────────┐ │
│         │    │      ElectricSQL Service                  │ │
│         │    │      - Shape proxy                        │ │
│         │    │      - Row-level filtering                │ │
│         │    └────────────────────────────────────────────┘ │
│         │                              │                    │
│         │    ┌────────────────────────────────────────────┐ │
│         │    │      RevealUI CMS API                     │ │
│         │    │      - Mutations                          │ │
│         │    │      - Validation                         │ │
│         │    │      - Access control                     │ │
│         │    └────────────────────────────────────────────┘ │
│         │                              │                    │
└─────────│──────────────────────────────│────────────────────┘
          │                              │
          ▼                              ▼
   ┌──────────┐                   ┌──────────┐
   │ Electric │                   │ Postgres │
   │  Server  │◀──────────────────▶│ Database │
   └──────────┘                   └──────────┘
```

### Current Implementation

**Reads (ElectricSQL)**:
```typescript
// packages/sync/src/hooks/useAgentContext.ts
const { data } = useShape({
  url: shapeUrl,
  params: {
    where: whereClause,
    params: whereParams,
  },
})
```

**Writes (RevealUI API)**:
```typescript
// packages/sync/src/utils/revealui-api.ts
await fetch(`/api/agent-contexts/${id}`, {
  method: 'PUT',
  body: JSON.stringify(data),
})
```

### Current Limitations

1. **No optimistic mutations** - UI waits for API response
2. **Simple queries only** - Limited to single-table queries
3. **Manual reactivity** - Re-renders based on entire shape updates
4. **No cross-collection queries** - Must query collections separately
5. **Raw ElectricSQL API** - Less ergonomic than collections

## Proposed Architecture with TanStack DB

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  TanStack DB │    │   Electric   │    │ RevealUI API │  │
│  │  Collection  │───▶│ Shape Client │    │  REST Client │  │
│  │  (Reactive)  │    │   (Sync)     │    │  (Mutations) │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
└─────────│───────────────────│────────────────────│──────────┘
          │                   │                    │
          │    Session Cookie │ (automatic)        │
          │                   ▼                    ▼
┌─────────│───────────────────────────────────────────────────┐
│         │           Server                                  │
│         │                                                    │
│         │    ┌────────────────────────────────────────────┐ │
│         │    │      Shape Proxy Routes                   │ │
│         │    │      - Validate session                   │ │
│         │    │      - Row-level filtering                │ │
│         │    │      - Forward to Electric                │ │
│         │    └────────────────────────────────────────────┘ │
│         │                              │                    │
│         │    ┌────────────────────────────────────────────┐ │
│         │    │      RevealUI CMS API                     │ │
│         │    │      - Mutations                          │ │
│         │    │      - Validation                         │ │
│         │    │      - Transaction IDs                    │ │
│         │    └────────────────────────────────────────────┘ │
│         │                              │                    │
└─────────│──────────────────────────────│────────────────────┘
          │                              │
          ▼                              ▼
   ┌──────────┐                   ┌──────────┐
   │ Electric │                   │ Postgres │
   │  Server  │◀──────────────────▶│ Database │
   └──────────┘                   └──────────┘
```

## Key Benefits

### 1. Optimistic Mutations

**Current**: UI waits for API response before updating

```typescript
// Current approach
const updateContext = async (updates: Partial<AgentContext>) => {
  await fetch(`/api/agent-contexts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
  // UI updates after API response
}
```

**With TanStack DB**: Instant UI updates with background sync

```typescript
// With TanStack DB
const updateContext = (updates: Partial<AgentContext>) => {
  agentContextCollection.update(id, (draft) => {
    Object.assign(draft, updates)
  })
  // UI updates immediately
  // Sync happens in background
}
```

**Benefits**:
- ✅ Instant UI feedback
- ✅ Works offline (syncs when online)
- ✅ Better perceived performance
- ✅ Automatic rollback on validation failure

### 2. Better Query Performance

**Current**: Simple shape queries, re-fetches entire shape on changes

**With TanStack DB**: Sub-millisecond queries with incremental updates

```typescript
// Current - Simple filtering
const { data } = useShape({
  url: shapeUrl,
  params: {
    where: 'agent_id = $1 AND session_id = $2',
    params: { '1': agentId, '2': sessionId },
  },
})

// With TanStack DB - Complex queries with joins
const { data: contexts } = useLiveQuery((q) =>
  q
    .from({ context: agentContextCollection })
    .join({ memory: agentMemoryCollection }, ({ context, memory }) =>
      eq(memory.agent_id, context.agent_id)
    )
    .where(({ context }) =>
      and(
        eq(context.agent_id, agentId),
        eq(context.session_id, sessionId)
      )
    )
    .select(({ context, memory }) => ({
      context: context,
      memoryCount: count(memory.id),
    }))
)
```

**Benefits**:
- ✅ Sub-millisecond query performance
- ✅ Only updates changed parts (differential dataflow)
- ✅ Cross-collection queries with joins
- ✅ Aggregations and complex filters
- ✅ Fine-grained reactivity (minimizes re-renders)

### 3. Improved Developer Experience

**Current**: Raw ElectricSQL API

```typescript
// Current - Manual shape management
const shapeUrl = buildShapeUrl(config.serviceUrl)
const { data, isLoading, error } = useShape({
  url: shapeUrl,
  params: {
    where: whereClause,
    params: whereParams,
  },
})
```

**With TanStack DB**: Collections and live queries

```typescript
// With TanStack DB - Declarative collections
export const agentContextCollection = createCollection(
  electricCollectionOptions({
    id: 'agent-contexts',
    schema: agentContextSchema,
    shapeOptions: {
      url: '/api/agent-contexts',
    },
    getKey: (item) => item.id,
    onUpdate: async ({ transaction }) => {
      const { modified } = transaction.mutations[0]
      const result = await revealuiAPI.agentContexts.update.mutate({
        id: modified.id,
        data: modified,
      })
      return { txid: result.txid }
    },
  })
)

// Usage
const { data: contexts } = useLiveQuery((q) =>
  q.from({ agentContextCollection })
    .where(({ agentContextCollection }) =>
      eq(agentContextCollection.agent_id, agentId)
    )
)
```

**Benefits**:
- ✅ Type-safe collections
- ✅ Declarative configuration
- ✅ Automatic schema validation
- ✅ Better IDE support
- ✅ Less boilerplate code

### 4. Cross-Collection Queries

**Current**: Must query collections separately and join in application code

```typescript
// Current - Separate queries
const { data: contexts } = useAgentContext(agentId)
const { data: memories } = useAgentMemory(agentId)
const { data: conversations } = useConversations(userId, { agentId })

// Join in application code
const enriched = contexts.map(context => ({
  ...context,
  memories: memories.filter(m => m.agent_id === context.agent_id),
  conversations: conversations.filter(c => c.agent_id === context.agent_id),
}))
```

**With TanStack DB**: Native cross-collection queries

```typescript
// With TanStack DB - Database-level joins
const { data: enriched } = useLiveQuery((q) =>
  q
    .from({ context: agentContextCollection })
    .join({ memory: agentMemoryCollection }, ({ context, memory }) =>
      eq(memory.agent_id, context.agent_id)
    )
    .join({ conversation: conversationCollection }, ({ context, conversation }) =>
      eq(conversation.agent_id, context.agent_id)
    )
    .where(({ context }) => eq(context.agent_id, agentId))
    .select(({ context, memory, conversation }) => ({
      context,
      memories: collect(memory),
      conversations: collect(conversation),
    }))
)
```

**Benefits**:
- ✅ Database-level joins (more efficient)
- ✅ Single query instead of multiple
- ✅ Automatic reactivity across collections
- ✅ Type-safe joins

### 5. Fine-Grained Reactivity

**Current**: Entire shape re-renders on any change

**With TanStack DB**: Only affected components re-render

```typescript
// Current - All components re-render on shape update
const { data: contexts } = useShape({ url, params })
// Component re-renders even if only one context changed

// With TanStack DB - Only affected components re-render
const { data: contexts } = useLiveQuery((q) =>
  q.from({ agentContextCollection })
    .where(({ agentContextCollection }) =>
      eq(agentContextCollection.agent_id, agentId)
    )
)
// Component only re-renders if its specific query result changes
```

**Benefits**:
- ✅ Better performance (fewer re-renders)
- ✅ Smoother UI updates
- ✅ More predictable behavior

## Implementation Considerations

### Migration Strategy

**Incremental Adoption**: Can migrate one collection at a time

1. **Phase 1**: Add TanStack DB alongside existing ElectricSQL hooks
2. **Phase 2**: Migrate one collection (e.g., `agent-contexts`)
3. **Phase 3**: Migrate remaining collections
4. **Phase 4**: Remove old ElectricSQL hooks

### Required Changes

1. **Add TanStack DB Dependencies**:
   ```json
   {
     "@tanstack/react-db": "^0.1.52",
     "@tanstack/electric-db-collection": "^0.2.8"
   }
   ```

2. **Create Collections**:
   ```typescript
   // packages/sync/src/collections/agentContext.ts
   export const agentContextCollection = createCollection(
     electricCollectionOptions({
       id: 'agent-contexts',
       schema: agentContextSchema,
       shapeOptions: {
         url: '/api/agent-contexts',
       },
       // ... mutation handlers
     })
   )
   ```

3. **Create Shape Proxy Routes** (if not already exist):
   ```typescript
   // apps/cms/src/app/api/agent-contexts/route.ts
   const serve = async ({ request }) => {
     const session = await auth.api.getSession({ headers: request.headers })
     if (!session) return new Response('Unauthorized', { status: 401 })
     
     const originUrl = prepareElectricUrl(request.url)
     originUrl.searchParams.set('table', 'agent_contexts')
     originUrl.searchParams.set('where', `agent_id = '${session.user.id}'`)
     
     return proxyElectricRequest(originUrl)
   }
   ```

4. **Update Mutation Endpoints** (add transaction IDs):
   ```typescript
   // Add to RevealUI API mutations
   const result = await ctx.db.transaction(async (tx) => {
     const txid = await generateTxId(tx)
     const [updated] = await tx.update(agentContextsTable)
       .set(input.data)
       .where(eq(agentContextsTable.id, input.id))
       .returning()
     return { item: updated, txid }
   })
   ```

5. **Refactor Hooks**:
   ```typescript
   // Replace useShape with useLiveQuery
   export function useAgentContext(agentId: string) {
     const { data: contexts } = useLiveQuery((q) =>
       q.from({ agentContextCollection })
         .where(({ agentContextCollection }) =>
           eq(agentContextCollection.agent_id, agentId)
         )
     )
     
     const updateContext = (id: string, updates: Partial<AgentContext>) => {
       agentContextCollection.update(id, (draft) => {
         Object.assign(draft, updates)
       })
     }
     
     return { contexts, updateContext }
   }
   ```

### Compatibility with Current Architecture

**✅ Works with Existing Infrastructure**:
- Can use same ElectricSQL service
- Can use same RevealUI API endpoints (with transaction IDs)
- Can use same authentication (Better Auth)
- Can use same Drizzle schemas

**✅ No Breaking Changes**:
- Can run alongside existing hooks
- Can migrate incrementally
- Can rollback if needed

### Trade-offs

**Additional Complexity**:
- ⚠️ Another layer in the stack (ElectricSQL + TanStack DB)
- ⚠️ Need to understand both systems
- ⚠️ More dependencies

**Migration Effort**:
- ⚠️ Need to refactor existing hooks
- ⚠️ Need to add shape proxy routes (if not exist)
- ⚠️ Need to add transaction IDs to mutations
- ⚠️ Need to update documentation

**Current Approach Works**:
- ⚠️ The hybrid approach is already working
- ⚠️ No immediate pain points
- ⚠️ Adding TanStack DB is optimization, not requirement

## Recommendations

### Option 1: Full Migration (Recommended for Long-term)

**When**: If you want the best performance and developer experience

**Benefits**:
- ✅ Optimistic mutations
- ✅ Best query performance
- ✅ Best developer experience
- ✅ Cross-collection queries

**Effort**: Medium (2-3 weeks)
- Week 1: Set up TanStack DB infrastructure
- Week 2: Migrate collections
- Week 3: Testing and documentation

**Risk**: Low (can run alongside existing code)

### Option 2: Hybrid Approach (Recommended for Now)

**When**: Keep current approach, add TanStack DB for new features

**Benefits**:
- ✅ No migration effort
- ✅ Can use TanStack DB for new collections
- ✅ Can migrate existing collections gradually
- ✅ Lower risk

**Effort**: Low (1-2 days to set up infrastructure)

**Risk**: Very Low

### Option 3: Status Quo

**When**: Current approach meets all needs

**Benefits**:
- ✅ No changes needed
- ✅ Already working
- ✅ No risk

**Trade-offs**:
- ⚠️ No optimistic mutations
- ⚠️ Limited query capabilities
- ⚠️ Manual reactivity management

## Specific Use Cases for RevealUI

### 1. Agent Context + Memories Dashboard

**Current**: Multiple separate queries, manual joining

**With TanStack DB**: Single cross-collection query with joins

```typescript
const { data: dashboard } = useLiveQuery((q) =>
  q
    .from({ context: agentContextCollection })
    .join({ memory: agentMemoryCollection }, ({ context, memory }) =>
      eq(memory.agent_id, context.agent_id)
    )
    .where(({ context }) => eq(context.agent_id, agentId))
    .select(({ context, memory }) => ({
      context,
      memoryCount: count(memory.id),
      recentMemories: collect(memory).orderBy(desc(memory.created_at)).limit(10),
    }))
)
```

### 2. Real-time Collaboration

**Current**: Updates via API, sync via ElectricSQL shapes

**With TanStack DB**: Optimistic updates with instant UI feedback

```typescript
const updateMemory = (id: string, updates: Partial<AgentMemory>) => {
  agentMemoryCollection.update(id, (draft) => {
    Object.assign(draft, updates)
  })
  // UI updates immediately
  // Other users see update via ElectricSQL sync
}
```

### 3. Complex Filtering and Aggregations

**Current**: Limited to simple WHERE clauses

**With TanStack DB**: Complex queries with aggregations

```typescript
const { data: stats } = useLiveQuery((q) =>
  q
    .from({ memory: agentMemoryCollection })
    .where(({ memory }) =>
      and(
        eq(memory.agent_id, agentId),
        eq(memory.verified, true),
        gte(memory.created_at, startDate)
      )
    )
    .fn.select(({ memory }) => ({
      total: count(memory.id),
      byType: groupBy(memory.type, count(memory.id)),
      recent: collect(memory).orderBy(desc(memory.created_at)).limit(10),
    }))
)
```

## Conclusion

TanStack DB + Electric could provide significant benefits for RevealUI:

1. **Optimistic mutations** - Better UX with instant UI updates
2. **Better performance** - Sub-millisecond queries with fine-grained reactivity
3. **Better DX** - Collections and live queries are more ergonomic
4. **Cross-collection queries** - Native joins and aggregations
5. **Incremental adoption** - Can migrate one collection at a time

However, the current hybrid approach is already working well. The decision depends on:

- **Priority on UX**: If optimistic mutations are important → migrate
- **Complex queries**: If you need cross-collection queries → migrate
- **Developer experience**: If current API is limiting → migrate
- **Stability**: If current approach is fine → stay put

**Recommendation**: Start with **Option 2 (Hybrid)** - add TanStack DB infrastructure and use it for new collections, then gradually migrate existing collections if needed. This provides benefits without forcing a full migration.

## Next Steps

If proceeding with TanStack DB:

1. **Review the research document**: [TanStack DB + Electric Research](./TANSTACK_DB_ELECTRIC_RESEARCH.md)
2. **Create proof of concept**: Migrate one simple collection
3. **Measure benefits**: Compare performance and developer experience
4. **Decide on full migration**: Based on proof of concept results
5. **Plan migration**: If proceeding, create detailed migration plan

## References

- [TanStack DB + Electric Research](./TANSTACK_DB_ELECTRIC_RESEARCH.md) - Comprehensive analysis of TanStack DB + Electric integration
- [ElectricSQL Integration Guide](../../development/electric-integration.md) - Current RevealUI ElectricSQL integration
- [TanStack DB Documentation](https://tanstack.com/db/latest/docs/overview)
- [Electric SQL Documentation](https://electric-sql.com/docs)
- [Local-first sync with TanStack DB and Electric](https://electric-sql.com/blog/2025/07/29/local-first-sync-with-tanstack-db)
