# RevealUI CI/CD Deployment Guide

**Last Updated**: January 2, 2026  
**Status**: Production Ready

---

## Overview

This guide covers deploying RevealUI to production using Vercel with NeonDB Postgres. RevealUI uses its own native database adapters and Lexical rich text editor.

## Prerequisites

- NeonDB Postgres database
- Vercel account (for deployment)
- GitHub repository (for CI/CD)

---

## Required Environment Variables

### Core Variables (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `REVEALUI_SECRET` | Encryption key for JWT/sessions (32+ chars) | `your-32-character-secret-minimum` |
| `POSTGRES_URL` | NeonDB connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `REVEALUI_PUBLIC_SERVER_URL` | Public URL of the CMS | `https://cms.yourdomain.com` |

### Storage (Required for Media)

| Variable | Description | Example |
|----------|-------------|---------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | `vercel_blob_rw_xxx` |

### Stripe (Required for Payments)

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_xxx` or `sk_test_xxx` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | `whsec_xxx` |

### Supabase Client (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `eyJ...` |

### Monitoring (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry error tracking DSN | `https://xxx@sentry.io/xxx` |

---

## NeonDB Setup

### 1. Create NeonDB Database

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard

### 2. Connection String Format

```
postgresql://[user]:[password]@[endpoint-host]/[database]?sslmode=require
```

**Example:**
```
postgresql://neondb_owner:npg_xxx@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### 3. Create Database Tables (Drizzle ORM)

RevealUI uses Drizzle ORM with NeonDB. The schema is defined in `@revealui/db`.

**Option A: Push schema directly (recommended)**

```bash
cd packages/db
DATABASE_URL="your-neondb-url" pnpm db:push
```

**Option B: Generate and run migrations**

```bash
cd packages/db
DATABASE_URL="your-neondb-url" pnpm db:generate
DATABASE_URL="your-neondb-url" pnpm db:migrate
```

**Option C: Run raw SQL**

If you prefer raw SQL, use this in your NeonDB console:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  roles TEXT[] DEFAULT ARRAY['user'],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Pages table
CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  slug VARCHAR(255) UNIQUE,
  hero JSONB,
  layout JSONB,
  meta JSONB,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  slug VARCHAR(255) UNIQUE,
  content JSONB,
  excerpt TEXT,
  published BOOLEAN DEFAULT false,
  publish_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Media table
CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255),
  mime_type VARCHAR(100),
  filesize INTEGER,
  url VARCHAR(500),
  alt VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Global: Header
CREATE TABLE IF NOT EXISTS global_header (
  id SERIAL PRIMARY KEY,
  nav_items JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Global: Footer  
CREATE TABLE IF NOT EXISTS global_footer (
  id SERIAL PRIMARY KEY,
  columns JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Global: Settings
CREATE TABLE IF NOT EXISTS global_settings (
  id SERIAL PRIMARY KEY,
  site_name VARCHAR(255),
  site_description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default globals
INSERT INTO global_header (nav_items) VALUES ('[]') ON CONFLICT DO NOTHING;
INSERT INTO global_footer (columns) VALUES ('[]') ON CONFLICT DO NOTHING;
INSERT INTO global_settings (site_name) VALUES ('RevealUI') ON CONFLICT DO NOTHING;
```

---

## Vercel Deployment

### 1. Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Select the `apps/cms` directory as root

### 2. Configure Build Settings

**Framework Preset:** Next.js

**Build Command:**
```bash
pnpm run vercel-build
```

**Output Directory:** `.next`

**Install Command:**
```bash
pnpm install
```

### 3. Add Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```env
# Required
REVEALUI_SECRET=your-32-character-secret-minimum
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require
REVEALUI_PUBLIC_SERVER_URL=https://your-project.vercel.app

# Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Optional
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 4. Deploy

Click "Deploy" - Vercel will build and deploy automatically.

---

## GitHub Actions CI/CD

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
          
      - uses: actions/setup-node@v4
        with:
          node-version: '24.12.0'
          cache: 'pnpm'
          
      - run: pnpm install
      
      - name: Run Tests
        run: pnpm test
        
      - name: Type Check
        run: pnpm typecheck

  deploy-preview:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Vercel CLI
        run: npm install -g vercel
        
      - name: Deploy Preview
        run: vercel deploy --token=${{ secrets.VERCEL_TOKEN }}

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Vercel CLI
        run: npm install -g vercel
        
      - name: Deploy Production
        run: vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### GitHub Secrets Required

