# TanStack DB Implementation Plan

**Date**: January 2025  
**Status**: Planning  
**Approach**: Hybrid - Add TanStack DB infrastructure, use for new features, migrate existing collections gradually  
**Related**: [TanStack DB Benefits Analysis](./TANSTACK_DB_BENEFITS_FOR_REVEALUI.md)

## Executive Summary

This plan outlines the implementation of TanStack DB + Electric integration for RevealUI using a hybrid approach. We'll add TanStack DB infrastructure alongside existing ElectricSQL hooks, create a proof of concept with one collection, then gradually migrate existing collections.

**Timeline**: 2-3 weeks  
**Risk Level**: Low (incremental, can rollback)  
**Effort**: Medium (structured phases with clear checkpoints)

## Goals

1. ✅ Add TanStack DB infrastructure (collections, utilities, types)
2. ✅ Create proof of concept with one collection (agent-contexts)
3. ✅ Add shape proxy routes for authenticated sync
4. ✅ Update mutation APIs to return transaction IDs
5. ✅ Migrate existing collections gradually
6. ✅ Maintain backward compatibility during migration

## Phase Overview

**⚠️ UPDATED**: After reassessment, we need to add security infrastructure first.

```
Phase 0: Security Infrastructure (3-5 days) - NEW PRIORITY
├── Add shape proxy routes (CRITICAL)
├── Add authentication to API routes (CRITICAL)
└── Add transaction ID generation (REQUIRED)

Phase 1: TanStack DB Infrastructure (2-3 days)
├── Install dependencies
├── Create collection utilities
├── Create shape proxy utilities
└── Set up types and schemas

Phase 2: Proof of Concept (2-3 days)
├── Create agent-contexts collection
├── Integrate with shape proxy routes
├── Update mutation API with transaction IDs
├── Create new hook implementation
└── Test and validate

Phase 3: Gradual Migration (1-2 weeks)
├── Migrate agent-memories collection
├── Migrate conversations collection
└── Update documentation

Phase 4: Cleanup & Documentation (2-3 days)
├── Remove old hooks (if desired)
├── Update documentation
└── Performance comparison
```

## Phase 1: Infrastructure Setup

### 1.1 Install Dependencies

**Files**: `packages/sync/package.json`

Add TanStack DB dependencies:

```json
{
  "dependencies": {
    "@tanstack/react-db": "^0.1.52",
    "@tanstack/electric-db-collection": "^0.2.8",
    // ... existing dependencies
  }
}
```

**Tasks**:
- [ ] Add dependencies to `packages/sync/package.json`
- [ ] Run `pnpm install`
- [ ] Verify dependencies install correctly

**Checkpoint**: Dependencies installed, no build errors

### 1.2 Create Collection Utilities

**Files**: `packages/sync/src/collections/utils.ts`

Create utilities for building Electric URL and proxying requests:

```typescript
import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from '@electric-sql/client'

export function getElectricUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL || ''
  }
  return process.env.ELECTRIC_SERVICE_URL || ''
}

export function prepareElectricUrl(requestUrl: string): URL {
  const url = new URL(requestUrl)
  const electricUrl = getElectricUrl()
  const originUrl = new URL(`${electricUrl}/v1/shape`)

  // Copy Electric-specific query params
  url.searchParams.forEach((value, key) => {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      originUrl.searchParams.set(key, value)
    }
  })

  return originUrl
}
```

**Tasks**:
- [ ] Create `packages/sync/src/collections/utils.ts`
- [ ] Add Electric URL utilities
- [ ] Add type definitions
- [ ] Add tests

**Checkpoint**: Utilities created and tested

### 1.3 Create Transaction ID Utilities

**Files**: `packages/sync/src/collections/txid.ts`

Create utility for generating transaction IDs (to be used in API mutations):

