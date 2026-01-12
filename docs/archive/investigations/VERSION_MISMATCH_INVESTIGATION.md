# ElectricSQL Version Mismatch Investigation

**Date**: January 8, 2025  
**Status**: 🔴 **CRITICAL INCOMPATIBILITY LIKELY**

---

## Problem Summary

**Client Version**: `electric-sql@0.12.1` (deprecated)  
**Server Version**: `electric 1.2.9` (new version from Docker image)

**Warning Message**: 
```
deprecated: We've rebuilt the sync engine. See https://next.electric-sql.com/about 
for more info and the quickstart there for getting started with the new system
```

---

## Key Findings

### 1. Package Status

**electric-sql@0.12.1**:
- ✅ Installed and available in workspace
- ❌ Marked as deprecated
- ❌ Last stable version before major rebuild
- ⚠️ Points to `next.electric-sql.com` for new system

### 2. Server Version

**electric 1.2.9** (from Docker logs):
- New version with rebuilt sync engine
- Different architecture from 0.12.1
- API likely incompatible with 0.12.1 client

### 3. API Imports Used

Our code uses these imports from `electric-sql@0.12.1`:
- `makeElectricContext` from `'electric-sql/react'`
- `useLiveQuery` from `'electric-sql/react'`
- `electrify` from `'electric-sql/pglite'`
- `PGlite` from `'@electric-sql/pglite'`

---

## Compatibility Assessment

### Likely Incompatibilities

1. **Protocol Mismatch**
   - Client 0.12.1 may use different sync protocol than server 1.2.9
   - WebSocket message format likely changed
   - Authentication flow may be different

2. **API Changes**
   - `electrify()` function signature may have changed
   - `useLiveQuery()` hook API may be different
   - Generated config format likely changed

3. **Schema Generation**
   - CLI tool (`electric-sql generate`) may not work with 1.2.9 server
   - Config format mismatch
   - Type generation incompatible

---

## Options for Resolution

### Option 1: Upgrade Client to Match Server ⚠️ **RECOMMENDED**

**Action**: Upgrade `electric-sql` package to match server version

**Pros**:
- ✅ Uses supported, current version
- ✅ Access to new features and fixes
- ✅ Security updates
- ✅ Official migration path

**Cons**:
- ❌ May require code changes
- ❌ API might be significantly different
- ❌ Need to verify compatibility

**Steps**:
1. Check if newer npm package exists that matches 1.2.9
2. Update package.json
3. Test API compatibility
4. Update code as needed

### Option 2: Downgrade Server to Match Client ⚠️ **NOT RECOMMENDED**

**Action**: Use older Docker image that matches 0.12.1

**Pros**:
- ✅ No code changes needed
- ✅ Known working API

**Cons**:
- ❌ Using deprecated/unsupported version
- ❌ Security vulnerabilities
- ❌ Missing new features
- ❌ Old image may not exist or be available

### Option 3: Use New System (next.electric-sql.com) 🔄 **LONG TERM**

**Action**: Migrate to completely new ElectricSQL system

**Pros**:
- ✅ Future-proof
- ✅ Actively maintained
- ✅ Better features

**Cons**:
- ❌ Complete rewrite required
- ❌ Different API entirely
- ❌ Significant time investment

---

## Recommended Action Plan

### Immediate (To Continue Testing)

1. **Check npm registry for newer versions**
   ```bash
   npm view electric-sql versions --json
   ```

2. **Check Docker image tags**
   ```bash
   docker search electricsql/electric
   docker pull electricsql/electric:0.12.1  # If exists
   ```

3. **Test compatibility**
   - Try current setup (might work by accident)
   - Check error messages for protocol mismatches
   - Verify WebSocket connection

### Short Term (Proper Fix)

1. **Investigate new version API**
   - Visit next.electric-sql.com
   - Review migration guide
   - Check API documentation

2. **Choose upgrade path**
   - If 1.2.x client exists → upgrade
   - If not → use matching versions
   - If completely different → plan migration

3. **Update implementation**
   - Modify code for new API
   - Update tests
   - Verify functionality

---

## API Analysis

### Current Implementation

**electrify() call**:
```typescript
const electrifiedDb = await electrify(
  originalDb,              // PGlite instance
  generatedConfig as never, // Generated config (expected to be DbSchema)
  {
    auth: authToken ? { token: authToken } : undefined,
  }
)
```

**Expected Signature** (from type definitions):
```typescript
electrify<T extends Database, DB extends DbSchema<any>>(
  db: T,                    // Database adapter
  dbDescription: DB,        // DbSchema (not config!)
  config: ElectricConfig,   // ElectricConfig
  opts?: ElectrifyOptions   // Optional options
): Promise<ElectricClient<DB>>
```

**Problem**: We're passing `generatedConfig` as the second parameter, but it should be:
1. `dbDescription` - The schema definition (DbSchema)
2. `config` - ElectricConfig (separate parameter)
3. `opts` - Options including auth

### Available Docker Images

**Found Docker tags**:
- `latest` → `1.2.9` (current)
- `1.2.9`, `1.2.8`, `1.2.7`, `1.2.6`, `1.2.5`, `1.2.4`, `1.2.3`, `1.2.2`
- `canary` (development)

**No 0.12.x Docker images available** - Server only has 1.2.x versions

### Verification Steps

1. **Generate Schema** (if possible)
   ```bash
   pnpm dlx electric-sql generate
   ```
   - Will show if CLI works with server
   - Will reveal config format differences
   - **Likely to fail** - CLI is 0.12.1, server is 1.2.9

2. **Test Client Connection**
   - Initialize client with server
   - Check WebSocket connection
   - Look for protocol errors
   - **Expect connection failures** due to version mismatch

3. **Check Error Messages**
   - Server logs will show protocol errors
   - Client errors will indicate API mismatches
   - **Already seeing database errors** (wal_level) before we can test API

---

## Risk Assessment

**High Risk**: Client and server are likely incompatible

**Evidence**:
- Major version jump (0.12 → 1.2)
- "Rebuilt sync engine" message
- Deprecation warning
- Points to completely new system

**Impact**:
- 🔴 Implementation may not work at all
- 🔴 Need to rewrite significant portions
- 🔴 Delay in deployment

**Probability of Compatibility**: **Very Low** (~5-10%)

**Evidence for Incompatibility**:
- Major version jump (0.12 → 1.2)
- No 0.12.x Docker images available
- Different API signature expected
- "Rebuilt sync engine" confirms major changes
- npm package points to completely new system

**Confirmed Issues**:
1. ❌ Docker images only available for 1.2.x (no 0.12.x)
2. ❌ API signature mismatch (`electrify()` expects different parameters)
3. ❌ Generated config format likely different
4. ❌ Protocol likely incompatible

---

## Next Steps

1. ✅ **Document findings** (this file)
2. ⏳ **Check for compatible versions**
3. ⏳ **Test current setup** (once database configured)
4. ⏳ **Decide on upgrade path**
5. ⏳ **Implement changes**

---

## References

- Deprecation notice: npm package metadata
- New system: https://next.electric-sql.com/about
- Legacy docs: https://legacy.electric-sql.com/
- Docker image: `electricsql/electric:latest` (1.2.9)