Add these secrets in GitHub → Settings → Secrets and Variables → Actions:

- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - From Vercel project settings
- `VERCEL_PROJECT_ID` - From Vercel project settings

---

## Local Development

### 1. Copy Environment Template

```bash
cp .env.template .env.development.local
```

### 2. Configure Local Variables

```env
# Local development
REVEALUI_SECRET=dev-secret-32-chars-minimum-ok
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000

# Use your NeonDB for local dev too
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require

# Or use local SQLite (no POSTGRES_URL = SQLite fallback)
# Note: SQLite requires native bindings

# Storage - still need Vercel Blob for media
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# Stripe test keys
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 3. Start Development Server

```bash
cd apps/cms
pnpm dev
```

Visit `http://localhost:4000/admin`

---

## Build Process

The CMS build uses these fallback environment variables when not set:

```bash
# In package.json vercel-build script
REVEALUI_SECRET=${REVEALUI_SECRET:-dev-secret-for-build-only}
POSTGRES_URL=${POSTGRES_URL:-postgres://build:build@localhost:5432/build}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-sk_test_build}
```

**Important:** These fallbacks are only for build-time compilation. Production deployments MUST have real values set in Vercel environment variables.

---

## Troubleshooting

### Build Fails: "relation does not exist"

**Cause:** Database tables haven't been created.

**Solution:** Run the SQL migration script in your NeonDB console.

### Build Fails: "REVEALUI_SECRET is not set"

**Cause:** Missing required environment variable.

**Solution:** Add `REVEALUI_SECRET` to Vercel environment variables.

### Media Upload Fails

**Cause:** Missing or invalid Blob storage token.

**Solution:** 
1. Go to Vercel → Storage → Blob
2. Create a blob store
3. Generate Read/Write token
4. Add as `BLOB_READ_WRITE_TOKEN`

### Database Connection Timeout

**Cause:** Network issues or incorrect connection string.

**Solution:**
1. Verify connection string format
2. Ensure `?sslmode=require` is included
3. Check NeonDB dashboard for the correct endpoint

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel Edge                           │
├─────────────────────────────────────────────────────────┤
│  apps/cms (Next.js 16)                                   │
│  ├── /admin/* - RevealUI Admin Panel                    │
│  ├── /api/* - REST API endpoints                        │
│  └── /* - Frontend pages (SSR/SSG)                      │
├─────────────────────────────────────────────────────────┤
│  @revealui/core                                           │
│  ├── Native database adapters (Postgres, SQLite)        │
│  ├── Lexical rich text editor (vanilla)                 │
│  ├── Auth system                                         │
│  └── Plugins (form-builder, nested-docs, redirects)     │
├─────────────────────────────────────────────────────────┤
│  External Services                                       │
│  ├── NeonDB (Postgres) - Primary database               │
│  ├── Vercel Blob - Media storage                        │
│  ├── Stripe - Payments                                   │
│  └── Supabase (optional) - Additional features          │
└─────────────────────────────────────────────────────────┘
```

---

## Security Checklist

- [ ] `REVEALUI_SECRET` is 32+ characters
- [ ] `REVEALUI_SECRET` is unique per environment
- [ ] Stripe uses live keys in production
- [ ] Database connection uses SSL (`sslmode=require`)
- [ ] CORS origins properly configured
- [ ] Admin credentials not committed to repo

## Related Documentation

- [Deployment Runbook](../guides/deployment/DEPLOYMENT-RUNBOOK.md) - Complete deployment guide
- [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md) - Configuration reference
- [Environment Variables Reference](./ENV-VARIABLES-REFERENCE.md) - Quick reference
- [Fresh Database Setup](../reference/database/FRESH-DATABASE-SETUP.md) - Database setup
- [Rollback Procedure](./ROLLBACK-PROCEDURE.md) - Emergency rollback steps
- [Monitoring Setup](./MONITORING_SETUP.md) - Monitoring configuration
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../TASKS.md) - Find docs by task

---

**Status:** Production Ready  
**Last Verified:** January 2, 2026