```typescript
import { sql } from 'drizzle-orm'

export async function generateTxId(
  tx: any // Drizzle transaction type
): Promise<number> {
  const result = await tx.execute(
    sql`SELECT pg_current_xact_id()::xid::text as txid`
  )
  const txid = result.rows[0]?.txid

  if (txid === undefined) {
    throw new Error(`Failed to get transaction ID`)
  }

  return parseInt(txid as string, 10)
}
```

**Tasks**:
- [ ] Create `packages/sync/src/collections/txid.ts`
- [ ] Add transaction ID generation utility
- [ ] Add tests
- [ ] Document usage

**Checkpoint**: Transaction ID utility created and tested

### 1.4 Set Up Collection Types

**Files**: `packages/sync/src/collections/types.ts`

Create TypeScript types for collections:

```typescript
export interface CollectionConfig<T> {
  id: string
  schema: any // Zod schema
  shapeUrl: string
  getKey: (item: T) => string | number
  onInsert?: (transaction: any) => Promise<{ txid: number }>
  onUpdate?: (transaction: any) => Promise<{ txid: number }>
  onDelete?: (transaction: any) => Promise<{ txid: number }>
}
```

**Tasks**:
- [ ] Create `packages/sync/src/collections/types.ts`
- [ ] Define collection configuration types
- [ ] Export types for use in collections

**Checkpoint**: Types defined and exported

## Phase 2: Proof of Concept

### 2.1 Create Agent Contexts Collection

**Files**: `packages/sync/src/collections/agentContextCollection.ts`

Create TanStack DB collection for agent contexts:

```typescript
import { createCollection } from '@tanstack/react-db'
import { electricCollectionOptions } from '@tanstack/electric-db-collection'
import { agentContextSchema } from '../schema'
import { revealuiAPI } from '../utils/revealui-api'

export const agentContextCollection = createCollection(
  electricCollectionOptions({
    id: 'agent-contexts',
    shapeOptions: {
      url: new URL(
        '/api/agent-contexts',
        typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost:3000'
      ).toString(),
      parser: {
        timestamptz: (date: string) => new Date(date),
      },
    },
    schema: agentContextSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newContext } = transaction.mutations[0]
      const result = await revealuiAPI.agentContexts.create.mutate(newContext)
      return { txid: result.txid }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedContext } = transaction.mutations[0]
      const result = await revealuiAPI.agentContexts.update.mutate({
        id: updatedContext.id,
        data: updatedContext,
      })
      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedContext } = transaction.mutations[0]
      const result = await revealuiAPI.agentContexts.delete.mutate({
        id: deletedContext.id,
      })
      return { txid: result.txid }
    },
  })
)
```

**Tasks**:
- [ ] Create `packages/sync/src/collections/agentContextCollection.ts`
- [ ] Define collection with mutation handlers
- [ ] Use existing schemas from `@revealui/schema`
- [ ] Test collection creation

**Checkpoint**: Collection created, no TypeScript errors

### 2.2 Create Shape Proxy Route

**Files**: `apps/cms/src/app/api/agent-contexts/route.ts`

