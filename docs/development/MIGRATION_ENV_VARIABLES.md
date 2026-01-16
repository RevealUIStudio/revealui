# Environment Variable Migration Guide

**Date:** January 2026  
**Purpose:** Migrate from direct `process.env` accesses to centralized `@revealui/config`

---

## Overview

This guide helps migrate from direct `process.env` accesses to the centralized, type-safe configuration system in `@revealui/config`.

**Why Migrate?**
- ✅ Type-safe access to environment variables
- ✅ Runtime validation with Zod schemas
- ✅ Fail-fast on missing required variables
- ✅ Centralized configuration management
- ✅ Better developer experience (autocomplete, type checking)

---

## Current State

- **455 direct `process.env` accesses** across 163 files
- Centralized config exists in `@revealui/config` but not used everywhere
- No validation for missing or invalid environment variables

---

## Migration Steps

### Step 1: Import the Config

Replace:
```typescript
const serverURL = process.env.REVEALUI_PUBLIC_SERVER_URL || ''
```

With:
```typescript
import config from '@revealui/config'

const serverURL = config.reveal.publicServerURL
```

### Step 2: Use Type-Safe Access

The config object provides type-safe access to all environment variables:

```typescript
import config from '@revealui/config'

// Database
const dbUrl = config.database.url

// Stripe
const stripeKey = config.stripe.secretKey

// Storage
const blobToken = config.storage.readWriteToken

// RevealUI
const serverURL = config.reveal.publicServerURL
const secret = config.reveal.secret

// Optional (Supabase, Sentry, etc.)
const supabaseUrl = config.optional.supabase?.url
```

### Step 3: Handle Missing Values

The config validates at runtime, so missing required variables will throw errors. For optional variables:

```typescript
import config from '@revealui/config'

// Optional variables return undefined if not set
const supabaseUrl = config.optional.supabase?.url
if (supabaseUrl) {
  // Use supabaseUrl
}
```

---

## Common Migration Patterns

### Pattern 1: Simple Variable Access

**Before:**
```typescript
const serverURL = process.env.REVEALUI_PUBLIC_SERVER_URL || 'http://localhost:4000'
```

**After:**
```typescript
import config from '@revealui/config'
const serverURL = config.reveal.publicServerURL
```

### Pattern 2: With Fallback

**Before:**
```typescript
const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || ''
```

**After:**
```typescript
import config from '@revealui/config'
const dbUrl = config.database.url // Handles POSTGRES_URL and DATABASE_URL fallback
```

### Pattern 3: Optional Variables

**Before:**
```typescript
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
if (sentryDsn) {
  // Use sentryDsn
}
```

**After:**
```typescript
import config from '@revealui/config'
const sentryDsn = config.optional.sentry?.dsn
if (sentryDsn) {
  // Use sentryDsn
}
```

### Pattern 4: Boolean Flags

**Before:**
```typescript
const isProduction = process.env.NODE_ENV === 'production'
```

**After:**
```typescript
import config from '@revealui/config'
const isProduction = config.env.NODE_ENV === 'production'
// Or use the environment detection utility
import { detectEnvironment } from '@revealui/config'
const env = detectEnvironment() // 'development' | 'production' | 'test'
```

---

## Config Structure

The config object has the following structure:

```typescript
interface Config {
  database: {
    url: string
    // ... other database config
  }
  stripe: {
    secretKey: string
    publishableKey: string
    webhookSecret: string
    // ... other Stripe config
  }
  storage: {
    readWriteToken: string
    // ... other storage config
  }
  reveal: {
    secret: string
    publicServerURL: string
    // ... other RevealUI config
  }
  optional: {
    supabase?: {
      url?: string
      anonKey?: string
      // ... other Supabase config
    }
    sentry?: {
      dsn?: string
      // ... other Sentry config
    }
    // ... other optional services
  }
  env: {
    NODE_ENV: string
    // ... raw env access (for edge cases)
  }
}
```

---

## Migration Priority

### P0 - Critical (Fix First)
1. **Authentication & Security**
   - `REVEALUI_SECRET`
   - `REVEALUI_PUBLIC_SERVER_URL`
   - Auth-related env vars

