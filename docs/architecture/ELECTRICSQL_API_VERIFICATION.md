# ElectricSQL API Verification

**Date**: 2026-02-01
**Status**: ✅ **VERIFIED** - Implementation is correct

---

## Executive Summary

**Result**: The ElectricSQL API implementation in RevealUI is **CORRECT** and matches the official API specification.

**Risk Assessment**: ✅ **LOW** - No changes needed to sync functionality

---

## Verification Method

1. **Official Documentation Review**:
   - [ElectricSQL HTTP API Documentation](https://electric-sql.com/docs/api/http)
   - [React Integration Guide](https://electric-sql.com/docs/integrations/react)
   - [TypeScript Client Documentation](https://electric-sql.com/docs/api/clients/typescript)

2. **Source Code Analysis**:
   - Examined `@electric-sql/client@1.4.1` source code in node_modules
   - Verified actual parameter names and query building logic
   - Compared with RevealUI implementation

3. **Implementation Review**:
   - `apps/cms/src/lib/api/electric-proxy.ts`
   - `apps/cms/src/app/api/shapes/*/route.ts`
   - `packages/sync/src/hooks/useConversations.ts`

---

## Verified API Specifications

### 1. Endpoint ✅

**Official**: `GET /v1/shape`

**RevealUI Implementation**:
```typescript
const originUrl = new URL(`${electricUrl}/v1/shape`)
```

✅ **CORRECT**

---

### 2. Query Parameters ✅

**Official Parameter Names** (from `@electric-sql/client@1.4.1`):

```javascript
TABLE_QUERY_PARAM = `table`
WHERE_QUERY_PARAM = `where`          // NOT subset__where
WHERE_PARAMS_PARAM = `params`        // NOT subset__params
```

**RevealUI Implementation**:
```typescript
originUrl.searchParams.set('table', 'conversations')
originUrl.searchParams.set('where', `user_id = $1`)
originUrl.searchParams.set('params', JSON.stringify([userId]))
```

✅ **CORRECT** - Uses standard `where` and `params`, not `subset__*` variants

---

### 3. Protocol Parameters ✅

**Official Protocol Parameters** (from `@electric-sql/client@1.4.1`):

```javascript
ELECTRIC_PROTOCOL_QUERY_PARAMS = [
  'live',       // LIVE_QUERY_PARAM
  'live_sse',   // LIVE_SSE_QUERY_PARAM
  'handle',     // SHAPE_HANDLE_QUERY_PARAM
  'offset',     // OFFSET_QUERY_PARAM
  'cursor',     // LIVE_CACHE_BUSTER_QUERY_PARAM
  // ... (+ expired_handle, log)
]
```

**RevealUI Implementation**:
```typescript
import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from '@electric-sql/client'

url.searchParams.forEach((value, key) => {
  if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
    originUrl.searchParams.set(key, value)
  }
})
```

✅ **CORRECT** - Uses official constant to forward protocol parameters

---

### 4. Parameter Binding ✅

**Official Format**:
- WHERE clause uses positional parameters: `$1`, `$2`, etc.
- Parameters passed as JSON array or object with numeric keys
- Example: `where=status=$1&params=["active"]`

**RevealUI Implementation**:
```typescript
originUrl.searchParams.set('where', `user_id = $1`)
originUrl.searchParams.set('params', JSON.stringify([userId]))
```

✅ **CORRECT** - Uses positional parameters with JSON array

---

### 5. Authentication ✅

**Official Recommendation**: Proxy requests through backend API (not expose Electric directly)

**RevealUI Implementation**:
- ✅ Uses authenticated proxy routes: `/api/shapes/*`
- ✅ Validates session with RevealUI auth
- ✅ Adds row-level filtering before forwarding
- ✅ Validates user ID format (UUID)
- ✅ Forwards to Electric backend

✅ **CORRECT** - Follows security best practices

---

## Implementation Files Verified

### 1. Electric Proxy Utilities ✅

**File**: `apps/cms/src/lib/api/electric-proxy.ts`

```typescript
export function prepareElectricUrl(requestUrl: string): URL {
  const url = new URL(requestUrl)
  const electricUrl = getElectricUrl()
  const originUrl = new URL(`${electricUrl}/v1/shape`)

  // Copy Electric-specific query params
  url.searchParams.forEach((value, key) => {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      originUrl.searchParams.set(key, value)
    }
  })

  // Add Electric Cloud authentication if configured
  if (process.env.ELECTRIC_SOURCE_ID && process.env.ELECTRIC_SECRET) {
    originUrl.searchParams.set('source_id', process.env.ELECTRIC_SOURCE_ID)
    originUrl.searchParams.set('secret', process.env.ELECTRIC_SECRET)
  }

  return originUrl
}
```

✅ **Verified**: Correct endpoint, parameter forwarding, authentication

---

### 2. Shape Proxy Routes ✅

**File**: `apps/cms/src/app/api/shapes/conversations/route.ts`

```typescript
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession(request.headers)
  if (!session) return createApplicationErrorResponse(...)

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set('table', 'conversations')

  // SQL injection safe - validates UUID format
  const userId = session.user.id
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return createValidationErrorResponse(...)
  }

  originUrl.searchParams.set('where', `user_id = $1`)
  originUrl.searchParams.set('params', JSON.stringify([userId]))

  return proxyElectricRequest(originUrl)
}
```

✅ **Verified**: Authentication, parameter binding, security validation

---

### 3. React Hooks ✅

**File**: `packages/sync/src/hooks/useConversations.ts`

```typescript
export function useConversations(_userId: string) {
  const { data, isLoading, error } = useShape({
    url: `/api/shapes/conversations`,
  })
  // ...
}
```

✅ **No params passed from client** — all filtering is enforced server-side by the proxy.
The `_userId` parameter is kept for API compatibility; the proxy reads the session cookie directly.

> **Note (2026-02-23):** The minor `params[1]` issue flagged in the original doc has been resolved.
> The hook was refactored to pass no client-side params — the proxy handles all filtering.

---

## Note on `subset__*` Parameters

**Documentation Clarification**:

The HTTP API documentation mentions `subset__where` and `subset__params` parameters. These are used for:

1. **POST requests** with JSON body (subset snapshots)
2. **GET requests** with query parameters (alternative format)

The TypeScript client (`@electric-sql/client`) and React hooks (`@electric-sql/react`) use the **standard format**:
- `where` (not `subset__where`)
- `params` (not `subset__params`)

Both formats are valid, but the client libraries use the standard format, which is what we're using.

---

## Findings Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| **Endpoint** | ✅ Correct | `/v1/shape` |
| **Query Parameters** | ✅ Correct | `table`, `where`, `params` |
| **Protocol Parameters** | ✅ Correct | Uses official constant |
| **Parameter Binding** | ✅ Correct | Positional `$1`, `$2` with JSON array |
| **Authentication** | ✅ Correct | Proxy pattern with session validation |
| **Security** | ✅ Correct | UUID validation, SQL injection safe |
| **React Hooks** | ✅ Correct | Client passes no params; proxy handles all filtering (updated 2026-02-23) |

---

## Recommendations

### 1. Add Integration Tests

Create integration tests that verify:
- ✅ Shape subscription works (already exists: `__tests__/agent-contexts.test.ts`)
- ✅ Parameter binding works
- ✅ Authentication works
- ✅ Row-level filtering works

**Priority**: MEDIUM - Tests exist but could be expanded

---

### 3. Document Electric Service URL

**Priority**: LOW - Already documented in sync package README

---

## Phase 1.2 Status: ✅ COMPLETE

**Success Criteria Met:**
- ✅ ElectricSQL API endpoints verified against official documentation
- ✅ Implementation matches actual API (no changes needed)
- ✅ Authentication and security verified
- ✅ Parameter binding verified

**Time Spent**: 1.5 hours (vs. estimated 4-8 hours)

**Result**: No critical issues found. Implementation is production-ready for sync functionality.

---

## Deployment Plan (updated 2026-02-23)

**Decision:** Self-hosted Electric on Railway (not Electric Cloud).

| | Detail |
|--|--------|
| **Platform** | Railway (~$5/mo, one-click template) |
| **Docker image** | `electricsql/electric:latest` |
| **NeonDB connection** | Direct (non-pooled) — required for logical replication |
| **NeonDB prereq** | Enable logical replication: Dashboard → Settings → Logical Replication |
| **Env vars needed** | `DATABASE_URL` (direct Neon URL), `ELECTRIC_SECRET` (random 32+ chars) |
| **Persistent volume** | `/var/lib/electric/persistent` (pre-configured by Railway template) |
| **Vercel env var** | `ELECTRIC_SERVICE_URL` = Railway service URL |
| **Not needed** | `ELECTRIC_SOURCE_ID`, `ELECTRIC_SECRET` in Vercel (Electric Cloud only) |

See `docs/MASTER_PLAN.md` section 0.3 for step-by-step provisioning checklist.

---

**Verified By**: Official documentation review + source code analysis + implementation verification
**Date**: 2026-02-01 (deployment plan updated 2026-02-23)
**Verification Level**: ✅ **COMPLETE**
