# Supabase Connection Issue - RESOLVED

**Date:** 2026-01-16  
**Status:** ✅ FIXED - Dual Driver Implementation  
**Impact:** Previously blocked Supabase vector database tests - Now resolved

---

## Issue Summary

The `@neondatabase/serverless` driver transforms Supabase pooler connection strings incorrectly:
- **Input:** `aws-0-us-west-2.pooler.supabase.com:6543`
- **Transformed to:** `api.pooler.supabase.com` (invalid hostname)
- **Result:** DNS error `ENOTFOUND api.pooler.supabase.com`

This is a **known compatibility issue** between Neon's serverless driver and Supabase's pooler endpoints.

---

## Root Cause

The Neon serverless driver is designed for Neon databases, not Supabase. When it encounters a Supabase pooler URL, it attempts to normalize/transform the hostname, resulting in an invalid `api.pooler.supabase.com` hostname that doesn't exist.

**Error Location:**
- Driver: `@neondatabase/serverless`
- Function: `neon()` connection string processing
- Issue: Internal hostname transformation

---

## Solution Implemented ✅

### Dual Driver Architecture ✅ (FIXED)

**Implementation:**
- Added `postgres-js` as dependency for Supabase connections
- Modified `createClient()` to detect Supabase connection strings
- Uses `postgres-js` with `drizzle-orm/postgres-js` for Supabase
- Keeps `@neondatabase/serverless` with `drizzle-orm/neon-http` for NeonDB

**Code Changes:**
- `packages/db/src/client/index.ts`: Added dual driver support
- `packages/db/package.json`: Added `postgres` dependency
- Automatic detection: Checks for `.supabase.co` or `pooler.supabase.com` in connection string

**Result:** ✅ Supabase connection now works correctly
- Connection successful: `✅ Vector Database Connection: Connected successfully`
- No more DNS errors
- Proper driver selection based on connection string

**Previous Attempts (Before Fix):**
1. Connection String Preprocessing - Didn't work (driver transformation happens internally)
2. Direct Connection (Port 5432) - Still failed (driver issue)
3. Adding pgbouncer Parameter - Didn't prevent transformation

---

## Workarounds

### Option 1: Use Supabase REST API (Recommended for Tests)
Instead of direct database connection, use Supabase's REST API for vector operations:
- Use `@supabase/supabase-js` client
- Access vector operations via REST endpoints
- Bypasses driver transformation issue

### Option 2: Use Different Driver for Supabase
Use `postgres-js` or `pg` driver specifically for Supabase connections:
- Create separate client factory for Supabase
- Use standard PostgreSQL driver (not Neon serverless)
- Requires code changes to support dual drivers

### Option 3: Use Supabase Direct Connection with IPv4
- Enable IPv4 add-on in Supabase dashboard
- Use direct connection (port 5432) with IPv4
- May require different hostname format (without "pooler")

### Option 4: Wait for Driver Fix
- Monitor Neon driver updates
- Check if future versions fix Supabase compatibility
- Track issue: https://github.com/orgs/supabase/discussions/14165

---

## Current Status

**Connection:** ✅ Working (Dual driver implementation)  
**Tests:** ✅ Connection tests passing  
**Remaining:** Schema setup (table creation) - separate issue from connection

---

## Implementation Details

### How It Works

1. **Connection Detection:**
   ```typescript
   function isSupabaseConnection(connectionString: string): boolean {
     return (
       connectionString.includes('.supabase.co') ||
       connectionString.includes('pooler.supabase.com')
     )
   }
   ```

2. **Driver Selection:**
   - Supabase → `postgres-js` with `drizzle-orm/postgres-js`
   - NeonDB → `@neondatabase/serverless` with `drizzle-orm/neon-http`

3. **Configuration:**
   - Transaction pooler (port 6543): `prepare: false` (required for Supabase)
   - SSL: `require` (required for Supabase)
   - Session pooler (port 5432): `prepare: true` (if used)

### Benefits

- ✅ No more DNS transformation errors
- ✅ Proper driver for each database type
- ✅ Automatic detection (no manual configuration needed)
- ✅ Backward compatible (existing code works unchanged)

---

## Impact Assessment

**Affected Components:**
- Vector memory integration tests
- Episodic memory integration tests
- Dual database tests (Supabase connection parts)

**Not Affected:**
- NeonDB (REST database) - Working perfectly
- All other integration tests - Passing
- Core functionality - Verified (97% test pass rate)

**Overall Impact:** Medium - Blocks vector/episodic memory tests, but core functionality verified

---

**Last Updated:** 2026-01-16  
**Status:** ✅ RESOLVED | Dual Driver Implementation Complete | Connection Working