2. **Database**
   - `POSTGRES_URL` / `DATABASE_URL`
   - Database connection strings

3. **API Routes**
   - All route handlers using `process.env`

### P1 - High Priority
4. **Stripe Integration**
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`

5. **Storage**
   - `BLOB_READ_WRITE_TOKEN`

### P2 - Medium Priority
6. **Optional Services**
   - Supabase, Sentry, ElectricSQL configs

7. **Build Scripts**
   - Build-time environment variables

### P3 - Low Priority
8. **Test Files**
   - Test-specific environment variables

---

## Finding Files to Migrate

### Search for Direct process.env Access

```bash
# Find all files with process.env
grep -r "process\.env\." --include="*.ts" --include="*.tsx" apps/ packages/

# Find specific variable
grep -r "process\.env\.REVEALUI_SECRET" --include="*.ts" --include="*.tsx"
```

### Common Files to Migrate

**High Priority:**
- `apps/cms/src/app/api/**/*.ts` - API routes
- `packages/auth/src/**/*.ts` - Auth package
- `packages/revealui/src/core/**/*.ts` - Core framework
- `packages/services/src/**/*.ts` - Services

**Medium Priority:**
- `apps/cms/src/lib/**/*.ts` - CMS utilities
- `packages/db/src/**/*.ts` - Database package

**Low Priority:**
- `**/__tests__/**/*.ts` - Test files
- `scripts/**/*.ts` - Scripts (may need special handling)

---

## Validation

The config validates environment variables at runtime using Zod schemas. If a required variable is missing or invalid, it will throw a clear error:

```
Environment validation failed:
  Missing required variable: REVEALUI_SECRET
  Invalid format for REVEALUI_PUBLIC_SERVER_URL: must start with http:// or https://
```

**Benefits:**
- Fail-fast in development (catch issues early)
- Clear error messages
- Type safety

---

## Build-Time Considerations

The config package handles build-time scenarios:

- During Next.js builds, lenient validation is used
- At runtime, full validation is required
- Set `SKIP_ENV_VALIDATION=true` only during builds (not at runtime)

---

## Testing

After migration, test that:
1. ✅ Application starts without errors
2. ✅ Environment variables are correctly accessed
3. ✅ Missing required variables throw clear errors
4. ✅ Optional variables work correctly when not set

---

## Rollback Plan

If issues arise:
1. Revert the specific file changes
2. Use direct `process.env` access temporarily
3. File an issue with migration problems
4. Fix the config package if needed

---

## Examples

### Example 1: API Route

**Before:**
```typescript
// apps/cms/src/app/api/health/route.ts
export async function GET() {
  const serverURL = process.env.REVEALUI_PUBLIC_SERVER_URL || 'http://localhost:4000'
  return Response.json({ serverURL })
}
```

**After:**
```typescript
// apps/cms/src/app/api/health/route.ts
import config from '@revealui/config'

export async function GET() {
  return Response.json({ serverURL: config.reveal.publicServerURL })
}
```

### Example 2: Database Connection

**Before:**
```typescript
// packages/db/src/client/index.ts
export function createClient(config: DatabaseConfig) {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || ''
  const sql = neon(connectionString)
  // ...
}
```

**After:**
```typescript
// packages/db/src/client/index.ts
import config from '@revealui/config'

export function createClient() {
  const sql = neon(config.database.url)
  // ...
}
```

### Example 3: Stripe Integration

**Before:**
```typescript
// packages/services/src/core/stripe/stripeClient.ts
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')
```

**After:**
```typescript
// packages/services/src/core/stripe/stripeClient.ts
import config from '@revealui/config'

const stripe = new Stripe(config.stripe.secretKey)
```

---

## Checklist

When migrating a file:

- [ ] Import `config` from `@revealui/config`
- [ ] Replace `process.env.*` with `config.*`
- [ ] Remove fallback values (config handles validation)
- [ ] Update type annotations if needed
- [ ] Test the file works correctly
- [ ] Verify error handling for missing variables
- [ ] Update any related documentation

---

## Support

If you encounter issues during migration:

1. Check the config package documentation
2. Review existing migrated files for patterns
3. File an issue with details
4. Ask for help in team chat

---

**Last Updated:** January 2026
