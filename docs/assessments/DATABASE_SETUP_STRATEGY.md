# Database Setup Strategy

**Date:** 2026-01-16  
**Status:** ✅ Fresh Setup Approach (Pre-Production)  
**Strategy:** Fresh schema setup → Migrations post-production

---

## Strategy Overview

### Pre-Production: Fresh Setup
- **Approach:** Run fresh schema setup scripts
- **No migrations:** Keep it simple during development
- **Idempotent:** Safe to run multiple times
- **Location:** `packages/db/migrations/supabase-vector-setup.sql` (schema file, not a migration)

### Post-Production: Migrations
- **When:** After production release, when adding new features
- **Approach:** Add proper migration system (Drizzle migrations or custom)
- **Versioning:** Track schema changes incrementally
- **Rollback:** Support rollback for production deployments

---

## Current Setup (Pre-Production)

### Vector Database (Supabase)

**Setup Script:** `packages/test/scripts/setup-vector-database.ts`

**Schema File:** `packages/db/migrations/supabase-vector-setup.sql`

**Usage:**
```bash
export $(grep -v '^#' .env | xargs)
pnpm test:memory:setup
```

**What it does:**
1. Checks if `pgvector` extension exists
2. Checks if `agent_memories` table exists
3. Runs fresh schema setup (creates everything from scratch)
4. Verifies setup

**Idempotent:** Uses `IF NOT EXISTS` clauses, safe to run multiple times

### REST Database (NeonDB)

**Current:** Schema defined in Drizzle schema files
- `packages/db/src/core/rest.ts` - REST schema
- `packages/db/src/core/index.ts` - Full schema

**Setup:** Handled by Drizzle schema generation (when needed)

---

## Why Fresh Setup for Pre-Production?

### Benefits
1. **Simplicity:** No migration tracking overhead
2. **Flexibility:** Easy to change schema during development
3. **Speed:** Faster setup for new environments
4. **Clarity:** Clear initial state

### When to Switch to Migrations
- ✅ After production release
- ✅ When you need to track schema changes
- ✅ When you need rollback capability
- ✅ When multiple environments need incremental updates

---

## Migration Strategy (Post-Production)

### Option 1: Drizzle Migrations
```bash
# Generate migration from schema changes
pnpm --filter @revealui/db db:generate

# Apply migrations
pnpm --filter @revealui/db db:migrate
```

### Option 2: Custom Migration System
- Track migrations in `packages/db/migrations/` directory
- Version migrations (e.g., `001_initial_schema.sql`, `002_add_feature.sql`)
- Run migrations in order
- Track applied migrations in database

### Option 3: Supabase Migrations
- Use Supabase's migration system
- Store migrations in Supabase dashboard
- Apply via Supabase CLI or dashboard

---

## File Organization

### Current Structure
```
packages/db/
├── migrations/
│   └── supabase-vector-setup.sql  # Fresh schema (not a migration)
├── src/
│   ├── core/
│   │   ├── rest.ts               # REST schema
│   │   └── vector.ts             # Vector schema
│   └── client/
│       └── index.ts               # Database client
```

### Post-Production Structure (Future)
```
packages/db/
├── migrations/
│   ├── supabase-vector-setup.sql  # Initial schema (reference)
│   ├── supabase/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_feature.sql
│   │   └── ...
│   └── neon/
│       ├── 001_initial_schema.sql
│       └── ...
├── src/
│   └── ...
```

---

## Setup Commands

### Vector Database (Supabase)
```bash
# Fresh setup
pnpm test:memory:setup

# Verify setup
pnpm test:memory:verify
```

### REST Database (NeonDB)
```bash
# Schema generation (if needed)
pnpm --filter @revealui/db db:generate

# Push schema (if needed)
pnpm --filter @revealui/db db:push
```

---

## Best Practices

### Pre-Production
- ✅ Use fresh setup scripts
- ✅ Keep schema files simple and clear
- ✅ Document schema in SQL comments
- ✅ Make setup idempotent

### Post-Production
- ✅ Use proper migration system
- ✅ Version all migrations
- ✅ Test migrations on staging first
- ✅ Support rollback
- ✅ Document migration process

---

## Migration Checklist (When Ready)

When switching to migrations post-production:

- [ ] Choose migration system (Drizzle, custom, or Supabase)
- [ ] Set up migration tracking
- [ ] Create initial migration from current schema
- [ ] Test migration on staging
- [ ] Document migration process
- [ ] Set up CI/CD for migrations
- [ ] Create rollback procedures

---

**Last Updated:** 2026-01-16  
**Status:** ✅ Fresh Setup Active | 📋 Migration Strategy Documented
