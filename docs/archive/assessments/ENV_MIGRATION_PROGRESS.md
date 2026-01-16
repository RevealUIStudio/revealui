# Environment Variable Migration Progress

**Date:** January 2026  
**Status:** In Progress

---

## Summary

Migrating from direct `process.env` accesses to centralized `@revealui/config` with Zod validation.

**Total Instances:** 455 across 163 files  
**Migrated:** 3 files in `packages/auth`  
**Remaining:** ~452 instances

---

## Completed Migrations

### ✅ packages/auth (3 files)

**Files Migrated:**
1. `packages/auth/src/server/storage/index.ts`
2. `packages/auth/src/server/storage/database.ts`
3. `packages/auth/package.json` (added `@revealui/config` dependency)

**Changes:**
- Replaced `process.env.POSTGRES_URL || process.env.DATABASE_URL` with `config.database.url`
- Added `@revealui/config` as dependency
- Maintained backward compatibility (constructor still accepts connectionString override for testing)

**Before:**
```typescript
if (process.env.POSTGRES_URL || process.env.DATABASE_URL) {
  globalStorage = new DatabaseStorage()
}
```

**After:**
```typescript
import config from '@revealui/config'

if (config.database.url) {
  globalStorage = new DatabaseStorage()
}
```

**Benefits:**
- ✅ Type-safe access to database URL
- ✅ Runtime validation (fails fast if missing)
- ✅ Centralized configuration management
- ✅ Better developer experience (autocomplete)

---

## Test Files (Not Migrated)

**Rationale:** Test files continue to use `process.env` directly because:
- Tests need to set test-specific values
- Tests may need to override config for isolation
- Test setup utilities need flexibility

**Files (Not Migrated):**
- `packages/auth/tests/integration/setup.ts` - Test database setup
- `packages/auth/src/__tests__/integration/session.test.ts` - Test skip logic
- `packages/auth/src/__tests__/integration/auth-flow.test.ts` - Test skip logic

**Note:** These are acceptable - test files can use `process.env` for test configuration.

---

## Migration Priority

### P0 - Critical (In Progress)
1. ✅ **packages/auth** - Authentication & security (COMPLETE)
2. 🔄 **packages/db** - Database connections (NEXT)
3. 🔄 **apps/cms/src/app/api** - API routes (NEXT)

### P1 - High Priority
4. **packages/services** - Stripe, Supabase integrations
5. **packages/revealui/src/core** - Core framework
6. **apps/cms/src/lib** - CMS utilities

### P2 - Medium Priority
7. **packages/sync** - Sync package
8. **packages/ai** - AI package
9. **apps/web** - Web app

### P3 - Low Priority
10. **Test files** - Can keep using `process.env` (acceptable)
11. **Scripts** - May need special handling

---

## Migration Pattern

### Standard Pattern

**Before:**
```typescript
const serverURL = process.env.REVEALUI_PUBLIC_SERVER_URL || 'http://localhost:4000'
```

**After:**
```typescript
import config from '@revealui/config'
const serverURL = config.reveal.publicServerURL
```

### With Fallback (Database)

**Before:**
```typescript
const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || ''
```

**After:**
```typescript
import config from '@revealui/config'
const dbUrl = config.database.url // Handles POSTGRES_URL and DATABASE_URL fallback
```

### Optional Variables

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

---

## Next Steps

### Immediate (This Week)
1. ✅ Migrate `packages/auth` (COMPLETE)
2. 🔄 Migrate `packages/db` - Database client
3. 🔄 Migrate `apps/cms/src/app/api` - API route handlers

### Short-term (1-2 weeks)
4. Migrate `packages/services` - Stripe, Supabase
5. Migrate `packages/revealui/src/core/config` - Core config
6. Migrate `apps/cms/src/lib` - CMS utilities

### Medium-term (1 month)
7. Migrate remaining packages
8. Update documentation
9. Add lint rule to prevent new `process.env` accesses

---

## Benefits Achieved

### Type Safety
- ✅ Type-safe access to environment variables
- ✅ Autocomplete support in IDE
- ✅ Compile-time checking

### Runtime Validation
- ✅ Zod schema validation
- ✅ Fail-fast on missing required variables
- ✅ Clear error messages

### Centralized Management
- ✅ Single source of truth for env vars
- ✅ Easier to track what variables are needed
- ✅ Better documentation

### Developer Experience
- ✅ Better autocomplete
- ✅ Type checking
- ✅ Clearer code

---

## Notes

- Test files can continue using `process.env` (acceptable)
- Scripts may need special handling
- Build-time code may need lenient validation (config handles this)
- Migration is gradual - can be done file by file

---

**Last Updated:** January 2026
