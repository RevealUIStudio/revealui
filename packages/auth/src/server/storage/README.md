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
- Uses `rate_limits` and `failed_attempts` tables
- Cleanup jobs available: `pnpm cleanup:rate-limits` and `pnpm cleanup:failed-attempts`

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
- ✅ Database tables created (migration: `0003_create_rate_limits_tables.sql`)
- ✅ Cleanup jobs created
- ✅ Automatic backend selection

## Environment Variables

```bash
# Database (required for production)
POSTGRES_URL=postgresql://...
# or
DATABASE_URL=postgresql://...

# If not set, falls back to in-memory (development only)
```

## Cleanup Jobs

Run periodically to remove expired entries:

```bash
# Cleanup expired rate limits
pnpm cleanup:rate-limits

# Cleanup expired failed attempts
pnpm cleanup:failed-attempts
```

## Production Deployment

For production with multiple servers:
1. Ensure `POSTGRES_URL` is set
2. Database storage will be automatically used
3. Set up cron jobs for cleanup scripts
4. Rate limiting and brute force protection will work across all servers

## Note on ElectricSQL

ElectricSQL is used for **client-side sync** (agent memory, contexts, conversations).
Database storage is used for **server-side rate limiting** and brute force protection.
These serve different purposes and work together.

---

**Status:** ✅ Migration complete. Database storage works for horizontal scaling.
