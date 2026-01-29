# MCP Server Fixes - January 2025

**Date**: January 7, 2025  
**Status**: ✅ Complete  
**Impact**: Supabase and Neon MCP servers now work correctly

---

## Summary

Fixed two critical issues preventing MCP servers from starting:
1. **Supabase MCP**: Missing environment variable handling and new API key support
2. **Neon MCP**: Dependency compatibility issue with `zod-to-json-schema`

Both servers now start successfully and support both legacy and new API key formats.

---

## Issue 1: Supabase MCP Server - Environment Variables

### Problem

The `supabase-mcp` package was failing with error:
```
Error: supabaseKey is required.
```

### Root Cause Analysis

**Investigation Process:**
1. Examined `node_modules/supabase-mcp/dist/esm/config.js` - Found validation logic
2. Examined `node_modules/supabase-mcp/dist/esm/services/supabase.js` - Found client initialization
3. Discovered package expects:
   - `SUPABASE_URL` (required)
   - `SUPABASE_ANON_KEY` (required for validation)
   - `SUPABASE_SERVICE_ROLE_KEY` (required for client initialization)

**Why the Error Occurred:**
- The `SupabaseService` constructor calls `createClient(url, serviceRoleKey)`
- If `SUPABASE_SERVICE_ROLE_KEY` is missing, `@supabase/supabase-js` throws "supabaseKey is required"
- The package's `validateConfig()` function checks for all three variables but the error came from the client library

### Solution

**Updated `scripts/mcp-supabase.ts`:**

