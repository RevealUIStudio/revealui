# SQLite vs ElectricSQL: Should We Replace SQLite?

**Date**: January 2025  
**Question**: Should ElectricSQL replace SQLite for current use cases?

## Current SQLite Usage

### Purpose: Fallback Database

SQLite is used in `apps/cms/revealui.config.ts` as a **fallback when PostgreSQL is not available**:

```typescript
db: config.database.url
  ? universalPostgresAdapter({
      connectionString: config.database.url,
    })
  : sqliteAdapter({
      client: {
        url: path.resolve(projectRoot, '.revealui/cache/revealui.db'),
      },
    }),
```

### Use Cases

1. **Local Development**: When `POSTGRES_URL` is not set (quick start without database setup)
2. **Build Time**: During CI/CD builds where PostgreSQL might not be available
3. **Testing**: Some tests run without requiring PostgreSQL connection
4. **Development Onboarding**: Easier for developers to start without setting up PostgreSQL

### Characteristics

- ✅ **No service required**: File-based database
- ✅ **Zero configuration**: Works out of the box
- ✅ **Fast setup**: No database server needed
- ✅ **All collections supported**: Works for all RevealUI collections (users, posts, pages, etc.)

## Current ElectricSQL Usage

### Purpose: Real-Time Sync for Agent Tables

ElectricSQL is used for **real-time synchronization of agent-related data**:

**Tables**:
- `agent_contexts`
- `agent_memories`
- `agent_conversations`

**Location**: `packages/sync/`

### Use Cases

1. **Cross-tab sync**: Agent memory shared across browser tabs
2. **Cross-session persistence**: Data persists across browser sessions
3. **Real-time updates**: Automatic synchronization when data changes
4. **Offline-first**: Full functionality offline with automatic sync

### Characteristics

- ⚠️ **Requires PostgreSQL**: ElectricSQL syncs **FROM** PostgreSQL (not standalone)
- ⚠️ **Requires service**: ElectricSQL service must be running (via Docker)
- ⚠️ **Specific tables only**: Only for agent-related tables, not all collections
- ✅ **Real-time sync**: Provides real-time synchronization capabilities
- ✅ **Offline support**: Works offline with sync when online

## Why ElectricSQL Cannot Replace SQLite

### 1. **Different Purposes**

| Aspect | SQLite (Current) | ElectricSQL |
|--------|------------------|-------------|
| **Purpose** | Fallback database when PostgreSQL unavailable | Real-time sync from PostgreSQL |
| **When Used** | When `POSTGRES_URL` is missing | When PostgreSQL IS available |
| **Collections** | All RevealUI collections | Only agent-related tables |
| **Infrastructure** | None (file-based) | Requires PostgreSQL + ElectricSQL service |

### 2. **Dependency Conflict**

**SQLite Fallback Chain**:
```
No POSTGRES_URL → Use SQLite ✅
```

**ElectricSQL Chain**:
```
No POSTGRES_URL → Cannot use ElectricSQL ❌
(PG required) → ElectricSQL syncs from PG
```

**Problem**: ElectricSQL **requires** PostgreSQL, which defeats the purpose of having a fallback when PostgreSQL is unavailable.

### 3. **Architecture Mismatch**

**Current Architecture**:
```
┌─────────────────────────────────────────┐
│         RevealUI Database Layer         │
├─────────────────────────────────────────┤
│                                         │
│  IF POSTGRES_URL exists:                │
│    → Use PostgreSQL (all collections)   │
│  ELSE:                                  │
│    → Use SQLite (all collections) ✅    │
│                                         │
└─────────────────────────────────────────┘
```

**If Using ElectricSQL Instead**:
```
┌─────────────────────────────────────────┐
│         RevealUI Database Layer         │
├─────────────────────────────────────────┤
│                                         │
│  IF POSTGRES_URL exists:                │
│    → Use PostgreSQL + ElectricSQL ❓    │
│  ELSE:                                  │
│    → Cannot work ❌ (PG required)       │
│                                         │
└─────────────────────────────────────────┘
```

### 4. **Different Collections**

- **SQLite**: Supports **all** RevealUI collections (users, posts, pages, orders, etc.)
- **ElectricSQL**: Only syncs **agent-related** tables (contexts, memories, conversations)

Core collections (users, posts, pages) are explicitly **NOT** synced via ElectricSQL per the architecture.

## Recommendation: Keep Both (Different Purposes)

### Keep SQLite for Fallback

**Reason**: Provides zero-configuration fallback when PostgreSQL is unavailable.

**Benefits**:
- ✅ Quick local development setup
- ✅ Works in CI/CD without database service
- ✅ Supports all collections
- ✅ No additional infrastructure needed

### Keep ElectricSQL for Agent Sync

**Reason**: Provides real-time sync for agent-related data when PostgreSQL is available.

**Benefits**:
- ✅ Real-time synchronization
- ✅ Cross-tab/session sharing
- ✅ Offline-first support
- ✅ Specific to agent use case

## Alternative: Use PostgreSQL for Everything

If you want to remove SQLite entirely, you would need:

### Option 1: Require PostgreSQL Always

```typescript
// Remove SQLite fallback - require PostgreSQL
db: universalPostgresAdapter({
  connectionString: config.database.url || 
    throw new Error('POSTGRES_URL is required'),
}),
```

**Pros**:
- ✅ Simpler architecture (one database)
- ✅ ElectricSQL could potentially work for more tables

**Cons**:
- ❌ No fallback for local dev
- ❌ Requires database setup for all developers
- ❌ Build failures if PostgreSQL unavailable
- ❌ More complex onboarding

### Option 2: Use Local PostgreSQL (Docker)

Instead of SQLite, use a local PostgreSQL instance:

```bash
# Always have PostgreSQL available
docker compose -f docker-compose.test.yml up -d
```

**Pros**:
- ✅ Same database as production
- ✅ ElectricSQL could work

**Cons**:
- ❌ Still requires Docker/service running
- ❌ Not zero-configuration like SQLite
- ❌ More resource usage

## Conclusion

**❌ Do NOT replace SQLite with ElectricSQL** because:

1. **Different purposes**: SQLite is a fallback, ElectricSQL requires PostgreSQL
2. **Dependency conflict**: ElectricSQL needs what SQLite provides when unavailable
3. **Different scopes**: SQLite for all collections, ElectricSQL for agent tables only
4. **Infrastructure mismatch**: SQLite is file-based, ElectricSQL requires services

**✅ Keep Both**:
- **SQLite**: Fallback database for when PostgreSQL is unavailable
- **ElectricSQL**: Real-time sync for agent tables when PostgreSQL is available

They solve different problems and complement each other rather than compete.

## Current Architecture is Correct

```
┌─────────────────────────────────────────────────┐
│              RevealUI Architecture              │
├─────────────────────────────────────────────────┤
│                                                 │
│  Core Collections (Users, Posts, Pages, etc.)   │
│         ↓                                       │
│  IF POSTGRES_URL:                              │
│    → PostgreSQL (via Drizzle ORM)              │
│  ELSE:                                         │
│    → SQLite (file-based fallback) ✅           │
│                                                 │
│  Agent Tables (Contexts, Memories, etc.)        │
│         ↓                                       │
│  IF POSTGRES_URL + ElectricSQL service:        │
│    → PostgreSQL + ElectricSQL (real-time)      │
│  ELSE:                                         │
│    → PostgreSQL only (no sync)                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

This architecture is appropriate for the use cases.