Create authenticated shape proxy route for agent contexts:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getRevealUI } from '@revealui/core'
import config from '@revealui/config'
import { prepareElectricUrl, proxyElectricRequest } from '@revealui/sync/collections/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // TODO: Validate session (implement with RevealUI auth)
  // const session = await auth.api.getSession({ headers: request.headers })
  // if (!session) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set('table', 'agent_contexts')
  // TODO: Add row-level filtering based on session
  // originUrl.searchParams.set('where', `agent_id = '${session.user.id}'`)

  return proxyElectricRequest(originUrl)
}
```

**Tasks**:
- [ ] Create `apps/cms/src/app/api/agent-contexts/route.ts`
- [ ] Implement shape proxy with authentication
- [ ] Add row-level filtering
- [ ] Test route with ElectricSQL service

**Checkpoint**: Shape proxy route working, authenticated requests succeed

### 2.3 Update Mutation API

**Files**: `apps/cms/src/app/api/agent-contexts/[id]/route.ts` (or wherever mutations are handled)

Update mutation endpoints to return transaction IDs:

```typescript
import { generateTxId } from '@revealui/sync/collections/txid'
import { db } from '@revealui/db'
import { agentContextsTable } from '@revealui/db/schema'
import { eq } from 'drizzle-orm'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const data = await request.json()

  const result = await db.transaction(async (tx) => {
    const txid = await generateTxId(tx)
    const [updated] = await tx
      .update(agentContextsTable)
      .set(data)
      .where(eq(agentContextsTable.id, id))
      .returning()
    return { item: updated, txid }
  })

  return NextResponse.json(result)
}
```

**Tasks**:
- [ ] Find/create mutation API routes
- [ ] Add transaction ID generation
- [ ] Update response format to include `txid`
- [ ] Test mutations return transaction IDs

**Checkpoint**: Mutations return transaction IDs, sync works correctly

### 2.4 Create New Hook Implementation

**Files**: `packages/sync/src/hooks/useAgentContextV2.ts` (temporary name)

Create new hook using TanStack DB:

```typescript
import { useLiveQuery, eq } from '@tanstack/react-db'
import { agentContextCollection } from '../collections/agentContextCollection'
import type { AgentContext } from '../schema'

export interface UseAgentContextV2Options {
  agentId?: string
  sessionId?: string
  enabled?: boolean
}

export function useAgentContextV2(
  agentId?: string,
  options?: UseAgentContextV2Options
) {
  const { sessionId, enabled = true } = options || {}

  const { data: contexts } = useLiveQuery(
    (q) => {
      let query = q.from({ agentContextCollection })

      if (agentId) {
        query = query.where(({ agentContextCollection }) =>
          eq(agentContextCollection.agent_id, agentId)
        )
      }

      if (sessionId) {
        query = query.where(({ agentContextCollection }) =>
          eq(agentContextCollection.session_id, sessionId)
        )
      }

      return query
    },
    [agentId, sessionId],
    { enabled }
  )

  const updateContext = (id: string, updates: Partial<AgentContext>) => {
    agentContextCollection.update(id, (draft) => {
      Object.assign(draft, updates)
    })
  }

  const context = contexts?.[0] || null

  return {
    context,
    contexts: contexts || [],
    updateContext,
    isLoading: false, // TanStack DB handles loading state
    error: null, // TanStack DB handles error state
  }
}
```

**Tasks**:
- [ ] Create `packages/sync/src/hooks/useAgentContextV2.ts`
- [ ] Implement hook using `useLiveQuery`
- [ ] Add optimistic mutation methods
- [ ] Export hook

**Checkpoint**: New hook implemented and exported

### 2.5 Test Proof of Concept

**Files**: `packages/sync/src/__tests__/integration/agentContextV2.test.tsx`

Create integration tests:

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useAgentContextV2 } from '../../hooks/useAgentContextV2'
import { ElectricProvider } from '../../provider'

describe('useAgentContextV2', () => {
  it('should fetch agent contexts', async () => {
    const wrapper = ({ children }) => (
      <ElectricProvider serviceUrl="http://localhost:5133">
        {children}
      </ElectricProvider>
    )

    const { result } = renderHook(
      () => useAgentContextV2('agent-123'),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.contexts).toBeDefined()
    })
  })

  it('should update context optimistically', async () => {
    // Test optimistic mutation
  })
})
```

**Tasks**:
- [ ] Create integration tests
- [ ] Test read functionality
- [ ] Test optimistic mutations
- [ ] Test real-time sync
- [ ] Compare performance with old hook

**Checkpoint**: Tests pass, proof of concept validated

## Phase 3: Shape Proxy Routes Setup

### 3.1 Create Shape Proxy Utility (Server-side)

**Files**: `apps/cms/src/lib/api/electric-proxy.ts`

Create server-side utility for shape proxying:

