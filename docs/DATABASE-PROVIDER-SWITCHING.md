# Switching Database Providers

This guide shows how to switch between Neon, Supabase, and Vercel Postgres in RevealUI.

---

## Quick Switch

### Current Setup

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

### Provider Detection

The universal adapter automatically detects the provider from your connection string:

- **Neon**: Connection string contains `.neon.tech`
- **Supabase**: Connection string contains `.supabase.co`
- **Vercel Postgres**: `POSTGRES_URL` env var is set (or connection string contains `vercel`)

---

## Switch to Neon

### 1. Get Neon Connection String

```
postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
```

### 2. Update Environment

```bash
# .env.local
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
```

### 3. Install Dependencies

```bash
pnpm add @neondatabase/serverless
```

### 4. Update Config (Optional)

```typescript
db: universalPostgresAdapter({
  provider: 'neon', // Explicit (optional - auto-detected)
})
```

---

## Switch to Supabase

### 1. Get Supabase Connection String

**Pooling (Recommended):**
```
postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### 2. Update Environment

```bash
# .env.local
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# Optional: Supabase client credentials
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Install Dependencies

```bash
pnpm add pg @types/pg
```

### 4. Update Config (Optional)

```typescript
db: universalPostgresAdapter({
  provider: 'supabase', // Explicit (optional - auto-detected)
})
```

---

## Switch to Vercel Postgres

### 1. Create Vercel Postgres Database

In Vercel Dashboard → Storage → Create Database → Postgres

### 2. Environment Auto-Configured

Vercel automatically sets:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

### 3. Install Dependencies

```bash
pnpm add @vercel/postgres
```

### 4. Update Config (Optional)

```typescript
db: universalPostgresAdapter({
  provider: 'vercel', // Explicit (optional - auto-detected)
  envVar: 'POSTGRES_URL', // Default
})
```

---

## Migration Between Providers

### Data Export

```bash
# Export from current database
pg_dump $OLD_DATABASE_URL > backup.sql
```

### Data Import

```bash
# Import to new database
psql $NEW_DATABASE_URL < backup.sql
```

### Or Use Supabase CLI

```bash
# Export
supabase db dump -f backup.sql

# Import
supabase db reset -f backup.sql
```

---

## Provider-Specific Features

### Neon

- ✅ Serverless/edge functions
- ✅ Branching (copy database)
- ✅ Auto-scaling
- ⚠️ No built-in auth

### Supabase

- ✅ Full-featured backend
- ✅ Built-in auth
- ✅ Real-time subscriptions
- ✅ Storage
- ⚠️ Fixed connection limits

### Vercel Postgres

- ✅ Seamless Vercel integration
- ✅ Automatic environment setup
- ✅ Managed connections
- ⚠️ Vercel-only deployments

---

## Troubleshooting

### "Module not found"

Install provider-specific dependency:
```bash
# Neon
pnpm add @neondatabase/serverless

# Supabase
pnpm add pg @types/pg

# Vercel
pnpm add @vercel/postgres
```

### "Connection refused"

- Check IP allowlist (Supabase)
- Verify connection string format
- Ensure SSL is enabled: `?sslmode=require`

### Wrong provider detected

Explicitly set provider:
```typescript
db: universalPostgresAdapter({
  provider: 'neon', // Force specific provider
})
```