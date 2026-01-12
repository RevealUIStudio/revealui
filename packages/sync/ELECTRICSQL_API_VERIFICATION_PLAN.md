# ElectricSQL API Verification Plan

**Status**: 🔴 IN PROGRESS  
**Created**: 2025-01-26  
**Priority**: CRITICAL (Blocking Production Use)

## Problem Statement

All ElectricSQL API endpoints in the codebase are based on **unverified assumptions**, not official documentation. The implementation may not work with the actual ElectricSQL 1.2.9 HTTP API.

## Current Assumptions (Unverified)

### 1. Shape Query Endpoint
- **Assumed**: `/v1/shape?table=agent_contexts&agent_id=123`
- **Reality**: Unknown - format might be completely different
- **Risk**: HIGH - Shape subscriptions may not work
- **Location**: `packages/sync/src/client/index.ts:116`

### 2. Mutation Endpoints (CRUD)
- **Assumed**: REST endpoints like:
  - `POST /v1/{table}` - Create
  - `PUT /v1/{table}/{id}` - Update
  - `DELETE /v1/{table}/{id}` - Delete
- **Reality**: Unknown - ElectricSQL might not expose REST endpoints at all
- **Risk**: CRITICAL - All CRUD operations will fail if wrong
- **Locations**: 
  - `packages/sync/src/hooks/useAgentContext.ts:155`
  - `packages/sync/src/hooks/useAgentMemory.ts:169, 209`
  - `packages/sync/src/hooks/useConversations.ts:168, 213, 252`

### 3. Query Parameters Format
- **Assumed**: Simple query params like `agent_id=123&session_id=456`
- **Reality**: Might need structured WHERE clauses or different format
- **Risk**: HIGH - Filtering won't work correctly

### 4. Authorization Header Format
- **Assumed**: `Authorization: Bearer {token}`
- **Reality**: Might need different format
- **Risk**: MEDIUM - Auth might not work

## Verification Steps

### Step 1: Review Official Documentation ✅ IN PROGRESS

1. **Check ElectricSQL Official Docs**
   - URL: https://electric-sql.com/docs
   - Focus: HTTP API documentation, shape API, mutation endpoints
   - Look for: REST endpoints, mutation patterns, authentication

2. **Review GitHub Repository**
   - URL: https://github.com/electric-sql/electric
   - Focus: API documentation, examples, type definitions
   - Look for: Client implementation examples, HTTP API structure

3. **Check Client Package Documentation**
   - Package: `@electric-sql/client@1.4.0`
   - Package: `@electric-sql/react@1.0.26`
   - Look for: Type definitions, exported functions, API examples

### Step 2: Review Source Code Types

1. **Check Node Modules** (if available)
   ```bash
   find node_modules/@electric-sql* -name "*.d.ts" | head -10
   ```

2. **Review TypeScript Definitions**
   - Check `@electric-sql/client` types
   - Check `@electric-sql/react` types (especially `useShape`)
   - Look for: HTTP endpoint types, request/response formats

3. **Check Example Projects**
   - Look for ElectricSQL example repositories
   - Review how mutations are implemented in examples

### Step 3: Test with Actual Service

1. **Set Up Test Environment**
   ```bash
   # Start ElectricSQL service
   docker-compose -f docker-compose.electric.yml up -d
   
   # Or use CLI
   npx electric-sql start --with-postgres
   ```

2. **Test Shape Endpoint**
   ```bash
   # Test shape subscription
   curl -X GET "http://localhost:5133/v1/shape?table=agent_contexts" \
     -H "Authorization: Bearer test-token" \
     -H "Content-Type: application/json"
   ```

3. **Test Mutation Endpoints**
   ```bash
   # Test create
   curl -X POST "http://localhost:5133/v1/agent_contexts" \
     -H "Authorization: Bearer test-token" \
     -H "Content-Type: application/json" \
     -d '{"agent_id": "test", "context": {}}'
   
   # Test update
   curl -X PUT "http://localhost:5133/v1/agent_contexts/test-id" \
     -H "Authorization: Bearer test-token" \
     -H "Content-Type: application/json" \
     -d '{"context": {"updated": true}}'
   
   # Test delete
   curl -X DELETE "http://localhost:5133/v1/agent_contexts/test-id" \
     -H "Authorization: Bearer test-token"
   ```

