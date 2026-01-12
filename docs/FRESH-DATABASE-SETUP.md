# Fresh Database Setup Guide

This guide covers setting up a fresh RevealUI database on **Neon**, **Supabase**, and **Vercel Postgres**.

> **Why Fresh Database?**
> - RevealUI will automatically create tables with correct names (`revealui_*` instead of legacy `payload_*`)
> - No migration complexity
> - Clean slate for new projects
> - Zero downtime approach

---

## Quick Start

### 1. Choose Your Database Provider

RevealUI supports three PostgreSQL providers:

| Provider | Best For | Pricing | Connection Limit |
|----------|----------|---------|------------------|
| **Neon** | Serverless, branching, edge functions | Free tier, pay-as-you-go | Auto-scaling |
| **Supabase** | Full-featured backend, auth included | Free tier, fixed plans | Connection pooling |
| **Vercel Postgres** | Vercel deployments, seamless integration | Free tier, fixed plans | Managed by Vercel |

### 2. Universal Adapter Setup

RevealUI uses a **universal PostgreSQL adapter** that automatically detects your provider:

```typescript
// apps/cms/revealui.config.ts
import { universalPostgresAdapter } from '@revealui/core/database'

export default buildConfig({
  db: universalPostgresAdapter({
    // Auto-detected from DATABASE_URL, POSTGRES_URL, or SUPABASE_DATABASE_URI
    // Or explicitly set:
    connectionString: process.env.DATABASE_URL,
    provider: 'neon', // Optional: 'neon' | 'supabase' | 'vercel'
  }),
  // ... rest of config
})
```

---

## Setup: Neon Database

### Step 1: Create Neon Database

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy your connection string:
   ```
   postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

### Step 2: Configure Environment

```bash
# .env.local or .env.production
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Or explicitly:
```bash
POSTGRES_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Step 3: Install Dependencies

Neon uses `@neondatabase/serverless` (already included if using `@revealui/db`):

```bash
pnpm add @neondatabase/serverless
```

### Step 4: Update RevealUI Config

```typescript
// apps/cms/revealui.config.ts
import { universalPostgresAdapter } from '@revealui/core/database'

export default buildConfig({
  db: universalPostgresAdapter({
    provider: 'neon', // Optional: auto-detected from connection string
  }),
  // ... rest of config
})
```

### Step 5: Initialize Database

RevealUI will automatically create tables on first run:

```bash
# Start development server
pnpm dev

# Or run initialization script
pnpm db:init
```

**Expected Tables Created:**
- `revealui_locked_documents`
- `revealui_locked_documents_rels`
- `revealui_preferences`
- `revealui_preferences_rels`
- `revealui_migrations`
- All your collection tables (users, pages, posts, etc.)

---

## Setup: Supabase

### Step 1: Create Supabase Project

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for database to be provisioned (1-2 minutes)

### Step 2: Get Database Connection String

**Option A: Connection Pooling (Recommended for Serverless)**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
```

**Option B: Direct Connection**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require
```

Get from: **Project Settings → Database → Connection String → Connection Pooling**

### Step 3: Configure Environment

```bash
# .env.local or .env.production

# Database connection (use pooling URL for serverless)
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# Or use Supabase-specific env var
SUPABASE_DATABASE_URI=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# Supabase API credentials (for Supabase client features)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Install Dependencies

```bash
pnpm add pg @types/pg
```

### Step 5: Update RevealUI Config

```typescript
// apps/cms/revealui.config.ts
import { universalPostgresAdapter } from '@revealui/core/database'

export default buildConfig({
  db: universalPostgresAdapter({
    provider: 'supabase', // Optional: auto-detected from connection string
  }),
  // ... rest of config
})
```

### Step 6: Initialize Database

```bash
pnpm dev
```

Or use Supabase migrations (optional):

```bash
# If using Supabase CLI
supabase db reset  # For local development
```

### Step 7: Generate Supabase Types (Optional)

If using Supabase client features:

```bash
# Generate types from Supabase schema
supabase gen types typescript --project-id [PROJECT_REF] > packages/services/src/supabase/types.ts
```

---

## Setup: Vercel Postgres

### Step 1: Create Vercel Postgres Database

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to: **Storage → Create Database → Postgres**
3. Create database in your project
4. Vercel automatically sets `POSTGRES_URL` environment variable

### Step 2: Configure Environment

Vercel automatically configures:
- `POSTGRES_URL` - Connection string
- `POSTGRES_PRISMA_URL` - Prisma-compatible connection string
- `POSTGRES_URL_NON_POOLING` - Direct connection (for migrations)

**Local Development:**
```bash
# .env.local
POSTGRES_URL=postgres://user:pass@host:5432/dbname
```

### Step 3: Install Dependencies

```bash
pnpm add @vercel/postgres
```

### Step 4: Update RevealUI Config

