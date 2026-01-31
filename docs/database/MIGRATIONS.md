# Database Migrations and Provider Switching

**Last Updated:** 2025-01-31

---

## Table of Contents

1. [Overview](#overview)
2. [Switching Database Providers](#switching-database-providers)
   - [Quick Switch](#quick-switch)
   - [Switch to Neon](#switch-to-neon)
   - [Switch to Supabase](#switch-to-supabase)
   - [Switch to Vercel Postgres](#switch-to-vercel-postgres)
   - [Data Migration](#data-migration)
3. [Table Rename Migration](#table-rename-migration)
   - [Executive Summary](#executive-summary)
   - [Current State Analysis](#current-state-analysis)
   - [Migration Strategy Assessment](#migration-strategy-assessment)
   - [Detailed Migration Plan](#detailed-migration-plan)
   - [Rollback Plan](#rollback-plan)
   - [Risk Assessment](#risk-assessment)
   - [Testing Plan](#testing-plan)
4. [Related Documentation](#related-documentation)

---

## Overview

This guide covers two main migration scenarios:

1. **Switching Database Providers** - Moving between Neon, Supabase, and Vercel Postgres
2. **Table Rename Migration** - Migrating from legacy `payload_*` tables to `revealui_*` tables

---

## Switching Database Providers

### Quick Switch

#### Current Setup

Update `apps/cms/revealui.config.ts`:

```typescript
import { universalPostgresAdapter } from '@revealui/core/database'

export default buildConfig({
  db: universalPostgresAdapter({
    // Provider is auto-detected, but you can explicitly set it:
    // provider: 'neon' | 'supabase' | 'vercel'
  }),
  // ... rest of config
})
```

#### Provider Detection

The universal adapter automatically detects the provider from your connection string:

- **Neon**: Connection string contains `.neon.tech`
- **Supabase**: Connection string contains `.supabase.co`
- **Vercel Postgres**: `POSTGRES_URL` env var is set (or connection string contains `vercel`)

---

### Switch to Neon

#### 1. Get Neon Connection String

```
postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
```

#### 2. Update Environment

```bash
# .env.local
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
```

#### 3. Install Dependencies

```bash
pnpm add @neondatabase/serverless
```

#### 4. Update Config (Optional)

```typescript
db: universalPostgresAdapter({
  provider: 'neon', // Explicit (optional - auto-detected)
})
```

**Provider-Specific Features:**
- ✅ Serverless/edge functions
- ✅ Branching (copy database)
- ✅ Auto-scaling
- ⚠️ No built-in auth

---

### Switch to Supabase

#### 1. Get Supabase Connection String

**Pooling (Recommended):**
```
postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

#### 2. Update Environment

```bash
# .env.local
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# Optional: Supabase client credentials
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

#### 3. Install Dependencies

```bash
pnpm add pg @types/pg
```

#### 4. Update Config (Optional)

```typescript
db: universalPostgresAdapter({
  provider: 'supabase', // Explicit (optional - auto-detected)
})
```

**Provider-Specific Features:**
- ✅ Full-featured backend
- ✅ Built-in auth
- ✅ Real-time subscriptions
- ✅ Storage
- ⚠️ Fixed connection limits

---

### Switch to Vercel Postgres

**Note:** Vercel Postgres is deprecated. Use Neon for new projects.

#### 1. Create Vercel Postgres Database

In Vercel Dashboard → Storage → Create Database → Postgres

#### 2. Environment Auto-Configured

Vercel automatically sets:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

#### 3. Install Dependencies

```bash
pnpm add @vercel/postgres
```

#### 4. Update Config (Optional)

```typescript
db: universalPostgresAdapter({
  provider: 'vercel', // Explicit (optional - auto-detected)
  envVar: 'POSTGRES_URL', // Default
})
```

**Provider-Specific Features:**
- ✅ Seamless Vercel integration
- ✅ Automatic environment setup
- ✅ Managed connections
- ⚠️ Vercel-only deployments

---

### Data Migration

#### Data Export

```bash
# Export from current database
pg_dump $OLD_DATABASE_URL > backup.sql
```

#### Data Import

```bash
# Import to new database
psql $NEW_DATABASE_URL < backup.sql
```

#### Or Use Supabase CLI

```bash
# Export
supabase db dump -f backup.sql

# Import
supabase db reset -f backup.sql
```

---

### Provider Switching Troubleshooting

#### "Module not found"

Install provider-specific dependency:
```bash
# Neon
pnpm add @neondatabase/serverless

# Supabase
pnpm add pg @types/pg

# Vercel
pnpm add @vercel/postgres
```

#### "Connection refused"

- Check IP allowlist (Supabase)
- Verify connection string format
- Ensure SSL is enabled: `?sslmode=require`

#### Wrong provider detected

Explicitly set provider:
```typescript
db: universalPostgresAdapter({
  provider: 'neon', // Force specific provider
})
```

---

## Table Rename Migration

### Executive Summary

**Status**: ⚠️ **CRITICAL MIGRATION REQUIRED**
**Risk Level**: **HIGH** - Production downtime possible
**Estimated Downtime**: 30-60 minutes (depending on data volume)
**Complexity**: **MODERATE** - Requires careful coordination

This section outlines the plan to rename database tables from `payload_*` prefix to `revealui_*` prefix to complete the branding migration from Payload CMS to RevealUI.

---

### Current State Analysis

#### Tables Requiring Rename

1. **`payload_locked_documents`** → `revealui_locked_documents`
   - Stores document locking information for concurrent editing
   - **Relationships**: Self-referential (parent_id), links to all collections

2. **`payload_locked_documents_rels`** → `revealui_locked_documents_rels`
   - Junction table for locked document relationships
   - **Foreign Keys**: 20+ FKs to various collections (users, pages, products, etc.)

3. **`payload_preferences`** → `revealui_preferences`
   - Stores user/global preferences as JSON
   - **Relationships**: Links to users via `payload_preferences_rels`

4. **`payload_preferences_rels`** → `revealui_preferences_rels`
   - Junction table for preference relationships
   - **Foreign Keys**: `parent_id`, `users_id`

5. **`payload_migrations`** → `revealui_migrations`
   - Tracks database migration history
   - **No relationships**: Standalone table

#### Database Schema Impact

- **Total Tables**: 5 tables + their relationships
- **Foreign Key Constraints**: ~25 FK constraints requiring updates
- **Indexes**: All indexes will be automatically renamed (PostgreSQL behavior)
- **Sequences**: Primary key sequences will be renamed automatically
- **Triggers/Functions**: May exist and require updates

---

### Migration Strategy Assessment

#### Option 1: Fresh Database (RECOMMENDED for Development)

**Best For**: Development environments, new projects, non-production data

**Pros**:
- ✅ Clean slate - no migration complexity
- ✅ Zero risk of data loss
- ✅ Instant - no downtime
- ✅ Can test RevealUI from scratch
- ✅ Simpler rollback (just use old DB)

**Cons**:
- ❌ **All data is lost** (not viable for production)
- ❌ Requires data export/import if data needs to be preserved

**Implementation**:
```bash
# 1. Drop existing Supabase database
# 2. Create new database with RevealUI
# 3. Run initial migrations
# 4. Regenerate Supabase types
```

#### Option 2: ALTER TABLE RENAME (PRODUCTION APPROACH)

**Best For**: Production environments with existing data

**Pros**:
- ✅ Preserves all data
- ✅ No data migration needed
- ✅ Atomic operation (PostgreSQL)

**Cons**:
- ❌ Requires application downtime
- ❌ Complex FK constraint updates
- ❌ Must update all application code simultaneously
- ❌ Higher risk if not executed perfectly

**PostgreSQL Behavior**:
- `ALTER TABLE ... RENAME` is atomic and fast
- Foreign keys are automatically updated in PostgreSQL 9.2+
- Indexes are automatically renamed
- Sequences are automatically renamed
- **However**: Any hardcoded table names in code must be updated first

#### Option 3: Dual-Write Period (SAFEST for Production)

**Best For**: Zero-downtime production migrations

**Pros**:
- ✅ Zero downtime
- ✅ Gradual migration
- ✅ Easy rollback
- ✅ Can test in production

**Cons**:
- ❌ Most complex implementation
- ❌ Requires code changes for dual-write
- ❌ Longer timeline
- ❌ More testing required

---

### Recommended Approach: HYBRID STRATEGY

#### Phase 1: Development/Staging (Option 1 - Fresh DB)
Use fresh database for development and staging environments.

#### Phase 2: Production (Option 2 - ALTER TABLE)
Use ALTER TABLE RENAME for production with planned maintenance window.

---

### Detailed Migration Plan

#### Phase 1: Pre-Migration Preparation

##### Step 1.1: Audit and Backup

```sql
-- 1. Create full database backup
pg_dump -h <host> -U <user> -d <database> -F c -f backup_before_migration.dump

-- 2. Document current schema
\dt payload_*  -- List all payload tables
\d+ payload_locked_documents  -- Inspect table structure
\d+ payload_locked_documents_rels  -- Inspect relationships

-- 3. Check for hardcoded references
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%payload_locked_documents%';
```

##### Step 1.2: Update Codebase First

**CRITICAL**: Update code to use new table names BEFORE running migration.

1. Find all database queries using old table names
2. Update to use new table names OR use collection slugs (better approach)
3. Ensure RevealUI uses collection slugs (`revealui-locked-documents`) not table names
4. Update Supabase type generation configuration

##### Step 1.3: Verify Application Can Handle New Names

1. Update Supabase types file (or regenerate)
2. Run type checks: `pnpm typecheck:all`
3. Update any raw SQL queries

#### Phase 2: Migration Execution

##### Step 2.1: Maintenance Window Preparation

```bash
# Set application to maintenance mode
# Stop accepting new requests
# Wait for existing requests to complete
```

##### Step 2.2: Execute Rename Operations

```sql
BEGIN;

-- Rename main tables
ALTER TABLE payload_locked_documents
  RENAME TO revealui_locked_documents;

ALTER TABLE payload_preferences
  RENAME TO revealui_preferences;

ALTER TABLE payload_migrations
  RENAME TO revealui_migrations;

-- Rename junction tables
ALTER TABLE payload_locked_documents_rels
  RENAME TO revealui_locked_documents_rels;

ALTER TABLE payload_preferences_rels
  RENAME TO revealui_preferences_rels;

-- Verify all constraints are intact
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE confrelid::regclass::text LIKE '%revealui%'
   OR conrelid::regclass::text LIKE '%revealui%';

COMMIT;
```

**Expected Duration**: 5-10 seconds (even for large tables)

##### Step 2.3: Post-Migration Verification

```sql
-- 1. Verify table names
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE '%revealui%';

-- 2. Verify foreign keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name LIKE '%revealui%' OR ccu.table_name LIKE '%revealui%');

-- 3. Verify data integrity
SELECT COUNT(*) FROM revealui_locked_documents;
SELECT COUNT(*) FROM revealui_preferences;
SELECT COUNT(*) FROM revealui_migrations;

-- 4. Test application queries
-- (Run your application's standard queries)
```

#### Phase 3: Post-Migration

##### Step 3.1: Regenerate Database Types

```bash
# Regenerate types for new table names
pnpm generate:neon-types

# Or for Supabase:
supabase gen types typescript --local > packages/services/src/supabase/types.ts

# For production:
supabase gen types typescript --project-id <project-id> > packages/services/src/supabase/types.ts
```

##### Step 3.2: Application Deployment

1. Deploy updated code (must happen AFTER migration)
2. Verify application functionality
3. Monitor error logs for 24 hours
4. Remove maintenance mode

##### Step 3.3: Cleanup (Optional)

```sql
-- After 30 days of successful operation, can drop old backup
-- (Keep backup for at least 90 days for compliance)
```

---

### Rollback Plan

If migration fails or issues are discovered:

#### Immediate Rollback (Within 5 minutes)

```sql
BEGIN;

ALTER TABLE revealui_locked_documents
  RENAME TO payload_locked_documents;

ALTER TABLE revealui_preferences
  RENAME TO payload_preferences;

ALTER TABLE revealui_migrations
  RENAME TO payload_migrations;

ALTER TABLE revealui_locked_documents_rels
  RENAME TO payload_locked_documents_rels;

ALTER TABLE revealui_preferences_rels
  RENAME TO payload_preferences_rels;

COMMIT;
```

**Rollback Time**: < 10 seconds

#### Full Restore (If rollback fails)

```bash
# Restore from backup
pg_restore -h <host> -U <user> -d <database> -c backup_before_migration.dump
```

---

### Risk Assessment

#### High Risk Items

1. **Application Code References**
   - **Risk**: If code still references `payload_*` tables, application will break
   - **Mitigation**: Update ALL code references BEFORE migration
   - **Verification**: `grep -r "payload_locked_documents\|payload_preferences\|payload_migrations"`

2. **Raw SQL Queries**
   - **Risk**: Any raw SQL using old table names will fail
   - **Mitigation**: Audit all SQL queries, prefer ORM/query builder
   - **Verification**: Search codebase for `sql\`payload_`

3. **Database Type Mismatches**
   - **Risk**: TypeScript types won't match actual database schema
   - **Mitigation**: Regenerate types immediately after migration
   - **Verification**: `pnpm typecheck:all` after regeneration

4. **Foreign Key Constraints**
   - **Risk**: PostgreSQL handles this automatically, but verify
   - **Mitigation**: Test on staging first
   - **Verification**: Run FK verification queries

5. **Cached Queries/Views**
   - **Risk**: Views or materialized views may cache old names
   - **Mitigation**: Refresh/recreate views
   - **Verification**: `\dv` to list views

#### Medium Risk Items

1. **Third-party Tools**
   - Supabase Studio, Database GUI tools may cache schema
   - **Mitigation**: Refresh tools after migration

2. **Monitoring/Logging**
   - May reference old table names in alerts
   - **Mitigation**: Update monitoring configs

3. **Documentation**
   - Internal docs may reference old names
   - **Mitigation**: Update documentation in same PR

---

### Testing Plan

#### Development Environment Test

1. **Setup Test Database**
   ```bash
   # Create test Supabase instance
   supabase start
   ```

2. **Populate Test Data**
   ```sql
   -- Insert sample data into payload_* tables
   INSERT INTO payload_preferences (key, value) VALUES ('test', '{"key": "value"}');
   INSERT INTO payload_locked_documents (global_slug) VALUES ('test-slug');
   ```

3. **Execute Migration**
   - Run rename SQL
   - Verify data integrity

4. **Test Application**
   - Run all tests: `pnpm test`
   - Test CRUD operations on renamed tables
   - Verify foreign key relationships work

#### Staging Environment Test

1. Copy production schema to staging
2. Execute full migration procedure
3. Run full test suite
4. Load test application
5. Verify no performance degradation

---

### Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Pre-Migration Prep | 2-4 hours | Code updates, testing |
| Backup & Verification | 30 minutes | Database backup |
| Migration Execution | 10-30 minutes | Actual rename + verification |
| Post-Migration | 1-2 hours | Type regeneration, deployment |
| **Total Downtime** | **30-60 minutes** | Maintenance window |
| **Total Project Time** | **4-8 hours** | Including prep & verification |

---

### Alternative: Fresh Database for New Projects

**If starting fresh or data loss is acceptable:**

#### Development Workflow

```bash
# 1. Drop existing local database
supabase db reset

# 2. Update RevealUI config to use new collection names (already done)

# 3. Initialize RevealUI - it will create tables with correct names
# (assuming RevealUI uses collection slugs for table naming)

# 4. Regenerate database types
pnpm generate:neon-types
```

**Key Question**: Does RevealUI automatically create these tables with the correct names based on collection slugs?

**Answer**:

✅ RevealUI uses collection slugs (`revealui-locked-documents`) → converts to snake_case (`revealui_locked_documents`)
✅ Existing `payload_*` tables are **legacy from Payload CMS**
✅ New RevealUI installations will create `revealui_*` tables automatically
⚠️ **Production databases need migration** if they have existing `payload_*` tables

---

### Recommended Next Steps

1. **Immediate** (Today):
   - ✅ Audit codebase for `payload_*` table references
   - ✅ Determine if RevealUI creates these tables or they're legacy
   - ✅ Check table naming logic in RevealUI

2. **Short-term** (This Week):
   - Create migration SQL script
   - Test on development database
   - Update all code references
   - Prepare rollback plan

3. **Pre-Production** (Before Deploy):
   - Test migration on staging
   - Schedule maintenance window
   - Prepare team communication

4. **Production** (Scheduled):
   - Execute migration in maintenance window
   - Verify application functionality
   - Monitor for 24-48 hours

---

## Related Documentation

- [DATABASE.md](./DATABASE.md) - Complete database setup and types guide
- [CONTRACT_INTEGRATION_GUIDE.md](./CONTRACT_INTEGRATION_GUIDE.md) - Contract integration
- [Unified Backend Architecture](../architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System architecture

### External Resources

- [PostgreSQL ALTER TABLE Documentation](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Zero-Downtime Database Migrations](https://www.braintreepayments.com/blog/safe-operations-for-high-volume-postgresql/)

---

**Last Updated:** 2025-01-31
**Status:** Production-ready migration guide