4. **Check Server Logs**
   - Monitor ElectricSQL service logs for actual request/response formats
   - Look for: Endpoint paths, parameter formats, error messages

### Step 4: Alternative Approach Research

ElectricSQL might use a **different mutation pattern**:

1. **Shape-Based Mutations**
   - Mutations might go through the shape subscription system
   - Not REST endpoints, but WebSocket or HTTP streaming

2. **Direct Database Access**
   - Mutations might require direct PostgreSQL access
   - ElectricSQL might only sync reads, not writes

3. **GraphQL or Custom Protocol**
   - Might use GraphQL or custom binary protocol
   - Not standard REST

## Research Findings

### From Web Search (2025-01-26)

1. **ElectricSQL Transition**
   - ElectricSQL has transitioned to a new system (v0.9+, now 1.2.9+)
   - New system uses HTTP-based shapes (not local-first like 0.12.1)
   - Documentation: https://electric-sql.com/docs

2. **HTTP API Guide**
   - ElectricSQL provides a guide for "Writing Your Own Client"
   - URL: https://electric-sql.com/docs/guides/writing-your-own-client
   - This might contain HTTP API details

3. **CLI Tool**
   - ElectricSQL has a CLI tool: `npx electric-sql`
   - Commands: `start`, `stop`, `status`
   - Service runs on port 5133 by default

### Key Questions to Answer

1. ❓ Does ElectricSQL expose REST endpoints for mutations?
2. ❓ What is the correct shape endpoint format?
3. ❓ How are mutations handled? (REST, WebSocket, other?)
4. ❓ What is the correct authentication format?
5. ❓ Are there examples of mutation operations?

## Next Actions

### Immediate (Today)

1. ✅ Review ElectricSQL documentation website
2. ✅ Check GitHub repository for examples
3. ⏳ Review `@electric-sql/client` package types (if accessible)
4. ⏳ Search for example ElectricSQL projects with mutations

### Short Term (This Week)

1. ⏳ Set up test ElectricSQL service
2. ⏳ Test actual endpoints with curl/Postman
3. ⏳ Review server logs for request/response formats
4. ⏳ Update implementation based on findings

### Implementation Updates

Once verified, update:

1. `packages/sync/src/client/index.ts` - Shape endpoint
2. `packages/sync/src/hooks/useAgentContext.ts` - Mutation endpoints
3. `packages/sync/src/hooks/useAgentMemory.ts` - Mutation endpoints
4. `packages/sync/src/hooks/useConversations.ts` - Mutation endpoints
5. `packages/sync/API_ASSUMPTIONS.md` - Document verified APIs

## Alternative Solutions

If REST endpoints don't exist:

1. **Use Direct PostgreSQL**
   - Write directly to PostgreSQL
   - Let ElectricSQL sync read operations only
   - Simpler but loses some sync benefits

2. **Implement Custom Mutation Layer**
   - Create server-side API endpoints
   - Use RevealUI CMS API for mutations
   - ElectricSQL syncs read-only

3. **Wait for Official API**
   - ElectricSQL is still evolving
   - May add mutation endpoints in future
   - Document as known limitation

## Documentation to Update

After verification:

- [ ] `packages/sync/API_ASSUMPTIONS.md` - Mark verified endpoints
- [ ] `packages/sync/README.md` - Update with correct API usage
- [ ] `docs/electric-integration.md` - Update integration guide
- [ ] `docs/electric-setup-guide.md` - Add mutation examples
- [ ] `UNFINISHED_WORK_INVENTORY.md` - Update ElectricSQL status

## Risk Assessment

- **Current Risk**: 🔴 CRITICAL
  - All mutations will fail if endpoints are wrong
  - Shape subscriptions may not work correctly
  - Production deployment will break

- **After Verification**: 🟢 LOW
  - Implementation matches actual API
  - Proper error handling
  - Tested and validated

## References

- [ElectricSQL Documentation](https://electric-sql.com/docs)
- [ElectricSQL GitHub](https://github.com/electric-sql/electric)
- [Writing Your Own Client Guide](https://electric-sql.com/docs/guides/writing-your-own-client)
- [ElectricSQL Blog - v0.9 Release](https://electric-sql.com/blog/2024/01/24/electricsql-v0.9-released)
