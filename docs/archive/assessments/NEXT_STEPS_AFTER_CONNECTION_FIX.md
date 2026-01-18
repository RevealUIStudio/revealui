# Next Steps After Supabase Connection Fix

**Date:** 2026-01-16  
**Status:** ✅ Connection Fixed | ⚠️ Schema Setup Needed  
**Priority:** High - Complete verification

---

## ✅ Completed

1. ✅ **Supabase Connection Fixed** - Dual driver implementation working
2. ✅ **Environment Variable Test Fixed** - Test now passes
3. ✅ **Package Exports Fixed** - memory/memory, memory/vector, embeddings
4. ✅ **Connection Verified** - Supabase connection successful

---

## 🔧 Immediate Next Steps (30 minutes)

### 1. Fix Missing Export for Persistence (5 minutes)

**Issue:** Test imports `@revealui/ai/memory/persistence` but export doesn't exist

**Fix:**
- Add `"./memory/persistence"` export to `packages/ai/package.json`
- Rebuild package

**File:** `packages/ai/package.json`
```json
"./memory/persistence": {
  "import": "./dist/memory/persistence/index.js",
  "types": "./dist/memory/persistence/index.d.ts"
}
```

### 2. Set Up All Three Databases (15 minutes)

**Issue:** Tables don't exist in databases

**Action:** Run the unified setup script:
```bash
export $(grep -v '^#' .env | xargs)
pnpm test:db:setup
```

**What it sets up:**
- 🔵 Vector Database (Supabase) - `agent_memories` table with pgvector
- 🟢 REST Database (NeonDB) - All REST API tables
- ⚡ ElectricSQL - Verified connection to REST database

**What it does:**
- Installs `pgvector` extension
- Creates `agent_memories` table with proper schema
- Creates HNSW index for vector similarity search
- Creates filtering indexes

**Expected output:**
```
✅ pgvector extension: Installed
✅ agent_memories table: Exists
✅ Database setup is complete!
```

### 3. Verify Setup (5 minutes)

**Action:** Run verification:
```bash
pnpm --filter test test:memory:verify
```

**Expected:** All checks passing, including:
- ✅ Vector Database Connection
- ✅ agent_memories Table: Exists
- ✅ pgvector Extension: Installed

### 4. Run All Tests (5 minutes)

**Action:** Run complete test suite:
```bash
pnpm --filter test test:memory:all
```

**Expected:** All 115 tests passing

---

## 📋 Detailed Steps

### Step 1: Add Persistence Export

```bash
# Edit packages/ai/package.json
# Add to exports section:
"./memory/persistence": {
  "import": "./dist/memory/persistence/index.js",
  "types": "./dist/memory/persistence/index.d.ts"
}

# Rebuild
pnpm --filter @revealui/ai build
```

### Step 2: Set Up All Three Databases (Fresh Setup)

The unified setup script (`packages/test/scripts/setup-dual-database.ts`) will:
1. **Vector Database (Supabase):**
   - Check if `pgvector` extension exists
   - Check if `agent_memories` table exists
   - Run fresh schema setup from `packages/db/migrations/supabase-vector-setup.sql`

2. **REST Database (NeonDB):**
   - Check if `users` table exists
   - Run fresh schema setup from `packages/db/migrations/neon-rest-setup.sql`
   - Install `pgvector` extension (for `agent_contexts.embedding`)

3. **ElectricSQL:**
   - Verify connection to REST database
   - Confirm ElectricSQL can sync from REST database

**Note:** This is a fresh schema setup (not a migration). For pre-production, we use fresh setup. Migrations will be added post-production when features are added.

**Schema creates:**
- `pgvector` extension
- `agent_memories` table with:
  - Vector embedding column (1536 dimensions)
  - HNSW index for similarity search
  - Filtering indexes (site_id, agent_id, type, created_at)
  - Composite indexes for common queries

### Step 3: Verify and Test

```bash
# Verify setup
pnpm --filter test test:memory:verify

# Run all memory tests
pnpm --filter test test:memory:all

# Run specific test suites
pnpm --filter test test:memory:dual
pnpm --filter test test:memory:vector
pnpm --filter test test:memory:episodic
```

---

## 🎯 Success Criteria

After completing these steps:

- ✅ All package exports working
- ✅ Triple database architecture set up:
  - ✅ Vector Database (Supabase) - pgvector + agent_memories table
  - ✅ REST Database (NeonDB) - All REST API tables + pgvector
  - ✅ ElectricSQL - Connection verified
- ✅ OpenAPI 3.2.0 specification generated
- ✅ All 115 tests passing
- ✅ Vector memory operations working
- ✅ Episodic memory operations working
- ✅ Triple database architecture fully verified

---

## 📊 Current Test Status

**Before Schema Setup:**
- ✅ 114/115 tests passing (99%)
- ❌ 1 test failing: "should query agent_memories" (table doesn't exist)

**After Schema Setup:**
- ✅ 115/115 tests passing (100%) - Expected

---

## 🔍 Troubleshooting

### If Setup Script Fails

1. **Check Connection:**
   ```bash
   pnpm --filter test test:memory:verify
   ```
   Should show: `✅ Vector Database Connection: Connected successfully`

2. **Check Permissions:**
   - Ensure DATABASE_URL has CREATE EXTENSION permission
   - Ensure DATABASE_URL has CREATE TABLE permission

3. **Manual Setup:**
   - Connect to Supabase SQL editor
   - Run `packages/db/migrations/supabase-vector-setup.sql` manually
   - (This is a fresh schema setup, not a migration)

### If Tests Still Fail

1. **Verify Table Exists:**
   ```sql
   SELECT EXISTS (
     SELECT FROM information_schema.tables 
     WHERE table_name = 'agent_memories'
   );
   ```

2. **Verify Extension:**
   ```sql
   SELECT EXISTS (
     SELECT FROM pg_extension 
     WHERE extname = 'vector'
   );
   ```

3. **Check Indexes:**
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'agent_memories';
   ```

---

## 📝 Documentation Updates Needed

After completion, update:
- [ ] `TEST_RESULTS_2026.md` - Update with 100% pass rate
- [ ] `CONSOLIDATED_STATUS_2026.md` - Mark verification complete
- [ ] `SUPABASE_CONNECTION_FIX.md` - Add schema setup notes
- [ ] `NEXT_STEPS_2026.md` - Update with completion status

---

**Estimated Time:** 30 minutes  
**Priority:** High (blocks final verification)  
**Status:** Ready to execute (connection fixed, scripts ready)
