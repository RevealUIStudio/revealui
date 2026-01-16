# Next Steps: Completing PayloadCMS Migration

## ✅ Completed

1. **Removed all GraphQL references** (except rules forbidding it)
2. **Removed hardcoded environment values** from package.json scripts
3. **Fixed Supabase types generation** to load from .env files
4. **Updated scripts** to use environment variables exclusively
5. **Codebase migration complete** - all code uses RevealUI naming

## 🎯 Next Steps

### Step 1: Create Fresh Database

Since you're starting with a fresh database, you don't need migrations. Choose your provider:

#### Option A: Supabase (Current Setup)
```bash
# Your .env already has:
# SUPABASE_URL=https://erzpwtonzoyvvpplzxxd.supabase.co
# SUPABASE_PROJECT_ID=erzpwtonzoyvvpplzxxd
# SUPABASE_ACCESS_TOKEN=...

# Ensure you have the database connection string
# Add to .env:
SUPABASE_DATABASE_URI=postgresql://postgres:[password]@db.erzpwtonzoyvvpplzxxd.supabase.co:5432/postgres
# Or use POSTGRES_URL/DATABASE_URL pointing to Supabase
```

#### Option B: Neon Database
```bash
# Create new project at https://neon.tech
# Add to .env:
POSTGRES_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Step 2: Initialize RevealUI Database

RevealUI will automatically create `revealui_*` tables on first run:

```bash
# Option 1: Start dev server (will auto-initialize)
pnpm dev

# Option 2: Use initialization script
pnpm db:init

# Option 3: Use fresh DB setup script
pnpm db:fresh
```

**Required Environment Variables:**
```bash
# Admin user (for initial setup)
REVEALUI_ADMIN_EMAIL=admin@example.com
REVEALUI_ADMIN_PASSWORD=your-secure-password-12-chars-min

# Database connection (already in .env)
POSTGRES_URL=postgresql://...
# OR
DATABASE_URL=postgresql://...
# OR  
SUPABASE_DATABASE_URI=postgresql://...

# Required secrets
REVEALUI_SECRET=your-secret-key
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
```

### Step 3: Verify RevealUI Tables Created

After initialization, verify tables were created with RevealUI naming:

```bash
# Connect to your database and check:
# Should see: revealui_locked_documents, revealui_preferences, revealui_migrations
# Should NOT see: payload_* tables

# Or check via Supabase dashboard:
# https://supabase.com/dashboard/project/erzpwtonzoyvvpplzxxd/editor
```

### Step 4: Regenerate TypeScript Types

After RevealUI creates the tables, regenerate types to see `revealui_*` names:

```bash
# Regenerate Supabase types (will now show revealui_* tables)
pnpm generate:supabase-types

# Regenerate RevealUI CMS types
pnpm generate:revealui-types

# Regenerate Neon/Drizzle types
pnpm generate:neon-types
```

### Step 5: Clean Up PayloadCMS Dependencies

Remove orphaned PayloadCMS packages from lockfile:

```bash
# Regenerate lockfile (removes unused @payloadcms packages)
pnpm install --force

# Verify no PayloadCMS packages remain
pnpm list | grep payloadcms
# Should show no results
```

### Step 6: Update/Archive Migration Documentation

Since you're using a fresh database:

```bash
# Optional: Archive migration docs (they're for legacy databases)
# These docs are no longer needed for fresh setups:
# - docs/reference/database/DATABASE-MIGRATION-PLAN.md
# - docs/reference/database/FRESH-DATABASE-SETUP.md (keep - it's relevant!)
```

### Step 7: Verify Everything Works

```bash
# 1. Start dev server
pnpm dev

# 2. Access admin panel
# Open: http://localhost:4000/admin

# 3. Log in with admin credentials
# Email: [REVEALUI_ADMIN_EMAIL]
# Password: [REVEALUI_ADMIN_PASSWORD]

# 4. Verify collections load correctly
# Check: Users, Tenants, Pages, Posts, etc.

# 5. Verify no PayloadCMS references
grep -r "PayloadCMS\|payloadcms" packages/ apps/ --exclude-dir=node_modules
# Should only find documentation references, not code
```

## 🧪 Testing Checklist

- [ ] Database connection works
- [ ] RevealUI creates `revealui_*` tables (not `payload_*`)
- [ ] Admin user created successfully
- [ ] Can log in to admin panel
- [ ] Collections load and work correctly
- [ ] Type generation shows `revealui_*` in types
- [ ] No PayloadCMS packages in lockfile
- [ ] No hardcoded env values in package.json
- [ ] All scripts use environment variables

## 📝 Important Notes

1. **Fresh Database Approach**: Since you're starting fresh, you don't need table migrations - RevealUI will create tables with correct names automatically.

2. **Environment Variables**: All configuration now comes from `.env` files. No hardcoded values in scripts.

3. **System Tables**: RevealUI will create:
   - `revealui_locked_documents` (document locking)
   - `revealui_preferences` (user preferences)
   - `revealui_migrations` (migration tracking)
   - Collection tables (users, pages, posts, etc.)

4. **Admin User**: First admin user is created automatically on first run if `REVEALUI_ADMIN_EMAIL` and `REVEALUI_ADMIN_PASSWORD` are set.

## 🚨 If You Have Existing Data

If you have production data to preserve:

1. **Export data** from old `payload_*` tables
2. **Create fresh database** with RevealUI
3. **Import data** using RevealUI collections API
4. **Verify** data integrity

This is cleaner than migrating table names.

## ✅ Completion Criteria

Migration is complete when:
- ✅ Fresh database created
- ✅ RevealUI tables initialized (`revealui_*` naming)
- ✅ Types regenerated (show `revealui_*`)
- ✅ Admin user can log in
- ✅ All collections working
- ✅ No PayloadCMS dependencies
- ✅ No hardcoded env values

---

**You're ready to proceed!** Start with Step 1 (database setup).
