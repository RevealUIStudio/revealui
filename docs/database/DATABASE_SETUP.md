# RevealUI Database Setup Guide

**Last Updated:** 2025-01-30
**Supported Providers:** Neon, Supabase, Vercel Postgres

---

## Overview

This guide covers setting up a RevealUI database using **Neon**, **Supabase**, or **Vercel Postgres**. RevealUI uses a universal PostgreSQL adapter that automatically detects your provider and handles connection management.

### Why Fresh Database?

- ✅ RevealUI automatically creates tables with correct names (`revealui_*` instead of legacy `payload_*`)
- ✅ No migration complexity
- ✅ Clean slate for new projects
- ✅ Zero downtime approach

---

## Quick Start

### 1. Choose Your Database Provider

| Provider | Best For | Pricing | Connection Limit | Connection String Format |
|----------|----------|---------|------------------|--------------------------|
| **Neon** | Serverless, branching, edge functions | Free tier, pay-as-you-go | Auto-scaling | `postgresql://...@ep-xxx.neon.tech/...` |
| **Supabase** | Full-featured backend, auth included | Free tier, fixed plans | Connection pooling | `postgresql://...@xxx.supabase.co/...` |
| **Vercel Postgres** | Vercel deployments, seamless integration | Free tier, fixed plans | Managed by Vercel | `postgres://...` (auto-configured) |

**Note:** Vercel Postgres is deprecated. Prefer Neon for new projects.

### 2. Set Environment Variable

```bash
# .env.local
DATABASE_URL=your_connection_string_here

# Or use provider-specific variable names
POSTGRES_URL=... # Neon/Vercel
SUPABASE_DATABASE_URI=... # Supabase
```

### 3. Update RevealUI Config

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

### 4. Initialize Database

```bash
# Verify connection and check tables
pnpm db:init

# Start development server (tables created automatically)
pnpm dev

# Visit admin panel
# http://localhost:4000/admin
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

```bash
# Start development server
pnpm dev

# Or run initialization script
pnpm db:init
```

RevealUI will automatically create tables on first run.

---

## Setup: Supabase Database

### Step 1: Create Supabase Project

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Settings** → **Database**
4. Copy your connection string (use **Session mode** for serverless):
   ```
   postgresql://postgres:password@xxx.supabase.co:5432/postgres
   ```

### Step 2: Configure Environment

```bash
# .env.local
DATABASE_URL=postgresql://postgres:password@xxx.supabase.co:5432/postgres
```

Or use Supabase-specific variable:
```bash
SUPABASE_DATABASE_URI=postgresql://postgres:password@xxx.supabase.co:5432/postgres
```

### Step 3: Configure IP Allowlist

**Important:** Supabase requires IP allowlist configuration for external connections.

1. Go to **Project Settings** → **Database** → **Network**
2. Add your development machine's IP address
3. For production, add your server's IP or use connection pooling

**For serverless deployments:**
- Use Supabase's connection pooling (port 6543)
- Enable **Session mode** for better compatibility

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
    provider: 'supabase', // Optional: auto-detected
  }),
  // ... rest of config
})
```

### Step 6: Initialize Database

```bash
pnpm dev
```

Tables will be created automatically.

---

## Setup: Vercel Postgres

**Note:** Vercel Postgres is deprecated. Use Neon for new projects.

### Step 1: Create Vercel Postgres Database

1. Go to your Vercel project
2. Navigate to **Storage** tab
3. Create a new Postgres database
4. Copy connection string

### Step 2: Configure Environment

Vercel automatically sets environment variables:
- `POSTGRES_URL` - Connection string
- `POSTGRES_PRISMA_URL` - Prisma-specific URL
- `POSTGRES_URL_NON_POOLING` - Direct connection URL

For local development:
```bash
# .env.local
DATABASE_URL=$POSTGRES_URL
```

### Step 3: Install Dependencies

```bash
pnpm add @neondatabase/serverless pg
```

Note: Vercel Postgres uses Neon under the hood, so we use `@neondatabase/serverless`.

### Step 4: Update RevealUI Config