```typescript
import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from '@electric-sql/client'

export function prepareElectricUrl(requestUrl: string): URL {
  const url = new URL(requestUrl)
  const electricUrl = process.env.ELECTRIC_SERVICE_URL || 'http://localhost:5133'
  const originUrl = new URL(`${electricUrl}/v1/shape`)

  url.searchParams.forEach((value, key) => {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      originUrl.searchParams.set(key, value)
    }
  })

  return originUrl
}

export async function proxyElectricRequest(originUrl: URL): Promise<Response> {
  const response = await fetch(originUrl)
  const headers = new Headers(response.headers)
  headers.delete('content-encoding')
  headers.delete('content-length')
  headers.set('vary', 'cookie')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
```

**Tasks**:
- [ ] Create shape proxy utility in CMS app
- [ ] Add authentication integration
- [ ] Test with ElectricSQL service
- [ ] Document usage

**Checkpoint**: Shape proxy utility working, all routes can use it

### 3.2 Create Shape Proxy Routes

**Files**: 
- `apps/cms/src/app/api/agent-contexts/route.ts`
- `apps/cms/src/app/api/agent-memories/route.ts`
- `apps/cms/src/app/api/conversations/route.ts`

Create shape proxy routes for each collection:

```typescript
// Pattern for all routes
export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set('table', 'agent_contexts')
  originUrl.searchParams.set('where', `agent_id = '${session.user.id}'`)

  return proxyElectricRequest(originUrl)
}
```

**Tasks**:
- [ ] Create shape proxy routes for each collection
- [ ] Add authentication checks
- [ ] Add row-level filtering
- [ ] Test each route

**Checkpoint**: All shape proxy routes created and working

## Phase 4: API Mutation Updates

### 4.1 Add Transaction ID Generation to Mutations

**Files**: Mutation API routes (to be identified)

Update all mutation endpoints to return transaction IDs:

1. Find all mutation endpoints for sync collections
2. Add transaction ID generation
3. Update response format
4. Test each mutation

**Tasks**:
- [ ] Identify all mutation endpoints
- [ ] Add `generateTxId` import
- [ ] Update mutation handlers
- [ ] Update response format
- [ ] Test mutations

**Checkpoint**: All mutations return transaction IDs

### 4.2 Create Mutation API Client

**Files**: `packages/sync/src/utils/revealui-api-v2.ts`

Create API client for mutations (if needed):

```typescript
export const revealuiAPIV2 = {
  agentContexts: {
    create: async (data: any) => {
      const response = await fetch('/api/agent-contexts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      return response.json()
    },
    update: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/agent-contexts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      return response.json()
    },
    delete: async ({ id }: { id: string }) => {
      const response = await fetch(`/api/agent-contexts/${id}`, {
        method: 'DELETE',
      })
      return response.json()
    },
  },
}
```

**Tasks**:
- [ ] Create API client utilities
- [ ] Add type safety
- [ ] Test API client

**Checkpoint**: API client created and tested

## Phase 5: Gradual Migration

### 5.1 Migrate Agent Memories Collection

**Tasks**:
- [ ] Create `agentMemoryCollection`
- [ ] Create shape proxy route
- [ ] Update mutation API
- [ ] Create `useAgentMemoryV2` hook
- [ ] Test migration
- [ ] Update consuming code (if any)

**Checkpoint**: Agent memories migrated, tests pass

### 5.2 Migrate Conversations Collection

**Tasks**:
- [ ] Create `conversationCollection`
- [ ] Create shape proxy route
- [ ] Update mutation API
- [ ] Create `useConversationsV2` hook
- [ ] Test migration
- [ ] Update consuming code (if any)

**Checkpoint**: Conversations migrated, tests pass

### 5.3 Performance Comparison

Compare old vs. new approach:

- Query performance
- Mutation latency
- Re-render frequency
- Bundle size impact

**Tasks**:
- [ ] Create performance benchmarks
- [ ] Compare query performance
- [ ] Compare mutation latency
- [ ] Compare re-render frequency
- [ ] Document results

**Checkpoint**: Performance comparison complete

## Phase 6: Cleanup & Documentation

### 6.1 Update Documentation