```typescript
// apps/cms/revealui.config.ts
import { universalPostgresAdapter } from '@revealui/core/database'

export default buildConfig({
  db: universalPostgresAdapter({
    provider: 'vercel', // Optional: auto-detected from POSTGRES_URL
    envVar: 'POSTGRES_URL', // Default
  }),
  // ... rest of config
})
```

### Step 5: Initialize Database

```bash
# Development
pnpm dev

# Production (Vercel automatically runs on deploy)
vercel deploy
```

---

## Database Initialization

### Automatic Initialization

RevealUI automatically creates required tables on first connection:

1. **System Tables** (created automatically):
   - `revealui_locked_documents`
   - `revealui_locked_documents_rels`
   - `revealui_preferences`
   - `revealui_preferences_rels`
   - `revealui_migrations`

2. **Collection Tables** (created from your config):
   - One table per collection in your `revealui.config.ts`
   - Junction tables (`*_rels`) for relationships

### Manual Initialization Script

Create a script to verify/initialize database:

```typescript
// scripts/init-database.ts
import { universalPostgresAdapter } from '@revealui/core/database'
import config from '../apps/cms/revealui.config'

async function initDatabase() {
  const config = await config
  const db = config.db
  
  try {
    await db.connect()
    console.log('✅ Database connected successfully')
    
    // Test query
    const result = await db.query('SELECT NOW() as time')
    console.log('✅ Database query successful:', result.rows[0])
    
    console.log('✅ Database initialized')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

initDatabase()
```

Run it:
```bash
pnpm tsx scripts/init-database.ts
```

---

## Verification Checklist

After setup, verify your database:

### 1. Check Connection

```bash
# Test connection
pnpm db:test
```

### 2. Verify Tables Created

Connect to your database and run:

```sql
-- Check system tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE 'revealui%'
ORDER BY tablename;

-- Expected output:
-- revealui_locked_documents
-- revealui_locked_documents_rels
-- revealui_migrations
-- revealui_preferences
-- revealui_preferences_rels
```

### 3. Verify Collection Tables

```sql
-- Check collection tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename NOT LIKE 'revealui%'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

-- Should show: users, pages, posts, etc. (from your collections)
```

### 4. Test Application

```bash
# Start dev server
pnpm dev

# Visit admin panel
open http://localhost:4000/admin

# Create first user
# Should work without errors
```

---

## Environment Variables Summary

### Neon

```bash
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
```

### Supabase

```bash
DATABASE_URL=postgresql://postgres.xxx:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Vercel Postgres

```bash
POSTGRES_URL=postgres://user:pass@host:5432/dbname
# (Auto-configured by Vercel)
```

---

## Troubleshooting

### Connection Issues

**Problem**: "Connection refused" or timeout

**Solutions**:
- ✅ Verify connection string is correct
- ✅ Check IP allowlist (Supabase/Vercel may require IP whitelisting)
- ✅ Ensure SSL is enabled: `?sslmode=require`
- ✅ For Supabase, use connection pooling URL for serverless

### Table Creation Issues

**Problem**: Tables not created automatically

**Solutions**:
- ✅ Check database permissions (user needs CREATE TABLE)
- ✅ Verify RevealUI config is loading correctly
- ✅ Check application logs for errors
- ✅ Run initialization script manually

### Provider Detection Issues

**Problem**: Wrong provider detected

**Solutions**:
- ✅ Explicitly set `provider: 'neon' | 'supabase' | 'vercel'` in config
- ✅ Check connection string format
- ✅ Verify environment variable is set correctly

### Missing Dependencies

**Problem**: Module not found errors

**Solutions**:
```bash
# Install provider-specific dependencies

# For Neon
pnpm add @neondatabase/serverless

# For Supabase
pnpm add pg @types/pg

# For Vercel Postgres
pnpm add @vercel/postgres
```

---

## Migration from Payload Tables

If you have existing `payload_*` tables and want to start fresh:

### Option 1: Drop and Recreate (Development)

```sql
-- WARNING: This deletes all data!
DROP TABLE IF EXISTS payload_locked_documents CASCADE;
DROP TABLE IF EXISTS payload_locked_documents_rels CASCADE;
DROP TABLE IF EXISTS payload_preferences CASCADE;
DROP TABLE IF EXISTS payload_preferences_rels CASCADE;
DROP TABLE IF EXISTS payload_migrations CASCADE;

-- Then restart RevealUI - it will create revealui_* tables
```

### Option 2: Rename Tables (Production)

See [DATABASE-MIGRATION-PLAN.md](./DATABASE-MIGRATION-PLAN.md) for production migration guide.

---

## Next Steps

1. ✅ Database configured and connected
2. ✅ Tables created automatically
3. ✅ Create first admin user
4. ✅ Configure collections and globals
5. ✅ Deploy to production

---

## Additional Resources

- [Drizzle Guide](./DRIZZLE-GUIDE.md) - Database adapter documentation
- [Neon Documentation](https://neon.tech/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres)