# Migration Guide: @vercel/postgres to Direct Supabase Connections

## Overview

This guide documents the migration from the deprecated `@vercel/postgres` adapter to direct Supabase database connections using the `universalPostgresAdapter`. This migration is necessary because Vercel Postgres was replaced with Vercel Marketplace Storage integrations in June 2025.

## Why Migrate?

1. **Deprecation**: Vercel Postgres was replaced with Marketplace integrations (June 2025)
2. **Better Support**: Direct Supabase connections offer better transaction pooling support
3. **More Control**: Direct connections provide more configuration options
4. **Future-Proof**: Marketplace integrations align with Vercel's new direction

## Migration Steps

### Step 1: Get Your Supabase Connection String

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to: **Settings** → **Database** → **Connection Pooling**
4. Select **Transaction mode** (port 6543) - recommended for serverless
5. Copy the connection string

**Connection String Format:**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
```

### Step 2: Update Environment Variables

Update your `.env.local` or production environment variables:

**Before (Vercel Postgres):**
```env
POSTGRES_URL=postgres://default:xxx@xxx.vercel-storage.com:5432/verceldb
```

**After (Supabase):**
```env
# Transaction Pooling (Recommended for Next.js Serverless)
POSTGRES_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# Or using direct connection string format
POSTGRES_URL=postgresql://postgres:password@db.xxx.supabase.co:6543/postgres?sslmode=require
```

### Step 3: Update Code Configuration

**File:** `apps/cms/revealui.config.ts`

**Before:**
```typescript
import { sqliteAdapter, postgresAdapter } from '@revealui/core/database'

export default buildConfig({
  db: process.env.POSTGRES_URL
    ? postgresAdapter({
        pool: {
          connectionString: process.env.POSTGRES_URL || '',
        },
      })
    : sqliteAdapter({ /* ... */ }),
})
```

**After:**
```typescript
import { sqliteAdapter, universalPostgresAdapter } from '@revealui/core/database'

export default buildConfig({
  db: config.database.url
    ? universalPostgresAdapter({
        connectionString: config.database.url,
      })
    : sqliteAdapter({ /* ... */ }),
})
```

**Important:** Make sure you also import the config module if using it:
```typescript
import config from '@revealui/config'
```

### Step 4: Remove @vercel/postgres Dependency (Optional)

The `@vercel/postgres` package is no longer needed if you're fully migrated:

```bash
pnpm remove @vercel/postgres --filter @revealui/core
```

Note: The package may still be installed but unused if you're keeping it for legacy compatibility.

### Step 5: Verify Migration

1. **Test Connection:**
   ```bash
   pnpm dev
   ```
   Check that the app starts without database connection errors.

2. **Test Database Operations:**
   - Create a collection item in the CMS admin
   - Query data from your collections
   - Verify migrations run correctly

3. **Check Logs:**
   - Ensure no errors about `@vercel/postgres`
   - Verify connection pooling is working

## Connection String Comparison

| Type | Vercel Postgres | Supabase (Transaction Pooling) |
|------|----------------|-------------------------------|
| **Port** | 5432 | 6543 |
| **Format** | `postgres://default:xxx@xxx.vercel-storage.com:5432/verceldb` | `postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require` |
| **Pooling** | Automatic (managed by Vercel) | Transaction pooling (required for serverless) |
| **Prepared Statements** | Supported | Not supported (transaction pooling) |

## Key Differences

### 1. Connection Pooling

**Vercel Postgres:**
- Automatic connection management
- No configuration needed
- Works out of the box

**Supabase (Transaction Pooling):**
- Explicit transaction pooling mode (port 6543)
- Better for serverless environments
- Handles high concurrency better

### 2. Adapter Configuration

**Old (`postgresAdapter`):**
```typescript
postgresAdapter({
  pool: {
    connectionString: process.env.POSTGRES_URL || '',
  },
})
```

**New (`universalPostgresAdapter`):**
```typescript
universalPostgresAdapter({
  connectionString: config.database.url,
  // Provider is auto-detected from connection string
})
```

### 3. Provider Detection

The `universalPostgresAdapter` automatically detects the provider:
- **Supabase**: Connection string contains `.supabase.co`
- **Neon**: Connection string contains `.neon.tech`
- **Vercel**: Connection string contains `vercel` (legacy support)

## Troubleshooting

### Issue: Connection Refused

**Symptoms:**
- Error: "Connection refused" or "ECONNREFUSED"
- Database operations fail to connect

**Solution:**
- Verify connection string format is correct
- Check that port 6543 is used for transaction pooling
- Ensure `sslmode=require` is included in connection string
- Verify Supabase project is active and accessible
- Check firewall/IP allowlist settings in Supabase dashboard

### Issue: Prepared Statement Errors

**Symptoms:**
- Error: "prepared statements are not supported"
- Queries fail with transaction pooling

**Solution:**
- Ensure you're using port 6543 (transaction pooling mode)
- Transaction pooling doesn't support prepared statements
- The `universalPostgresAdapter` automatically handles this by using `postgres-js` with `prepare: false`
- If errors persist, verify your connection string uses port 6543

### Issue: Migration Fails

**Symptoms:**
- Drizzle migrations fail to run
- Database schema updates don't apply

**Solution:**
- Verify connection string is accessible from your deployment environment
- Check Supabase project status (not paused or suspended)
- Ensure IP allowlist allows your deployment IPs (Vercel, etc.)
- Check that database user has proper permissions
- Review Supabase connection logs for blocked connections

### Issue: High Connection Count

**Symptoms:**
- Warning: "Too many connections"
- Database performance degrades
- Connection pool exhaustion

**Solution:**
- Transaction pooling (port 6543) is designed for high concurrency
- Monitor connection usage in Supabase dashboard → Database → Connection Pooling
- Adjust pool size if needed (Supabase dashboard settings)
- Ensure you're using transaction pooling, not direct connections
- Check for connection leaks in your application code

### Issue: Authentication Failed

**Symptoms:**
- Error: "Password authentication failed"
- "FATAL: password authentication failed for user"

**Solution:**
- Verify database password in connection string matches Supabase project
- Reset database password in Supabase dashboard if needed
- Ensure connection string uses correct username (typically `postgres`)
- Check if using pooler format: `postgres.[PROJECT_REF]` vs direct format: `postgres`

### Issue: SSL/TLS Errors

**Symptoms:**
- Error: "SSL connection required"
- "no pg_hba.conf entry"

**Solution:**
- Ensure connection string includes `?sslmode=require`
- For strict SSL: Use `?sslmode=verify-full` (requires CA certificate)
- Verify Supabase project SSL settings are enabled
- Check that connection string uses `postgresql://` protocol (not `postgres://`)

## Rollback Procedure

If you need to rollback to Vercel Postgres (if still available):

1. **Revert Code Changes:**
   ```typescript
   // In apps/cms/revealui.config.ts
   import { sqliteAdapter, postgresAdapter } from '@revealui/core/database'
   
   export default buildConfig({
     db: process.env.POSTGRES_URL
       ? postgresAdapter({
           pool: {
             connectionString: process.env.POSTGRES_URL || '',
           },
         })
       : sqliteAdapter({ /* ... */ }),
   })
   ```

2. **Restore Environment Variables:**
   ```env
   POSTGRES_URL=postgres://default:xxx@xxx.vercel-storage.com:5432/verceldb
   ```

3. **Ensure Package is Installed:**
   ```bash
   pnpm add @vercel/postgres --filter @revealui/core
   ```

4. **Redeploy:**
   - Commit and push changes
   - Deploy to your environment

**Note:** Vercel Postgres may no longer be available for new projects. Consider migrating to Neon or another provider if Supabase doesn't meet your needs.

## Additional Resources

- [Supabase Connection Pooling Guide](https://supabase.com/docs/guides/database/connecting-to-postgres#connecting-with-drizzle)
- [Supabase Drizzle Integration](https://supabase.com/docs/guides/database/drizzle)
- [Vercel Marketplace Announcement](https://vercel.com/blog/introducing-the-vercel-marketplace)
- [RevealUI Database Provider Switching](../reference/database/DATABASE-PROVIDER-SWITCHING.md)
- [RevealUI Custom Integrations](CUSTOM-INTEGRATIONS.md)

## Migration Checklist

Use this checklist to track your migration progress:

- [ ] Get Supabase connection string (transaction pooling, port 6543)
- [ ] Update `POSTGRES_URL` environment variable in `.env.local`
- [ ] Update `POSTGRES_URL` environment variable in production (Vercel, etc.)
- [ ] Update `revealui.config.ts` to use `universalPostgresAdapter`
- [ ] Update import statement (remove `postgresAdapter`, add `universalPostgresAdapter`)
- [ ] Import config module if using `config.database.url`
- [ ] Test database connection locally (`pnpm dev`)
- [ ] Verify all database operations work (create, read, update, delete)
- [ ] Test Drizzle migrations run correctly
- [ ] Test in staging/preview environment
- [ ] Deploy to production environment
- [ ] Monitor connection usage post-migration
- [ ] Remove `@vercel/postgres` dependency (optional, after confirming everything works)
- [ ] Update team documentation with new connection details
- [ ] Archive old Vercel Postgres connection strings

## Next Steps

After successful migration:

1. **Monitor Performance**: Check Supabase dashboard for connection metrics
2. **Optimize Queries**: Review slow query logs if available
3. **Set Up Alerts**: Configure Supabase alerts for connection issues
4. **Document Changes**: Update team docs with new connection string format
5. **Clean Up**: Remove any Vercel Postgres-specific code or configs
