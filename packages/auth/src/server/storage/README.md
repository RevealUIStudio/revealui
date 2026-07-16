---
title: "Storage Migration Guide"
description: "The authentication system uses **storage abstraction** with automatic backend selection:"
visibility: internal
status: verified
audience: maintainer
---

# Storage Migration Guide

## Current State

The authentication system uses **storage abstraction** with automatic backend selection:
- **Database Storage** (production) - Uses existing PostgreSQL/NeonDB
- **In-Memory Storage** (development) - Fallback when database not available

## Storage Backends

### Database Storage (Production)

**Pros:**
- Uses existing database (no additional infrastructure)
- Works across multiple servers
- Persistent across restarts
- Integrates with ElectricSQL sync (client-side)

**Cons:**
- Slower than in-memory (but acceptable for rate limiting)
- Requires cleanup jobs for expired entries

**Implementation:**
- Automatically selected when `POSTGRES_URL` or `DATABASE_URL` is set
- Uses the `rate_limits` table (`DatabaseStorage`, `packages/auth/src/server/storage/database.ts`)
- No cleanup job deletes expired rows; `get()` filters them out at query time (`gte(rateLimits.resetAt, now)`), so stale rows accumulate until a future retention job is added

### In-Memory Storage (Development)

**Pros:**
- Fast (no database queries)
- No setup required
- Good for development/testing

**Cons:**
- Won't work with multiple servers
- Data lost on server restart
- Not suitable for production scaling

**Implementation:**
- Automatically selected when database URL not available
- Used as fallback in development
- `InMemoryStorage.cleanup()` (`packages/auth/src/server/storage/in-memory.ts`) removes expired entries from the in-process `Map`, but nothing calls it on a schedule today; it exists for a caller to invoke periodically

## Architecture

```
Storage Abstraction
├── DatabaseStorage (production)
│   └── Uses PostgreSQL/NeonDB tables
│       ├── rate_limits
│       └── failed_attempts
└── InMemoryStorage (development fallback)
    └── Map-based storage
```

## Migration Status

✅ **COMPLETE** - Storage abstraction implemented and migrated:
- ✅ Rate limiting uses storage abstraction
- ✅ Brute force protection uses storage abstraction
- ✅ Database tables created (see `packages/db/migrations/` for current migration files)
- ⚠️ No scheduled cleanup job yet; see Cleanup section below
- ✅ Automatic backend selection

## Environment Variables

```bash
# Database (required for production)
POSTGRES_URL=postgresql://...
# or
DATABASE_URL=postgresql://...

# If not set, falls back to in-memory (development only)
```

## Cleanup

There are no `pnpm cleanup:*` scripts. Expired entries are handled differently per backend:
- **Database storage**: expired rows are filtered out at read time (`get()` only returns rows where `resetAt` is in the future); nothing deletes them yet.
- **In-memory storage**: `InMemoryStorage.cleanup()` removes expired entries from the `Map`, but no caller schedules it automatically today.

## Production Deployment

For production with multiple servers:
1. Ensure `POSTGRES_URL` is set
2. Database storage will be automatically used
3. Rate limiting and brute force protection will work across all servers

## Note on ElectricSQL

ElectricSQL is used for **client-side sync** (agent memory, contexts, conversations).
Database storage is used for **server-side rate limiting** and brute force protection.
These serve different purposes and work together.

---

**Status:** ✅ Migration complete. Database storage works for horizontal scaling.
