# ElectricSQL API Assumptions

**Last Updated**: 2025-01-26  
**Status**: ⚠️ **UNVERIFIED ASSUMPTIONS**

This document details the API assumptions made during the initial ElectricSQL integration. These assumptions have **not been verified** against ElectricSQL 1.2.9 official documentation and should be tested before production deployment.

## Overview

The `@revealui/sync` package implementation is based on several assumptions about ElectricSQL's HTTP API. These assumptions were made based on:
- Common REST API patterns
- TypeScript type definitions in `@electric-sql/client` and `@electric-sql/react`
- ElectricSQL documentation (which focuses on shape subscriptions, not REST mutations)

## Assumed Endpoints

### 1. Shape Subscription Endpoint

**Endpoint**: `POST /v1/shape`

**Assumed Format**:
```typescript
{
  table: string,
  where?: string,
  params?: Record<string, string | number>
}
```

**Usage**:
- Used via `useShape` hook from `@electric-sql/react`
- Status: ⚠️ **PARTIALLY VERIFIED** - Hook exists and is from official package
- Risk: **LOW** - Format appears correct based on TypeScript types

### 2. Mutation Endpoints (❌ CRITICAL - UNVERIFIED)

The implementation assumes REST endpoints exist for mutations:

#### Create Entity
- **Endpoint**: `POST /v1/{table}`
- **Request Body**: Entity data (JSON)
- **Response**: Created entity (JSON)
- **Status**: ❌ **NOT VERIFIED**
- **Risk**: 🔴 **CRITICAL** - All create operations will fail if wrong

#### Update Entity
- **Endpoint**: `PUT /v1/{table}/{id}`
- **Request Body**: Partial entity data (JSON)
- **Response**: Updated entity (JSON)
- **Status**: ❌ **NOT VERIFIED**
- **Risk**: 🔴 **CRITICAL** - All update operations will fail if wrong

#### Delete Entity
- **Endpoint**: `DELETE /v1/{table}/{id}`
- **Response**: Success/error status
- **Status**: ❌ **NOT VERIFIED**
- **Risk**: 🔴 **CRITICAL** - All delete operations will fail if wrong

**Used In**:
- `useAgentContext.ts:155` - Update agent context
- `useAgentMemory.ts:169, 209` - Create/update agent memories
- `useConversations.ts:168, 213, 252` - Create/update/delete conversations

### 3. Query Parameters Format

**Assumed WHERE Clause Format**:
```typescript
{
  table: 'agent_contexts',
  where: 'agent_id = $1',
  params: { '1': agentId }
}
```

**Status**: ⚠️ **PARTIALLY VERIFIED** - Matches TypeScript types from `useShape`
- Risk: **MEDIUM** - Exact format needs verification

### 4. Authorization

**Assumed Header**: `Authorization: Bearer {token}`

**Status**: ❌ **NOT VERIFIED**
- Risk: **MEDIUM** - Authentication may not work
- Action: Check ElectricSQL authentication documentation

## Critical Questions

1. ❓ **Do REST mutation endpoints exist at all?**
   - ElectricSQL documentation focuses on shape subscriptions
   - May need to use different approach for mutations

2. ❓ **Is the URL format correct?**
   - Assumed: `/v1/{table}` for create, `/v1/{table}/{id}` for update/delete
   - May need different format or base path

3. ❓ **What is the request body format?**
   - Assumed: Standard JSON entity data
   - May need specific wrapper or format

4. ❓ **What is the response format?**
   - Assumed: JSON entity or error object
   - May have different structure

5. ❓ **How does authentication work?**
   - Assumed: Bearer token in Authorization header
   - May use different auth method

## Verification Steps Required

### 1. Start ElectricSQL Service
```bash
docker compose -f docker-compose.electric.yml up -d
```

### 2. Test Endpoints

**Test Create**:
```bash
curl -X POST http://localhost:5133/v1/agent_contexts \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "test", "session_id": "test"}'
```

**Test Update**:
```bash
curl -X PUT http://localhost:5133/v1/agent_contexts/{id} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"data": "updated"}'
```

**Test Delete**:
```bash
curl -X DELETE http://localhost:5133/v1/agent_contexts/{id} \
  -H "Authorization: Bearer {token}"
```

### 3. Review Type Definitions

Check TypeScript types in:
- `node_modules/@electric-sql/client/types`
- `node_modules/@electric-sql/react/types`

### 4. Review Official Documentation

- ElectricSQL Docs: https://electric-sql.com/docs
- GitHub Repository: https://github.com/electric-sql/electric
- Look for HTTP API examples or mutation guides

## Alternative Approaches

If REST endpoints don't exist, consider:

1. **Direct SQL via ElectricSQL Protocol**
   - Use ElectricSQL's sync protocol directly
   - More complex but officially supported

2. **Server Actions**
   - Perform mutations via Next.js Server Actions
   - Sync changes through shape subscriptions
   - More traditional but reliable approach

3. **ElectricSQL Client Methods**
   - Check if client package has mutation methods
   - May be hidden in undocumented APIs

## Impact Assessment

### Current Status

- ✅ Shape subscriptions: Working (via `useShape` hook)
- ❌ Mutations: Unverified assumptions
- ❌ Authentication: Unverified assumptions

### Risk Level

- 🔴 **CRITICAL**: All mutation operations may fail
- ⚠️ **HIGH**: Shape subscriptions may have parameter issues
- 🟡 **MEDIUM**: Authentication may not work

### Blocker Status

**BLOCKING**: Cannot deploy to production until:
1. Mutation endpoints are verified
2. Endpoint formats are confirmed
3. Authentication method is verified
4. All assumptions are tested with running service

## Related Documents

- [ElectricSQL API Verification Status](./ELECTRICSQL_API_VERIFICATION_STATUS.md) - Current verification status
- [ElectricSQL Documentation](https://electric-sql.com/docs) - Official docs
- [@revealui/sync README](./README.md) - Package documentation

## Notes

- All assumptions are documented to make the risk explicit
- Assumptions are based on common REST API patterns and TypeScript types
- Verification requires a running ElectricSQL service instance
- May need to refactor if assumptions are incorrect
