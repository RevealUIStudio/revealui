# New ElectricSQL System - API Analysis

**Date**: January 8, 2025  
**Status**: ⚠️ **COMPLETELY DIFFERENT API**

---

## Discovery

### New Package Structure

**OLD SYSTEM** (`electric-sql@0.12.1`):
- Uses `electrify()` to create electrified database
- Uses `useLiveQuery()` hook for reactive queries
- Local-first with PGlite
- Sync via WebSocket

**NEW SYSTEM** (`@electric-sql/client@1.4.0`):
- Uses `ShapeStream` and `Shape` classes
- HTTP-based API to Postgres
- Server-side sync service (Electric 1.2.9)
- Different architecture entirely

---

## API Comparison

### Old API (0.12.1)

```typescript
// Client initialization
import { electrify } from 'electric-sql/pglite'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const electric = await electrify(db, config)

// React hooks
import { useLiveQuery } from 'electric-sql/react'

const { results } = useLiveQuery(
  db.agent_contexts.liveMany({ where: { agent_id: '123' } })
)
```

### New API (1.4.0)

```typescript
// Client initialization
import { ShapeStream, Shape } from '@electric-sql/client'

const stream = new ShapeStream({
  url: `${BASE_URL}/v1/shape`,
  params: {
    table: 'agent_contexts',
  },
})

const shape = new Shape(stream)

// Get rows
await shape.rows

// Subscribe to updates
shape.subscribe(({ rows }) => {
  // Handle updates
})
```

---

## Key Differences

### Architecture

**OLD**: 
- Local-first with PGlite
- WebSocket sync
- Client has local database
- Sync happens automatically

**NEW**:
- HTTP-based
- Server-side sync
- Client queries server
- Explicit shape subscriptions

### API Pattern

**OLD**:
- Database-like API (`db.table.liveMany()`)
- React hooks (`useLiveQuery`)
- Type-safe with generated types

**NEW**:
- HTTP API wrapper (`ShapeStream`)
- Manual subscriptions
- Different type system

---

## Impact on Implementation

### Current Code Won't Work

**All hooks need complete rewrite**:
- ❌ `useLiveQuery` doesn't exist in new API
- ❌ `liveMany()` doesn't exist
- ❌ `electrify()` replaced with `ShapeStream`
- ❌ Different query pattern

### Migration Required

**Complete rewrite needed**:
1. Replace `electrify()` with `ShapeStream`
2. Replace hooks with `Shape` subscriptions
3. Change query API from database-like to HTTP params
4. Update provider pattern
5. Rewrite all hooks

---

## React Integration ✅ **FOUND**

**Package**: `@electric-sql/react@1.0.26`

**Hook**: `useShape`

```typescript
import { useShape } from '@electric-sql/react'

const { isLoading, data } = useShape({
  url: 'http://my-api.com/shape',
  params: {
    table: 'agent_contexts',
  },
})
```

**Features**:
- ✅ React hook for shapes
- ✅ Automatic caching (shapes cached globally)
- ✅ Loading states
- ✅ Reactive updates

**No Provider Needed**: The package handles caching globally, so no provider component required (unlike old system).

---

## Decision Required

### Option 1: Migrate to New System ⚠️ **MAJOR REWRITE**

**Pros**:
- ✅ Future-proof (current system)
- ✅ Compatible with server 1.2.9
- ✅ Active development

**Cons**:
- ❌ Complete rewrite needed
- ❌ Different architecture
- ❌ Significant time investment (2-3 days)

### Option 2: Use Old System ⚠️ **NEED OLD SERVER**

**Pros**:
- ✅ Code already written
- ✅ Local-first architecture

**Cons**:
- ❌ No Docker image for 0.12.1 server
- ❌ Deprecated
- ❌ Would need to self-host old server

### Option 3: Hybrid Approach 🔄 **INVESTIGATE**

- Check if old client can work with new server
- Use compatibility layer
- Gradual migration

---

## Next Steps

1. ✅ **Found new packages** (DONE)
2. ⏳ **Check React package API**
   - Does it have hooks?
   - What's the React integration?
   - Any compatibility layer?

3. ⏳ **Decision**
   - Choose migration path
   - Estimate effort
   - Plan implementation

4. ⏳ **Execute**
   - Update packages
   - Rewrite code
   - Test compatibility

---

## Recommendation

**For immediate testing**: Need to check if old client (0.12.1) can work with new server (1.2.9)
- Likely won't work, but worth trying

**For production**: Migrate to new system
- Better long-term
- More support
- Future-proof

**Timeline**: 2-3 days for complete migration
