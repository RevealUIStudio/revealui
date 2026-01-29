# Prioritized Action Plan - Unfinished Work

**Created**: 2025-01-26  
**Status**: Active

---

## ✅ Already Complete (Status Updated)

1. **CollectionOperations.ts splitting** - ✅ DONE
   - File is 76 lines (target: ~150)
   - Methods properly extracted to `operations/` directory
   - Assessment docs were outdated

2. **console.warn regression in json-parsing.ts** - ✅ FIXED
   - Uses `defaultLogger.warn()` instead of `console.warn`
   - Assessment docs were outdated

3. **RevealUIInstance.ts splitting** - ✅ PARTIALLY DONE
   - File is 317 lines (target: ~150, but acceptable given structure)
   - Methods extracted to `methods/` directory
   - Could be optimized further but not critical

---

## 🔴 Critical (Blocking Production)

### 1. ElectricSQL API Verification - CRITICAL

**Status**: 🔴 BLOCKING  
**Priority**: P0 - Must fix before production use  
**Estimated Time**: 4-8 hours (documentation review + testing)

**Problem**: All ElectricSQL API endpoints are based on unverified assumptions. The implementation may not work with the actual ElectricSQL 1.2.9 HTTP API.

**Endpoints to Verify**:
- [ ] Shape query endpoint: `/v1/shape?table=agent_contexts&agent_id=123`
- [ ] Mutation endpoints (CRUD):
  - [ ] `GET /v1/{table}` - List
  - [ ] `GET /v1/{table}/{id}` - Get by ID
  - [ ] `POST /v1/{table}` - Create
  - [ ] `PUT /v1/{table}/{id}` - Update
  - [ ] `DELETE /v1/{table}/{id}` - Delete
- [ ] Query parameter format
- [ ] Authorization header format

**Action Steps**:
1. Review ElectricSQL 1.2.9 HTTP API documentation
2. Test endpoints with `curl` or Postman
3. Check server logs for actual request/response formats
4. Review `@electric-sql/client` source code/types
5. Update implementation based on actual API
6. Update `API_ASSUMPTIONS.md` with verified endpoints

**Files Affected**:
- `packages/sync/src/client/index.ts` - Shape endpoint
- `packages/sync/src/hooks/useAgentContext.ts` - CRUD endpoints
- `packages/sync/src/hooks/useAgentMemory.ts` - CRUD endpoints
- `packages/sync/src/hooks/useConversations.ts` - CRUD endpoints

**Risk**: All sync functionality will fail if API assumptions are wrong.

---

## 🟡 High Priority (Should Fix Soon)

### 2. Replace console.* in Core Package

**Status**: 🟡 MEDIUM  
**Priority**: P1  
**Estimated Time**: 1-2 hours

**Problem**: Several files in `packages/core/src/core` use `console.error`, `console.warn`, `console.log` directly instead of using the logger interface.

**Files to Fix**:
- `packages/core/src/core/database/sqlite.ts` - 3 console.error
- `packages/core/src/core/database/universal-postgres.ts` - 5 console.error
- `packages/core/src/core/nextjs/withRevealUI.ts` - 1 console.warn
- `packages/core/src/core/http/fetchMainInfos.ts` - 1 console.error
- `packages/core/src/core/api/rest.ts` - 3 console.error
- `packages/core/src/core/storage/vercel-blob.ts` - 2 console.error

**Action Steps**:
1. Import logger in each file
2. Replace `console.error` with `logger.error`
3. Replace `console.warn` with `logger.warn`
4. Replace `console.log` with `logger.info` (if needed)
5. Test to ensure logging still works

**Note**: Test files (`__tests__`) are acceptable. Logger implementation (`logger.ts`) must use console methods.

---

### 3. Implement React Testing Library Setup for Hook Tests

**Status**: 🟡 MEDIUM  
**Priority**: P1  
**Estimated Time**: 4-6 hours

**Problem**: Three hook test files exist but tests are not implemented. They require React Testing Library setup.

**Files**:
- `packages/sync/src/__tests__/integration/useConversations.test.ts`
- `packages/sync/src/__tests__/integration/useAgentMemory.test.ts`
- `packages/sync/src/__tests__/integration/useAgentContext.test.ts`

**Action Steps**:
1. Install React Testing Library if not already installed
2. Set up test provider for ElectricSQL context
3. Mock ElectricSQL client
4. Implement tests for each hook:
   - useConversations: list, create, update, delete
   - useAgentMemory: list, create, update, delete
   - useAgentContext: get, update
5. Remove placeholder comments

**Note**: Depends on ElectricSQL API verification (Task 1).

---

### 4. Phase 3: Cohesion Engine Automated Cleanup

**Status**: 🟡 MEDIUM  
**Priority**: P1  
**Estimated Time**: 8-12 hours