**Files**: 
- `packages/sync/README.md`
- `docs/electric-integration.md`
- `docs/TANSTACK_DB_BENEFITS_FOR_REVEALUI.md`

**Tasks**:
- [ ] Update README with TanStack DB usage
- [ ] Update integration guide
- [ ] Add migration guide
- [ ] Add code examples

**Checkpoint**: Documentation updated

### 6.2 Remove Old Hooks (Optional)

**Decision Point**: Keep old hooks for backward compatibility or remove?

If removing:
- [ ] Remove old hook files
- [ ] Update exports
- [ ] Update tests
- [ ] Update documentation

**Checkpoint**: Cleanup complete (if proceeding)

### 6.3 Final Testing

**Tasks**:
- [ ] End-to-end testing
- [ ] Cross-tab sync testing
- [ ] Offline functionality testing
- [ ] Performance testing
- [ ] Load testing

**Checkpoint**: All tests pass, ready for production

## Success Criteria

### Phase 1 Success
- ✅ Dependencies installed
- ✅ Utilities created and tested
- ✅ No build errors

### Phase 2 Success
- ✅ Agent contexts collection working
- ✅ Shape proxy route authenticated
- ✅ Mutations return transaction IDs
- ✅ New hook working
- ✅ Tests passing
- ✅ Performance acceptable

### Phase 3 Success
- ✅ All shape proxy routes created
- ✅ Authentication working
- ✅ Row-level filtering working

### Phase 4 Success
- ✅ All mutations return transaction IDs
- ✅ Sync matching working correctly

### Phase 5 Success
- ✅ All collections migrated
- ✅ Performance improved or maintained
- ✅ No regressions

### Phase 6 Success
- ✅ Documentation updated
- ✅ All tests passing
- ✅ Ready for production

## Risk Mitigation

### Rollback Plan

Each phase can be rolled back independently:

- **Phase 1**: Remove dependencies, no code changes
- **Phase 2**: Keep old hooks, remove new collection
- **Phase 3**: Remove shape proxy routes, use direct ElectricSQL
- **Phase 4**: Remove transaction IDs, use old response format
- **Phase 5**: Keep old hooks alongside new ones

### Testing Strategy

- Unit tests for utilities
- Integration tests for collections
- E2E tests for hooks
- Performance benchmarks
- Backward compatibility tests

### Migration Strategy

- Keep old hooks during migration
- Use feature flags if needed
- Gradual rollout
- Monitor for issues

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Infrastructure | 2-3 days | None |
| Phase 2: Proof of Concept | 2-3 days | Phase 1 |
| Phase 3: Shape Proxy Routes | 1-2 days | Phase 2 |
| Phase 4: API Updates | 1-2 days | Phase 2 |
| Phase 5: Gradual Migration | 1-2 weeks | Phase 3, 4 |
| Phase 6: Cleanup | 2-3 days | Phase 5 |

**Total**: 2-3 weeks

## Next Steps

1. **Review this plan** - Ensure it aligns with goals
2. **Approve approach** - Confirm hybrid approach is correct
3. **Start Phase 1** - Begin infrastructure setup
4. **Weekly checkpoints** - Review progress each week
5. **Adjust as needed** - Adapt plan based on learnings

## Questions to Resolve

Before starting implementation:

1. **Authentication**: How should we integrate with RevealUI auth? (Better Auth? Custom?)
2. **Transaction IDs**: Should we use existing database transaction IDs or create custom ones?
3. **API Structure**: Where are mutation endpoints currently located?
4. **Backward Compatibility**: Should we keep old hooks indefinitely or deprecate them?
5. **Testing**: What's the current testing setup for the sync package?

## References

- [TanStack DB + Electric Research](./TANSTACK_DB_ELECTRIC_RESEARCH.md)
- [TanStack DB Benefits for RevealUI](./TANSTACK_DB_BENEFITS_FOR_REVEALUI.md)
- [TanStack DB Documentation](https://tanstack.com/db/latest/docs/overview)
- [Electric SQL Documentation](https://electric-sql.com/docs)