```typescript
// apps/cms/revealui.config.ts
import { universalPostgresAdapter } from '@revealui/core/database'

export default buildConfig({
  db: universalPostgresAdapter({
    provider: 'vercel', // Or let it auto-detect
  }),
  // ... rest of config
})
```

### Step 5: Initialize Database

```bash
pnpm dev
```

---

## What Gets Created Automatically

When RevealUI starts, it automatically creates:

### System Tables

- ✅ `revealui_locked_documents` - Document locking for concurrent editing
- ✅ `revealui_locked_documents_rels` - Relationship junctions
- ✅ `revealui_preferences` - User/system preferences
- ✅ `revealui_preferences_rels` - Preference relationships
- ✅ `revealui_migrations` - Migration tracking

### Collection Tables

- ✅ One table per collection in your config
- ✅ Junction tables (`*_rels`) for relationships
- ✅ All with correct `revealui_*` naming (not legacy `payload_*`)

---

## Universal Adapter Features

The universal PostgreSQL adapter (`packages/core/src/cms/database/universal-postgres.ts`) provides:

- ✅ **Auto-detection:** Automatically detects provider from connection string
- ✅ **Parameterized Queries:** Handles parameter formatting for all providers
- ✅ **Connection Pooling:** Supports connection pooling where available
- ✅ **Fallback Mechanisms:** Graceful degradation for compatibility
- ✅ **Type Safety:** Full TypeScript support

---

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to database

**Solutions:**
- Check connection string format
- Verify IP allowlist (for Supabase)
- Ensure SSL is enabled: `?sslmode=require`
- Check database permissions
- Verify network connectivity

### Tables Not Created

**Problem:** RevealUI doesn't create tables automatically

**Solutions:**
- Check database permissions (user must have CREATE TABLE permission)
- Verify RevealUI config loads correctly
- Check application logs for errors
- Try running `pnpm db:init` manually

### Wrong Provider Detected

**Problem:** Universal adapter detects wrong provider

**Solution:**
Explicitly set provider in config:
```typescript
db: universalPostgresAdapter({
  provider: 'neon', // Force specific provider
})
```

### Connection Pool Exhausted

**Problem:** "Too many connections" error

**Solutions:**
- Use connection pooling (Supabase port 6543)
- Reduce concurrent connections
- Use Neon's auto-scaling connections
- Configure connection limits in adapter

### SSL/TLS Errors

**Problem:** SSL connection errors

**Solution:**
Add SSL parameters to connection string:
```
postgresql://...?sslmode=require
```

For Neon:
```
postgresql://...?sslmode=require&sslrootcert=/path/to/cert.pem
```

---

## Key Benefits

✅ **No Migration Needed** - Fresh databases create correct table names automatically
✅ **Universal Adapter** - One adapter works with all three providers
✅ **Auto-Detection** - Provider detected automatically from connection string
✅ **Type Safety** - Full TypeScript support
⚠️ **Production Capability** - Designed for connection pooling, SSL, and edge functions (Pending verification)

---

## Next Steps

1. ✅ Choose your provider (Neon, Supabase, or Vercel Postgres)
2. ✅ Get connection string from provider dashboard
3. ✅ Set `DATABASE_URL` environment variable
4. ✅ Run `pnpm db:init` to verify connection
5. ✅ Start development: `pnpm dev`
6. ✅ Visit `http://localhost:4000/admin`
7. ✅ Create your first admin user

---

## Related Documentation

- [DATABASE_TYPES.md](./DATABASE_TYPES.md) - TypeScript type generation and usage
- [DATABASE_PROVIDER_SWITCHING.md](./DATABASE_PROVIDER_SWITCHING.md) - How to switch providers
- [DATABASE_MIGRATION_PLAN.md](./DATABASE_MIGRATION_PLAN.md) - Migrating existing data
- [CONTRACT_INTEGRATION_GUIDE.md](./CONTRACT_INTEGRATION_GUIDE.md) - Contract integration
- [providers/electric.md](./providers/electric.md) - ElectricSQL migrations
- [providers/supabase-networking.md](./providers/supabase-networking.md) - Supabase IPv4 configuration

---

**Last Updated:** 2025-01-30
**Status:** Production-ready with caveats (see troubleshooting)