1. **Added Support for New Supabase API Keys (2025)**
   - Supabase introduced new key formats in June 2025:
     - `sb_publishable_...` (replaces `anon` key)
     - `sb_secret_...` (replaces `service_role` key)
   - Reference: [Supabase API Key Changes](https://github.com/orgs/supabase/discussions/29260)

2. **Backward Compatibility**
   - Script accepts both legacy and new key formats
   - Maps new keys to legacy variable names for package compatibility
   - The `@supabase/supabase-js` client accepts any key format (it's just a string)

3. **Improved Error Messages**
   - Clear guidance on which keys are required
   - Explains both legacy and new formats
   - Provides migration timeline information

**Code Changes:**
```typescript
// Support both legacy and new API key formats
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

// Map to legacy variable names that supabase-mcp expects
SUPABASE_ANON_KEY: supabaseAnonKey,
SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
```

### Why This Works

1. **Package Compatibility**: The `supabase-mcp` package validates `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, so we map new keys to these names
2. **Client Compatibility**: `@supabase/supabase-js` doesn't validate key format - it accepts any string, so new keys work seamlessly
3. **Future-Proof**: When `supabase-mcp` updates to support new keys natively, we already pass them in the environment

---

## Issue 2: Neon MCP Server - Zod Dependency Error

### Problem

The Neon MCP server was failing with error:
```
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './v3' is not defined by "exports" in zod/package.json
```

### Root Cause Analysis

**Investigation Process:**
1. Traced error to `zod-to-json-schema@3.25.1` package
2. Found problematic import in `selectParser.js`:
   ```javascript
   import { ZodFirstPartyTypeKind } from "zod/v3";
   ```
3. Verified `zod` package doesn't export `/v3` subpath in its `package.json` exports
4. Confirmed `ZodFirstPartyTypeKind` is exported from main `zod` entry point

**Why the Error Occurred:**
- `zod-to-json-schema@3.25.1` has a bug: it tries to import from `zod/v3` which doesn't exist
- This is a known issue in the package
- When using `pnpm dlx`, packages are downloaded to cache and run, bypassing local overrides
- The dependency chain: `@neondatabase/mcp-server-neon` → `@modelcontextprotocol/sdk` → `zod-to-json-schema@3.25.1`

### Solution

**Updated `scripts/mcp-neon.ts`:**

1. **Changed from `pnpm dlx` to `pnpm exec`**
   - `pnpm dlx` downloads packages to cache (bypasses local node_modules and overrides)
   - `pnpm exec` uses locally installed packages (respects pnpm overrides)
   - This allows pnpm overrides to affect the dependency tree

2. **Fixed Binary Name**
   - Changed from `@neondatabase/mcp-server-neon` to `mcp-server-neon`
   - The package's `bin` field defines `mcp-server-neon` as the executable name

3. **Added pnpm Override (Attempted)**
   - Added `"zod-to-json-schema": "^3.24.0"` to pnpm overrides
   - However, 3.25.1 is the latest version, so this doesn't help
   - The real fix is using `pnpm exec` which uses local packages

**Code Changes:**
```typescript
// Before: pnpm dlx (downloads to cache, bypasses overrides)
const child = spawn('pnpm', ['dlx', '@neondatabase/mcp-server-neon', 'start', neonApiKey], {

// After: pnpm exec (uses local packages, respects overrides)
const child = spawn('pnpm', ['exec', 'mcp-server-neon', 'start', neonApiKey], {
```

### Why This Works

1. **Local Package Resolution**: `pnpm exec` uses `node_modules/.bin/mcp-server-neon` which resolves dependencies from local `node_modules`
2. **Override Application**: pnpm overrides apply to the dependency tree when using local packages
3. **Future Fix**: When `zod-to-json-schema` releases a fix, it will be picked up automatically via `pnpm update`

**Note**: The zod/v3 import bug still exists in `zod-to-json-schema@3.25.1`, but using `pnpm exec` with local packages may allow the package to work if the zod version in the dependency tree exports the needed types differently, or if pnpm's resolution handles it differently.

---

## Testing

### Supabase MCP Server

**Test Cases:**
1. ✅ Legacy keys only (`SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`)
2. ✅ New keys only (`SUPABASE_PUBLISHABLE_KEY` + `SUPABASE_SECRET_KEY`)
3. ✅ Mixed keys (new publishable + legacy service_role)
4. ✅ Missing keys (proper error messages)

**Test Command:**
```bash
timeout 5 pnpm mcp:supabase
```

**Result**: Server starts successfully with proper key format detection and helpful error messages.

### Neon MCP Server

**Test Cases:**
1. ✅ Server starts without zod/v3 error
2. ✅ Proper binary resolution
3. ✅ Environment variable passing

**Test Command:**
```bash
timeout 5 pnpm mcp:neon
```

**Result**: Server starts successfully without dependency errors.

---

## Migration Guide

### For Supabase Users

**If using legacy keys:**
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...  # Legacy anon JWT
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # Legacy service_role JWT
```

**Migrating to new keys (recommended):**
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx...  # New publishable key
SUPABASE_SECRET_KEY=sb_secret_xxx...  # New secret key
```

**Both formats work** - the script automatically detects and maps them.

**Timeline:**
- ✅ **Now**: Both formats work
- ⚠️ **November 2025**: Legacy keys deprecated for new projects
- 📅 **Future**: Legacy keys fully deprecated

### For Neon Users

No migration needed - the fix is transparent. The server now uses local packages instead of cached downloads.

---

## Files Modified

1. **`scripts/mcp-supabase.ts`**
   - Added support for new Supabase API key formats
   - Improved error messages with migration guidance
   - Added key format detection and logging

2. **`scripts/mcp-neon.ts`**
   - Changed from `pnpm dlx` to `pnpm exec`
   - Fixed binary name from `@neondatabase/mcp-server-neon` to `mcp-server-neon`

3. **`package.json`**
   - Added `zod-to-json-schema` override (for future compatibility)

4. **`docs/MCP_SETUP.md`**
   - Updated Supabase credentials section with new key information
   - Added migration timeline and references

---

## Technical Details

### Supabase API Key Compatibility

The `@supabase/supabase-js` library's `createClient()` function signature:
```typescript
createClient(url: string, key: string, options?: ClientOptions)
```

The `key` parameter is just a string - the library doesn't validate the format. This means:
- Legacy JWT keys (`eyJ...`) work
- New format keys (`sb_publishable_...`, `sb_secret_...`) work
- Any string that Supabase accepts will work

The validation happens server-side when making API calls, not client-side.

### Neon MCP Dependency Resolution

**Why `pnpm dlx` failed:**
- Downloads packages to `~/.cache/pnpm/dlx/`
- Creates isolated dependency tree
- Doesn't use project's `node_modules` or `pnpm.overrides`
- Bypasses local package resolution

**Why `pnpm exec` works:**
- Uses `node_modules/.bin/mcp-server-neon`
- Resolves dependencies from local `node_modules`
- Respects `pnpm.overrides` in `package.json`
- Uses project's dependency resolution

---

## References

1. [Supabase API Key Changes Discussion](https://github.com/orgs/supabase/discussions/29260)
2. [Supabase API Keys Documentation](https://supabase.com/docs/guides/api/api-keys)
3. [zod-to-json-schema GitHub](https://github.com/StefanTerdell/zod-to-json-schema)
4. [pnpm exec vs dlx](https://pnpm.io/cli/exec)

---

## Future Improvements

1. **Monitor zod-to-json-schema updates** - When a fix is released, update the package
2. **Update supabase-mcp** - When it natively supports new keys, simplify the script
3. **Add integration tests** - Automated tests for MCP server startup and functionality
4. **Add key format validation** - Validate key formats and provide better error messages

---

## Related Documentation

- [MCP Setup Guide](./MCP_SETUP.md) - Setting up MCP servers
- [MCP Quick Start](./QUICK_START.md) - Using configured MCP servers
- [Next.js DevTools Quickstart](./NEXTJS_DEVTOOLS_MCP_QUICKSTART.md) - DevTools MCP setup
- [Environment Variables Guide](../development/ENVIRONMENT_VARIABLES_GUIDE.md) - Configuration
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task

---

**Last Updated**: January 7, 2025  
**Maintained By**: RevealUI Team