**Problem**: Phase 3 is skeleton-only. Fix strategies are not implemented.

**Current State**: Framework exists but doesn't apply fixes.

**Action Steps**:
1. Implement fix strategies in `scripts/cohesion/utils/fixes.ts`:
   - Type assertion removal
   - Import standardization
   - Pattern extraction (create utilities)
   - Configuration fixes
2. Test each fix strategy
3. Add dry-run mode verification
4. Update documentation

---

### 5. Add Populate Support (Phase 2)

**Status**: 🟡 MEDIUM  
**Priority**: P1  
**Estimated Time**: 6-10 hours

**Problem**: Populate support is marked as `undefined` in multiple places with TODO comments.

**Locations**:
- `packages/core/src/core/instance/RevealUIInstance.ts:276`
- `packages/core/src/core/globals/GlobalOperations.ts:108`

**Action Steps**:
1. Design populate API structure
2. Implement populate logic in afterRead hook
3. Add populate support to find/findByID methods
4. Add populate support to findGlobal method
5. Update types
6. Add tests

---

### 6. Implement Vector Search (pgvector)

**Status**: 🟡 MEDIUM  
**Priority**: P2  
**Estimated Time**: 4-6 hours

**Problem**: Vector search returns all memories instead of using pgvector for similarity search.

**Location**: `packages/ai/src/memory/core/memory/episodic-memory.ts:320`

**Action Steps**:
1. Set up pgvector extension in database
2. Create vector column if not exists
3. Implement vector search query using pgvector operators
4. Add similarity threshold parameter
5. Update search method to use vector search
6. Add fallback to full search if no vector column

---

## 🟢 Medium Priority (Nice to Have)

### 7. Optimize RevealUIInstance.ts Further

**Status**: 🟢 LOW  
**Priority**: P2  
**Estimated Time**: 2-3 hours

**Current**: 317 lines, methods extracted  
**Target**: Could reduce to ~250 lines by extracting more helpers

**Optional Optimizations**:
- Extract `ensureDbConnected` logic
- Extract table creation logic
- Extract initialization logic

---

### 8. Vercel API Integration

**Status**: 🟢 LOW  
**Priority**: P2  
**Estimated Time**: 4-6 hours

**Location**: `apps/web/src/components/Builder.tsx:150`

**Action Steps**:
1. Set up Vercel API authentication
2. Implement project creation
3. Implement deployment
4. Handle deployment status
5. Return deployment URL

---

### 9. Universal Middleware Replacement

**Status**: 🟢 LOW  
**Priority**: P2  
**Estimated Time**: 2-3 hours

**Location**: `apps/web/src/server/create-todo-handler.ts:1`

**Note**: This is a Bati-generated boilerplate. May be resolved by Bati updates.

---

### 10. Remove TypeScript Ignore from CMS Build

**Status**: 🟢 LOW  
**Priority**: P2  
**Estimated Time**: Unknown (depends on fixing types)

**Location**: `apps/cms/next.config.mjs:21`

**Action Steps**:
1. Fix TypeScript errors in `packages/core`
2. Remove `typescript.ignoreBuildErrors: true`
3. Verify build succeeds

---

## 📋 Implementation Order

### Sprint 1: Critical Fixes (Week 1)
1. ✅ Verify ElectricSQL API endpoints
2. ✅ Replace console.* in core package
3. ✅ Start React Testing Library setup (blocked on #1)

### Sprint 2: High Priority (Week 2)
4. Complete React Testing Library setup
5. Phase 3 Cohesion Engine implementation
6. Start Populate support design

### Sprint 3: Features (Week 3-4)
7. Complete Populate support
8. Vector search implementation
9. Optional optimizations

---

## Notes

- Some items in `UNFINISHED_WORK_INVENTORY.md` were already complete (assessment docs were outdated)
- ElectricSQL API verification is the most critical blocker
- Console.* replacements are quick wins that improve code quality
- Test implementations depend on API verification
- Most other items are feature enhancements, not blockers

---

## Progress Tracking

- [x] Inventory created
- [x] Status verification completed
- [x] Action plan created
- [ ] ElectricSQL API verified
- [ ] Console.* replaced in core
- [ ] Hook tests implemented
- [ ] Phase 3 cohesion engine complete
- [ ] Populate support added
- [ ] Vector search implemented

## Related Documentation

- [Unfinished Work Inventory](./UNFINISHED_WORK_INVENTORY.md) - Complete inventory of unfinished work
- [Product Service Completion Plan](./PRODUCT_SERVICE_COMPLETION_PLAN.md) - Product service roadmap
- [Ralph Cohesion Engine Research](./RALPH_COHESION_ENGINE_RESEARCH.md) - Cohesion engine research
- [Status Dashboard](../STATUS.md) - Current project state
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task
